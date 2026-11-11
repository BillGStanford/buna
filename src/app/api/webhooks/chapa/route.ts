import {createHash,createHmac,timingSafeEqual} from "node:crypto";
import {NextResponse} from "next/server";
import {createAdminClient} from "@/lib/supabase/admin";
import {verifyWorkPayment} from "@/lib/work/payments";
import {createLogger} from "@/lib/logger";
export const runtime="nodejs";
const log=createLogger("chapa-work-webhook");
type EventPayload={webhook_type?:string;event?:string;status?:string;mode?:string;merchant_reference?:string};
const eventStatuses:Record<string,string>={"payment.success":"success","payment.failed":"failed","payment.cancelled":"cancelled","payment.incomplete":"incomplete","payment.blocked":"blocked"};
export async function POST(request:Request){
 const secret=process.env.CHAPA_WEBHOOK_SECRET;
 if(!secret)return NextResponse.json({error:"Webhook is not configured"},{status:503});
 const raw=Buffer.from(await request.arrayBuffer()),signature=request.headers.get("x-chapa-signature")||"";
 if(!/^[a-f0-9]{64}$/i.test(signature))return NextResponse.json({error:"Invalid signature"},{status:401});
 const expected=createHmac("sha256",secret).update(raw).digest(),received=Buffer.from(signature,"hex");
 if(received.length!==expected.length||!timingSafeEqual(received,expected))return NextResponse.json({error:"Invalid signature"},{status:401});
 let event:EventPayload;
 try{event=JSON.parse(raw.toString("utf8")) as EventPayload;}catch{return NextResponse.json({error:"Invalid payload"},{status:400});}
 const keyMode=process.env.CHAPA_PRIVATE_KEY?.startsWith("CHAPA_TEST_")?"test":process.env.CHAPA_PRIVATE_KEY?.startsWith("CHAPA_LIVE_")?"live":null;
 if(event.mode&&keyMode&&event.mode!==keyMode)return NextResponse.json({error:"Webhook environment mismatch"},{status:401});
 const bodyHash=createHash("sha256").update(raw).digest("hex"),admin=createAdminClient();
 const supported=event.webhook_type==="payment"&&Boolean(event.event)&&eventStatuses[event.event]===event.status;
 const {error:receiptError}=await admin.from("chapa_webhook_events").upsert({
  body_hash:bodyHash,webhook_type:String(event.webhook_type||"unknown"),event:String(event.event||"unknown"),
  event_status:event.status??null,mode:event.mode??null,merchant_reference:event.merchant_reference??null,
  processing_status:supported?"received":"ignored",processed_at:supported?null:new Date().toISOString(),
 },{onConflict:"body_hash",ignoreDuplicates:true});
 if(receiptError){log.error("Chapa webhook receipt could not be stored",receiptError);return NextResponse.json({error:"Receipt unavailable"},{status:503});}
 const {data:receipt,error:readError}=await admin.from("chapa_webhook_events").select("id,processing_status,payment_id,merchant_reference").eq("body_hash",bodyHash).single();
 if(readError||!receipt){log.error("Chapa webhook receipt lookup failed",readError);return NextResponse.json({error:"Receipt unavailable"},{status:503});}
 if(receipt.processing_status==="processed"||receipt.processing_status==="ignored")return NextResponse.json({received:true});
 if(!supported||!receipt.merchant_reference){
  await admin.from("chapa_webhook_events").update({processing_status:"ignored",processed_at:new Date().toISOString()}).eq("id",receipt.id);
  return NextResponse.json({received:true});
 }
 const {data:payment,error:paymentError}=await admin.from("work_payment_transactions").select("id").eq("merchant_reference",receipt.merchant_reference).maybeSingle();
 if(paymentError){log.error("Chapa payment lookup failed",paymentError);await admin.from("chapa_webhook_events").update({processing_status:"retry",last_error:"payment lookup failed"}).eq("id",receipt.id);return NextResponse.json({error:"Retry later"},{status:503});}
 if(!payment){await admin.from("chapa_webhook_events").update({processing_status:"ignored",processed_at:new Date().toISOString(),last_error:"unknown merchant reference"}).eq("id",receipt.id);return NextResponse.json({received:true});}
 await admin.from("chapa_webhook_events").update({payment_id:payment.id,processing_status:"received",last_error:null}).eq("id",receipt.id);
 const result=await verifyWorkPayment(payment.id);
 if(result==="pending"||result==="not_found"){
  await admin.from("chapa_webhook_events").update({processing_status:"retry",last_error:"provider verification is not final"}).eq("id",receipt.id);
  return NextResponse.json({error:"Payment verification pending"},{status:503});
 }
 await admin.from("chapa_webhook_events").update({processing_status:"processed",processed_at:new Date().toISOString(),last_error:null}).eq("id",receipt.id);
 return NextResponse.json({received:true,verified:result==="verified"});
}

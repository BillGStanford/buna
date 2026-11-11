import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyWorkPayment } from "@/lib/work/payments";
import { createLogger } from "@/lib/logger";

export const runtime="nodejs";
const log=createLogger("chapa-work-webhook");

export async function POST(request:Request){
  const secret=process.env.CHAPA_WEBHOOK_SECRET;
  if(!secret)return NextResponse.json({error:"Webhook is not configured"},{status:503});
  const raw=Buffer.from(await request.arrayBuffer());
  const signature=request.headers.get("x-chapa-signature")||"";
  const expected=createHmac("sha256",secret).update(raw).digest();
  let received:Buffer;
  try{received=Buffer.from(signature,"hex");}catch{return NextResponse.json({error:"Invalid signature"},{status:401});}
  if(received.length!==expected.length||!timingSafeEqual(received,expected))return NextResponse.json({error:"Invalid signature"},{status:401});
  let event:{webhook_type?:string;event?:string;status?:string;merchant_reference?:string};
  try{event=JSON.parse(raw.toString("utf8"));}catch{return NextResponse.json({error:"Invalid payload"},{status:400});}
  if(event.webhook_type!=="payment"||event.event!=="payment.success"||event.status!=="success")return NextResponse.json({received:true});
  if(!event.merchant_reference)return NextResponse.json({error:"Missing merchant reference"},{status:400});
  const admin=createAdminClient();
  const {data:payment,error}=await admin.from("work_payment_transactions").select("id").eq("merchant_reference",event.merchant_reference).maybeSingle();
  if(error){log.error("webhook payment lookup failed",error);return NextResponse.json({error:"Retry later"},{status:500});}
  if(!payment)return NextResponse.json({received:true});
  const result=await verifyWorkPayment(payment.id);
  if(result==="pending")return NextResponse.json({error:"Payment verification pending"},{status:503});
  return NextResponse.json({received:true,verified:result==="verified"});
}

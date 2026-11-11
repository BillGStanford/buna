import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createLogger } from "@/lib/logger";

const log=createLogger("work-payments");

export async function verifyWorkPayment(paymentId:string):Promise<"verified"|"pending"|"failed"|"not_found">{
  const secret=process.env.CHAPA_PRIVATE_KEY;
  if(!secret)return "pending";
  const admin=createAdminClient();
  const {data:payment,error}=await admin.from("work_payment_transactions").select("id,merchant_reference,amount_minor,currency,status").eq("id",paymentId).maybeSingle();
  if(error||!payment)return "not_found";
  if(payment.status==="succeeded")return "verified";
  const response=await fetch("https://api.chapa.global/v2/payments/"+encodeURIComponent(payment.merchant_reference)+"/verify",{
    method:"GET",headers:{"Authorization":"Bearer "+secret},cache:"no-store",
  });
  const result=await response.json().catch(()=>null);
  if(!response.ok||result?.status!=="success"||!result?.data)return "pending";
  const data=result.data as {status?:string;amount?:number;currency?:string;merchant_reference?:string;chapa_reference?:string;processor_reference?:string;payment_method?:string;service_fee?:number};
  if(data.status==="PENDING")return "pending";
  if(["FAILED","CANCELLED","INCOMPLETE","BLOCKED"].includes(String(data.status))){await admin.from("work_payment_transactions").update({status:"failed"}).eq("id",payment.id).eq("status","pending");return "failed";}
  if(data.status!=="SUCCESS")return "pending";
  if(Number(data.amount)!==Number(payment.amount_minor)||String(data.currency).toUpperCase()!==payment.currency||data.merchant_reference!==payment.merchant_reference){
    log.error("Chapa verification mismatch",{paymentId});
    return "pending";
  }
  const {data:finalized,error:finalizeError}=await admin.rpc("finalize_work_payment",{
    p_payment:payment.id,p_provider_reference:data.chapa_reference||payment.merchant_reference,
    p_amount_minor:Number(data.amount),p_currency:String(data.currency),
    p_provider_fee_minor:Number.isFinite(Number(data.service_fee))?Number(data.service_fee):null,
    p_payment_method:data.payment_method??null,p_processor_reference:data.processor_reference??null,
  });
  if(finalizeError||finalized!==true){log.error("finalize work payment failed",finalizeError,{paymentId});return "pending";}
  return "verified";
}

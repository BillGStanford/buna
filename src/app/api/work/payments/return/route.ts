import { NextResponse } from "next/server";
import { verifyWorkPayment } from "@/lib/work/payments";
import { getSiteUrl } from "@/lib/env";

export const runtime="nodejs";
export async function GET(request:Request){
  const url=new URL(request.url),paymentId=url.searchParams.get("payment_id");
  if(!paymentId||!/^[0-9a-f-]{36}$/i.test(paymentId))return NextResponse.redirect(new URL("/dashboard/work/contracts?payment=invalid",getSiteUrl()));
  const result=await verifyWorkPayment(paymentId);
  const state=result==="verified"?"verified":result==="pending"?"pending":"not-confirmed";
  return NextResponse.redirect(new URL("/dashboard/work/contracts?payment="+state,getSiteUrl()));
}

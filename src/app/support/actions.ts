"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/lib/audit";

const text=(fd:FormData,key:string)=>String(fd.get(key)??"").trim();

export async function submitSupportTicketAction(fd:FormData) {
  const user=await requireUser("/support");
  const subject=text(fd,"subject"),body=text(fd,"body"),priority=text(fd,"priority");
  if(subject.length<3||subject.length>180||body.length<5||body.length>8000||!["normal","high"].includes(priority))return;
  const db=createAdminClient();
  const {data,error}=await db.from("support_tickets").insert({user_id:user.id,email:user.email??"",subject,body,priority}).select("id").single();
  if(error||!data)throw new Error("Could not submit your support request.");
  await writeAuditLog({actorId:user.id,action:"support_ticket.create",entityType:"support_ticket",entityId:data.id});
  revalidatePath("/support");
}

export async function submitUserDisputeAction(fd:FormData) {
  const user=await requireUser("/support");
  const subject=text(fd,"subject"),details=text(fd,"details"),disputedAction=text(fd,"disputed_action");
  if(subject.length<3||subject.length>180||details.length<5||details.length>8000||disputedAction.length<2||disputedAction.length>120)return;
  const db=createAdminClient();
  const {data,error}=await db.from("user_disputes").insert({user_id:user.id,subject,details,disputed_action:disputedAction}).select("id").single();
  if(error||!data)throw new Error("Could not submit your dispute.");
  await writeAuditLog({actorId:user.id,action:"user_dispute.submit",entityType:"user_dispute",entityId:data.id});
  revalidatePath("/support");
}

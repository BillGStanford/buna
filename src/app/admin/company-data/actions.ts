"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/audit";

export async function reviewCompanyClaimAction(fd: FormData): Promise<void> {
 const staff=await requireStaff();
 const id=String(fd.get("claimId")??"");
 const status=String(fd.get("status")??"");
 const note=String(fd.get("reviewNote")??"").trim().slice(0,1000);
 if(!/^[0-9a-f-]{36}$/i.test(id) || !["verified","publicly_reported","estimated","disputed","not_disclosed"].includes(status)) return;
 const supabase=await createClient();
 const {data,error}=await supabase.from("startup_data_claims").update({
  source_status:status, reviewed_by:staff.id, reviewed_at:new Date().toISOString(),
  review_note:note || null,
 }).eq("id",id).select("id,startup_id").maybeSingle();
 if(error || !data) return;
 await writeAuditLog({actorId:staff.id,action:"company_claim.review",entityType:"startup_data_claim",entityId:id,metadata:{status,hasReviewNote:Boolean(note)}});
 revalidatePath("/admin/company-data");
 revalidatePath("/dashboard/startup/"+data.startup_id+"/intelligence");
}

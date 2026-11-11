"use server";
import {redirect} from "next/navigation";
import {revalidatePath} from "next/cache";
import {requireStaff} from "@/lib/auth/session";
import {createAdminClient} from "@/lib/supabase/admin";
import {writeAuditLog} from "@/lib/audit";
import {createLogger} from "@/lib/logger";
const log=createLogger("admin-work");
export async function moderateWorkProjectAction(fd:FormData):Promise<void>{
 const staff=await requireStaff(),projectId=String(fd.get("projectId")||""),status=String(fd.get("status")||"");
 if(!["paused","closed"].includes(status))redirect("/admin/work?error=invalid_action");
 const admin=createAdminClient(),{data,error}=await admin.from("work_projects").update({status}).eq("id",projectId).select("id").maybeSingle();
 if(error||!data){log.error("moderate work project failed",error);redirect("/admin/work?error=update_failed");}
 await writeAuditLog({actorId:staff.id,action:"work.project."+status,entityType:"work_project",entityId:projectId});
 revalidatePath("/work");revalidatePath("/work/projects");revalidatePath("/admin/work");redirect("/admin/work?updated=1");
}
export async function resolveWorkProjectReportAction(fd:FormData):Promise<void>{
 const staff=await requireStaff(),reportId=String(fd.get("reportId")||""),status=String(fd.get("status")||""),resolution=String(fd.get("resolution")||"").trim();
 if(!["actioned","dismissed"].includes(status)||resolution.length<3||resolution.length>1500)redirect("/admin/work?error=invalid_resolution");
 const admin=createAdminClient(),{data,error}=await admin.from("work_project_reports").update({status,resolution,handled_by:staff.id,handled_at:new Date().toISOString()}).eq("id",reportId).select("id,project_id").maybeSingle();
 if(error||!data){log.error("resolve work report failed",error);redirect("/admin/work?error=report_update_failed");}
 await writeAuditLog({actorId:staff.id,action:"work.report."+status,entityType:"work_project_report",entityId:reportId,metadata:{projectId:data.project_id}});
 revalidatePath("/admin/work");redirect("/admin/work?report=updated");
}
export async function resolveWorkDisputeAction(fd:FormData):Promise<void>{
 const staff=await requireStaff(),disputeId=String(fd.get("disputeId")||""),resolution=String(fd.get("resolution")||"").trim();
 if(resolution.length<10||resolution.length>3000)redirect("/admin/work?error=invalid_resolution");
 const admin=createAdminClient(),{data:dispute,error}=await admin.from("work_disputes").select("id,contract_id,status").eq("id",disputeId).maybeSingle();
 if(error||!dispute||!["open","reviewing"].includes(dispute.status))redirect("/admin/work?error=dispute_unavailable");
 const {error:updateError}=await admin.from("work_disputes").update({status:"resolved",resolution,resolved_by:staff.id,resolved_at:new Date().toISOString()}).eq("id",disputeId);
 if(updateError){log.error("resolve work dispute failed",updateError);redirect("/admin/work?error=dispute_update_failed");}
 await admin.from("work_contracts").update({status:"active"}).eq("id",dispute.contract_id).eq("status","disputed");
 await writeAuditLog({actorId:staff.id,action:"work.dispute.resolve",entityType:"work_dispute",entityId:disputeId,metadata:{contractId:dispute.contract_id}});
 revalidatePath("/admin/work");revalidatePath("/dashboard/work/contracts/"+dispute.contract_id);redirect("/admin/work?dispute=resolved");
}

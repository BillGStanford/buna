"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/audit";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const refresh = () => { revalidatePath("/admin/operations"); revalidatePath("/admin/audit"); revalidatePath("/admin"); };
const val = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

export async function updateSupportTicketAction(fd: FormData) {
  const staff = await requireAdmin();
  const id = val(fd,"id"), status = val(fd,"status"), priority = val(fd,"priority"), note = val(fd,"note").slice(0,2000);
  if (!UUID.test(id) || !["open","triaged","waiting","resolved","closed"].includes(status) || !["low","normal","high","urgent"].includes(priority)) return;
  const admin = createAdminClient();
  const {data:ticket}=await admin.from("support_tickets").select("user_id,subject").eq("id",id).maybeSingle();
  const { data, error } = await admin.from("support_tickets").update({status,priority,resolution_note:note||null,assigned_to:staff.id}).eq("id",id).select("id").maybeSingle();
  if (error || !data) throw new Error("Could not update support ticket.");
  if(ticket?.user_id) await admin.from("notifications").insert({user_id:ticket.user_id,type:"support_ticket_update",title:"Your support request was updated",body:note||("Status: "+status),url:"/support",data:{ticket_id:id},dedupe_key:"support-ticket-update:"+id+":"+status+":"+Date.now()});
  await writeAuditLog({actorId:staff.id,action:"support_ticket.update",entityType:"support_ticket",entityId:id,metadata:{status,priority}});
  refresh();
}

export async function resolveUserDisputeAction(fd: FormData) {
  const staff = await requireAdmin();
  const id=val(fd,"id"), status=val(fd,"status"), decision=val(fd,"decision").slice(0,2000);
  if (!UUID.test(id) || !["under_review","resolved","rejected"].includes(status) || decision.length<5) return;
  const admin=createAdminClient();
  const {data:dispute}=await admin.from("user_disputes").select("user_id").eq("id",id).maybeSingle();
  const {data,error}=await admin.from("user_disputes").update({status,decision,reviewer_id:staff.id,reviewed_at:new Date().toISOString()}).eq("id",id).select("id").maybeSingle();
  if(error||!data) throw new Error("Could not resolve dispute.");
  if(dispute?.user_id) await admin.from("notifications").insert({user_id:dispute.user_id,type:"user_dispute_update",title:"Your dispute was reviewed",body:decision,url:"/support",data:{dispute_id:id,status},dedupe_key:"user-dispute-update:"+id+":"+status+":"+Date.now()});
  await writeAuditLog({actorId:staff.id,action:"user_dispute."+status,entityType:"user_dispute",entityId:id,metadata:{decision}});
  refresh();
}

const CORRECTABLE = new Set(["name","tagline","description","website_url","country","city","stage","founded_year"]);
export async function reviewCompanyCorrectionAction(fd: FormData) {
  const staff=await requireAdmin();
  const id=val(fd,"id"), status=val(fd,"status"), note=val(fd,"note").slice(0,1000);
  if(!UUID.test(id)||!["accepted","rejected","reviewing"].includes(status)) return;
  const admin=createAdminClient();
  const {data:request,error}=await admin.from("startup_correction_requests").select("id,startup_id,field_name,proposed_value").eq("id",id).maybeSingle();
  if(error||!request) throw new Error("Correction request not found.");
  if(status==="accepted"){
    if(!CORRECTABLE.has(request.field_name)) throw new Error("This field requires manual review and cannot be changed automatically.");
    const patch:Record<string,unknown>={[request.field_name]:request.proposed_value};
    if(request.field_name==="country") patch.country=request.proposed_value.toUpperCase();
    if(request.field_name==="founded_year") patch.founded_year=Number(request.proposed_value);
    const {error:updateError}=await admin.from("startups").update(patch).eq("id",request.startup_id);
    if(updateError) throw new Error("The proposed correction is not valid for this startup.");
  }
  const {error:updateError}=await admin.from("startup_correction_requests").update({status,reviewer_id:staff.id,reviewed_at:new Date().toISOString(),reviewer_note:note||null}).eq("id",id);
  if(updateError) throw new Error("Could not save correction review.");
  await writeAuditLog({actorId:staff.id,action:"company_correction."+status,entityType:"startup_correction_request",entityId:id,metadata:{field:request.field_name}});
  refresh(); revalidatePath("/startups","layout");
}

export async function mergeDuplicateStartupsAction(fd: FormData) {
  await requireAdmin();
  const source=val(fd,"source"),target=val(fd,"target"),note=val(fd,"note");
  if(!UUID.test(source)||!UUID.test(target)||source===target||note.length<5) return;
  const supabase=await createClient();
  const {error}=await supabase.rpc("admin_merge_startups",{p_source:source,p_target:target,p_note:note});
  if(error) throw new Error(error.message==="forbidden"?"Administrator permission required.":"Could not merge these startups. Check their status and try again.");
  refresh(); revalidatePath("/startups","layout");
}

function parseCsv(source:string):string[][] {
  const rows:string[][]=[]; let row:string[]=[]; let cell=""; let quoted=false;
  for(let i=0;i<source.length;i++){const c=source[i]; if(c==='"'){if(quoted&&source[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(c===","&&!quoted){row.push(cell.trim());cell="";}else if((c==="\n"||c==="\r")&&!quoted){if(c==="\r"&&source[i+1]==="\n")i++;row.push(cell.trim());if(row.some(Boolean))rows.push(row);row=[];cell="";}else cell+=c;}
  row.push(cell.trim());if(row.some(Boolean))rows.push(row);return rows;
}
function slugify(s:string){return s.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,55)||"listing";}

export async function previewBulkImportAction(fd: FormData) {
  const staff=await requireAdmin();
  const kind=val(fd,"kind"), raw=val(fd,"csv");
  if(!["startup","opportunity"].includes(kind)||raw.length>1_000_000) return;
  const rows=parseCsv(raw); if(rows.length<2||rows.length>1001) throw new Error("CSV must contain a header and between 1 and 1,000 data rows.");
  const headerRow=rows[0]??[];
  const headers=headerRow.map(h=>h.toLowerCase().replace(/\s+/g,"_"));
  const allowed=kind==="startup"?["name","tagline","description","website_url","country","city","stage"]:["title","organization","description","category","eligibility","countries","deadline","application_url","source_url","tags"];
  if(headers.some(h=>!allowed.includes(h))||!headers.includes(kind==="startup"?"name":"title")) throw new Error("CSV headers are not supported. Use the documented field names shown on this page.");
  const data: Array<Record<string,string|number>>=rows.slice(1).map((r,index)=>({...Object.fromEntries(headers.map((h,i)=>[h,r[i]??""])),_row:index+2}));
  const previewErrors:{row:number;error:string}[]=[];
  for(const r of data){
    let issue="";
    if(kind==="startup"){
      if(String(r.name??"").trim().length<2)issue="Startup name is required.";
      else if(r.country && !/^[A-Za-z]{2}$/.test(String(r.country)))issue="Country must be a two-letter ISO code.";
      else if(r.website_url && !/^https?:\/\//i.test(String(r.website_url)))issue="Website URL must start with http:// or https://.";
    }else{
      if(String(r.title??"").trim().length<3||!String(r.organization??"").trim())issue="Opportunity title and organization are required.";
      else if(!["grant","accelerator","competition","fellowship","job","event","mentorship","partnership"].includes(String(r.category)))issue="Opportunity category is invalid.";
      else if((r.application_url && !/^https?:\/\//i.test(String(r.application_url)))||(r.source_url && !/^https?:\/\//i.test(String(r.source_url))))issue="Application and source URLs must start with http:// or https://.";
    }
    if(issue){r._validation_error=issue;previewErrors.push({row:Number(r._row),error:issue});}
  }
  const admin=createAdminClient();
  const {data:batch,error}=await admin.from("admin_import_batches").insert({kind,rows:data,row_count:data.length,error_summary:previewErrors,created_by:staff.id}).select("id").single();
  if(error||!batch) throw new Error("Could not stage the import.");
  await writeAuditLog({actorId:staff.id,action:"bulk_import.preview",entityType:"import_batch",entityId:batch.id,metadata:{kind,row_count:data.length}});
  refresh();
}

export async function applyBulkImportAction(fd: FormData) {
  const staff=await requireAdmin(); const id=val(fd,"id");
  if(!UUID.test(id)) return;
  const admin=createAdminClient();
  const {data:batch,error}=await admin.from("admin_import_batches").select("id,kind,status,rows").eq("id",id).maybeSingle();
  if(error||!batch||batch.status!=="preview") throw new Error("Import batch is unavailable or already processed.");
  const rows=Array.isArray(batch.rows)?batch.rows as Array<Record<string,string|number>>:[];
  let imported=0; const errors:{row:number;error:string}[]=[];
  for(const r of rows){
    if(r._validation_error){errors.push({row:Number(r._row)||0,error:String(r._validation_error)});continue;}
    try{
      if(batch.kind==="startup"){
        const name=String(r.name??"").trim(); if(name.length<2) throw new Error("Name is required.");
        const slug=slugify(name)+"-"+crypto.randomUUID().slice(0,6);
        const country=String(r.country??"").trim().toUpperCase();
        const row={name,slug,tagline:String(r.tagline??"").slice(0,160)||null,description:String(r.description??"").slice(0,5000)||null,website_url:String(r.website_url??"").trim()||null,country:country||null,city:String(r.city??"").slice(0,100)||null,stage:["idea","prototype","mvp","early_revenue","growth","scale"].includes(String(r.stage))?String(r.stage):null,status:"draft",created_by:staff.id};
        const {error:insertError}=await admin.from("startups").insert(row);if(insertError)throw insertError;
      }else{
        const title=String(r.title??"").trim(),organization=String(r.organization??"").trim(),category=String(r.category??"").trim();
        if(title.length<3||!organization)throw new Error("Title and organization are required.");
        if(!["grant","accelerator","competition","fellowship","job","event","mentorship","partnership"].includes(category))throw new Error("Invalid opportunity category.");
        const row={title,organization,slug:slugify(title)+"-"+crypto.randomUUID().slice(0,6),description:String(r.description??"").slice(0,5000)||null,category,eligibility:String(r.eligibility??"").slice(0,2000)||null,countries:String(r.countries??"").split(";").map(x=>x.trim().toUpperCase()).filter(Boolean),deadline:String(r.deadline??"").trim()||null,application_url:String(r.application_url??"").trim()||null,source_url:String(r.source_url??"").trim()||null,tags:String(r.tags??"").split(";").map(x=>x.trim()).filter(Boolean),status:"draft",created_by:staff.id};
        const {error:insertError}=await admin.from("opportunities").insert(row);if(insertError)throw insertError;
      }
      imported++;
    }catch(e){errors.push({row:Number(r._row)||0,error:e instanceof Error?e.message:"Invalid row"});}
  }
  await admin.from("admin_import_batches").update({status:errors.length?"failed":"processed",imported_count:imported,error_summary:errors,processed_at:new Date().toISOString()}).eq("id",id);
  await writeAuditLog({actorId:staff.id,action:"bulk_import.apply",entityType:"import_batch",entityId:id,metadata:{kind:batch.kind,imported,failed:errors.length}});
  refresh(); revalidatePath("/admin/startups");revalidatePath("/admin/opportunities");
}

export async function schedulePlatformAnnouncementAction(fd: FormData) {
  const staff=await requireAdmin();
  const title=val(fd,"title"),body=val(fd,"body"),target=val(fd,"target"),url=val(fd,"url"),when=val(fd,"scheduled_at");
  const scheduledAt=when?new Date(when):new Date();
  if(title.length<3||body.length<5||!["all","founders","investors"].includes(target)||Number.isNaN(scheduledAt.getTime())||scheduledAt.getTime()<Date.now()-60000||url&&(!url.startsWith("/")||url.startsWith("//"))) return;
  const admin=createAdminClient();
  const {data,error}=await admin.from("platform_announcements").insert({title,body,target,target_url:url||null,scheduled_at:scheduledAt.toISOString(),created_by:staff.id}).select("id").single();
  if(error||!data) throw new Error("Could not schedule announcement.");
  await writeAuditLog({actorId:staff.id,action:"announcement.schedule",entityType:"platform_announcement",entityId:data.id,metadata:{target,scheduled_at:scheduledAt.toISOString()}});
  refresh();
}

export async function dispatchAnnouncementNowAction(fd: FormData) {
  const staff=await requireAdmin(),id=val(fd,"id"); if(!UUID.test(id))return;
  const admin=createAdminClient();
  const {error}=await admin.from("platform_announcements").update({scheduled_at:new Date().toISOString()}).eq("id",id).eq("status","scheduled");
  if(error)throw new Error("Could not dispatch announcement.");
  const {error:dispatchError}=await admin.rpc("dispatch_due_platform_announcements");
  if(dispatchError)throw new Error("Announcement dispatch failed.");
  await writeAuditLog({actorId:staff.id,action:"announcement.dispatch",entityType:"platform_announcement",entityId:id});
  refresh();
}

export async function createFeaturedCampaignAction(fd: FormData) {
  const staff=await requireAdmin(),startup=val(fd,"startup_id"),title=val(fd,"title"),start=val(fd,"starts_at"),end=val(fd,"ends_at");
  const starts=new Date(start),ends=new Date(end);
  if(!UUID.test(startup)||title.length<3||Number.isNaN(starts.getTime())||Number.isNaN(ends.getTime())||ends<=starts)return;
  const admin=createAdminClient();
  const {data,error}=await admin.from("startups").select("id,status,is_featured").eq("id",startup).maybeSingle();
  if(error||!data||data.status!=="published")throw new Error("Campaigns can only feature published startups.");
  const {count:overlaps}=await admin.from("featured_startup_campaigns").select("id",{count:"exact",head:true}).eq("startup_id",startup).in("status",["scheduled","active"]);
  if((overlaps??0)>0)throw new Error("This startup already has a scheduled or active campaign.");
  const {data:campaign,error:insertError}=await admin.from("featured_startup_campaigns").insert({startup_id:startup,title,starts_at:starts.toISOString(),ends_at:ends.toISOString(),status:starts<=new Date()?"active":"scheduled",was_featured_before:data.is_featured,created_by:staff.id}).select("id").single();
  if(insertError||!campaign)throw new Error("Could not create campaign.");
  if(starts<=new Date())await admin.from("startups").update({is_featured:true}).eq("id",startup);
  await writeAuditLog({actorId:staff.id,action:"featured_campaign.create",entityType:"featured_campaign",entityId:campaign.id,metadata:{startup_id:startup,starts_at:starts.toISOString(),ends_at:ends.toISOString()}});
  refresh();revalidatePath("/");
}

export async function cancelFeaturedCampaignAction(fd: FormData) {
  const staff=await requireAdmin(),id=val(fd,"id");if(!UUID.test(id))return;
  const admin=createAdminClient();
  const {data,error}=await admin.from("featured_startup_campaigns").update({status:"cancelled"}).eq("id",id).in("status",["scheduled","active"]).select("id,startup_id,was_featured_before").maybeSingle();
  if(error||!data)throw new Error("Could not cancel campaign.");
  const {count:active}=await admin.from("featured_startup_campaigns").select("id",{count:"exact",head:true}).eq("startup_id",data.startup_id).eq("status","active");
  if((active??0)===0)await admin.from("startups").update({is_featured:data.was_featured_before}).eq("id",data.startup_id);
  await writeAuditLog({actorId:staff.id,action:"featured_campaign.cancel",entityType:"featured_campaign",entityId:id,metadata:{startup_id:data.startup_id}});
  refresh();revalidatePath("/");
}

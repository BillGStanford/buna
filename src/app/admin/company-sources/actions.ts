"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/audit";

const UUID=/^[0-9a-f-]{36}$/i;
const TYPES=["registry","accelerator","publication","company_website","open_dataset","licensed_provider","manual"];
function validHttp(value:string){try{const u=new URL(value);return u.protocol==="http:"||u.protocol==="https:";}catch{return false;}}

export async function addCompanySourceAction(fd:FormData):Promise<void>{
 const staff=await requireStaff();
 const name=String(fd.get("name")??"").trim().slice(0,120);
 const type=String(fd.get("sourceType")??"");
 const url=String(fd.get("baseUrl")??"").trim();
 const terms=String(fd.get("termsUrl")??"").trim();
 const country=String(fd.get("country")??"").trim().toUpperCase();
 const notes=String(fd.get("notes")??"").trim().slice(0,1000);
 if(name.length<2||!TYPES.includes(type)||(url&&!validHttp(url))||(terms&&!validHttp(terms))||(country&&!/^[A-Z]{2}$/.test(country)))return;
 const supabase=await createClient();
 const {data,error}=await supabase.from("company_data_sources").insert({name,source_type:type,base_url:url||null,terms_url:terms||null,country:country||null,notes:notes||null}).select("id").single();
 if(error||!data)return;
 await writeAuditLog({actorId:staff.id,action:"company_source.create",entityType:"company_data_source",entityId:data.id});
 revalidatePath("/admin/company-sources");
}

export async function addCompanySourceRecordAction(fd:FormData):Promise<void>{
 const staff=await requireStaff();
 const sourceId=String(fd.get("sourceId")??"");
 const name=String(fd.get("companyName")??"").trim().slice(0,160);
 const externalId=String(fd.get("externalId")??"").trim().slice(0,200);
 const url=String(fd.get("sourceUrl")??"").trim();
 const country=String(fd.get("country")??"").trim().toUpperCase();
 const raw=String(fd.get("rawPayload")??"").trim();
 if(!UUID.test(sourceId)||name.length<2||(url&&!validHttp(url))||(country&&!/^[A-Z]{2}$/.test(country)))return;
 let payload:Record<string,unknown>={};
 if(raw.length>50000)return;
 if(raw){try{const parsed=JSON.parse(raw);if(!parsed||typeof parsed!=="object"||Array.isArray(parsed))return;payload=parsed as Record<string,unknown>;}catch{return;}}
 const supabase=await createClient();
 const {data,error}=await supabase.from("company_source_records").insert({
  source_id:sourceId,external_record_id:externalId||null,source_url:url||null,proposed_company_name:name,
  normalized_name:name.toLocaleLowerCase().replace(/[^a-z0-9]+/g," ").trim(),country:country||null,raw_payload:payload,
 }).select("id").single();
 if(error||!data)return;
 await writeAuditLog({actorId:staff.id,action:"company_source_record.create",entityType:"company_source_record",entityId:data.id});
 revalidatePath("/admin/company-sources");
}

export async function reviewCompanySourceRecordAction(fd:FormData):Promise<void>{
 const staff=await requireStaff();
 const id=String(fd.get("recordId")??"");
 const status=String(fd.get("status")??"");
 const startupId=String(fd.get("startupId")??"").trim();
 const note=String(fd.get("reviewNote")??"").trim().slice(0,1000);
 if(!UUID.test(id)||!["matched","created","duplicate","rejected"].includes(status)||(startupId&&!UUID.test(startupId)))return;
 if(["matched","created"].includes(status)&&!startupId)return;
 const supabase=await createClient();
 const {error}=await supabase.from("company_source_records").update({
  review_status:status,proposed_startup_id:startupId||null,reviewed_by:staff.id,reviewed_at:new Date().toISOString(),review_note:note||null,
 }).eq("id",id);
 if(error)return;
 await writeAuditLog({actorId:staff.id,action:"company_source_record.review",entityType:"company_source_record",entityId:id,metadata:{status,matchedStartup:Boolean(startupId)}});
 revalidatePath("/admin/company-sources");
}

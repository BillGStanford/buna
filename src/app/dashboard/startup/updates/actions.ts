"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireActiveProfile } from "@/lib/auth/session";
import { getManagedStartup } from "@/lib/startups/queries";
import { canEditStartup } from "@/lib/permissions";

async function context(formData: FormData) {
  const startupId = String(formData.get("startupId") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(startupId)) throw new Error("Invalid startup.");
  const profile = await requireActiveProfile();
  const managed = await getManagedStartup(startupId, profile.id);
  if (!managed || !canEditStartup(managed.role)) throw new Error("You do not have permission to manage this startup.");
  return { startupId, profile, managed, supabase: await createClient() };
}
function text(formData: FormData, key: string, max: number) {
  const value = String(formData.get(key) ?? "").trim();
  if (value.length > max) throw new Error(`${key} is too long.`);
  return value;
}
function refresh(startupId: string, slug: string) {
  revalidatePath(`/dashboard/startup/${startupId}`, "layout");
  revalidatePath(`/startups/${slug}`);
}

export async function createChangelogAction(formData: FormData) {
  const c = await context(formData);
  const title = text(formData,"title",120), body = text(formData,"body",5000);
  if (title.length < 2 || body.length < 2) throw new Error("Add a title and release notes.");
  const { error } = await c.supabase.from("startup_changelog").insert({
    startup_id:c.startupId,title,body,version:text(formData,"version",40)||null,
    released_on:text(formData,"releasedOn",10)||new Date().toISOString().slice(0,10),
    is_public:formData.get("isPublic")==="on",created_by:c.profile.id
  });
  if(error) throw new Error("Could not publish this changelog entry.");
  refresh(c.startupId,c.managed.startup.slug);
}
export async function deleteChangelogAction(formData: FormData) {
  const c=await context(formData), id=text(formData,"entryId",36);
  const {error}=await c.supabase.from("startup_changelog").delete().eq("id",id).eq("startup_id",c.startupId);
  if(error) throw new Error("Could not delete this changelog entry.");
  refresh(c.startupId,c.managed.startup.slug);
}
export async function createMilestoneAction(formData: FormData) {
  const c=await context(formData), title=text(formData,"title",120), description=text(formData,"description",3000);
  if(title.length<2) throw new Error("Enter a milestone title.");
  const {error}=await c.supabase.from("startup_milestones").insert({
    startup_id:c.startupId,title,description:description||null,
    target_date:text(formData,"targetDate",10)||null,is_public:formData.get("isPublic")==="on",
    completed_at:formData.get("completed")==="on"?new Date().toISOString():null,
    created_by:c.profile.id
  });
  if(error) throw new Error("Could not save this milestone.");
  refresh(c.startupId,c.managed.startup.slug);
}
export async function updateMilestoneAction(formData: FormData) {
  const c=await context(formData), id=text(formData,"milestoneId",36);
  const completed=formData.get("completed")==="on";
  const {error}=await c.supabase.from("startup_milestones").update({
    completed_at:completed?new Date().toISOString():null,
    is_public:formData.get("isPublic")==="on"
  }).eq("id",id).eq("startup_id",c.startupId);
  if(error) throw new Error("Could not update this milestone.");
  refresh(c.startupId,c.managed.startup.slug);
}
export async function deleteMilestoneAction(formData: FormData) {
  const c=await context(formData), id=text(formData,"milestoneId",36);
  const {error}=await c.supabase.from("startup_milestones").delete().eq("id",id).eq("startup_id",c.startupId);
  if(error) throw new Error("Could not delete this milestone.");
  refresh(c.startupId,c.managed.startup.slug);
}
export async function createAnnouncementAction(formData: FormData) {
  const c=await context(formData), title=text(formData,"title",160), body=text(formData,"body",8000);
  const type=text(formData,"announcementType",30);
  if(title.length<2||body.length<2) throw new Error("Add an announcement title and message.");
  if(!["company_news","product_release","fundraising","hiring","partnership","other"].includes(type)) throw new Error("Choose a valid announcement type.");
  const publish=formData.get("publish")==="on";
  const {error}=await c.supabase.from("startup_announcements").insert({
    startup_id:c.startupId,title,body,announcement_type:type,
    is_public:formData.get("isPublic")==="on",
    published_at:publish?new Date().toISOString():null,created_by:c.profile.id
  });
  if(error) throw new Error("Could not save this announcement.");
  refresh(c.startupId,c.managed.startup.slug);
}
export async function deleteAnnouncementAction(formData: FormData) {
  const c=await context(formData), id=text(formData,"announcementId",36);
  const {error}=await c.supabase.from("startup_announcements").delete().eq("id",id).eq("startup_id",c.startupId);
  if(error) throw new Error("Could not delete this announcement.");
  refresh(c.startupId,c.managed.startup.slug);
}
export async function updateHiringStatusAction(formData: FormData) {
  const c=await context(formData), status=text(formData,"hiringStatus",30);
  if(!["not_hiring","open_roles","always_open"].includes(status)) throw new Error("Choose a valid hiring status.");
  const {error}=await c.supabase.from("startups").update({hiring_status:status}).eq("id",c.startupId);
  if(error) throw new Error("Could not update hiring status.");
  refresh(c.startupId,c.managed.startup.slug);
}
export async function submitCorrectionRequestAction(formData: FormData) {
  const c=await context(formData), field=text(formData,"fieldName",80), proposed=text(formData,"proposedValue",5000), reason=text(formData,"reason",2000);
  if(!field||!proposed||reason.length<5) throw new Error("Complete the field, proposed correction and reason.");
  const {error}=await c.supabase.from("startup_correction_requests").insert({
    startup_id:c.startupId,field_name:field,current_value:text(formData,"currentValue",5000)||null,
    proposed_value:proposed,reason,submitted_by:c.profile.id
  });
  if(error) throw new Error("Could not submit the correction request.");
  refresh(c.startupId,c.managed.startup.slug);
}

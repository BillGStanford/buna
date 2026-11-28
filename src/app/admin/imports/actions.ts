"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSiteUrl } from "@/lib/env";
import { slugCandidate } from "@/lib/slug";
import { checkImageFile } from "@/lib/uploads";
import { writeAuditLog } from "@/lib/audit";

type Row = Record<string, unknown>;
type Parsed = { type: "startups" | "launches" | "combined"; startups: Row[]; launches: Row[] };
const str = (v: unknown) => typeof v === "string" ? v.trim() : "";
const validUrl = (v: string) => { try { const u = new URL(v); return ["http:","https:"].includes(u.protocol); } catch { return false; } };
const emailOf = (row: Row) => str((row.founder as Row | undefined)?.email).toLowerCase();
const safeImportKey = (row: Row, i: number, kind: string) => str(row.import_key) || `${kind}-${i+1}`;

function parsePayload(raw: string): Parsed {
  if (raw.length > 2_000_000) throw new Error("JSON file exceeds the 2 MB limit.");
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new Error("This file is not valid JSON."); }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("The JSON root must be an object.");
  const obj = value as Row;
  if (obj.version !== 1) throw new Error("Unsupported JSON version. Use version: 1.");
  if (!["startups","launches","combined"].includes(str(obj.type))) throw new Error("type must be startups, launches or combined.");
  const sanitize = (row: Row, kind: "startup" | "launch"): Row => {
    const founder = row.founder && typeof row.founder === "object" && !Array.isArray(row.founder) ? row.founder as Row : {};
    const common = { import_key: str(row.import_key), name: str(row.name), tagline: str(row.tagline), description: str(row.description), category: str(row.category),
      tags: Array.isArray(row.tags) ? row.tags.filter((x): x is string => typeof x === "string").slice(0,12) : [],
      founder: { email: str(founder.email), display_name: str(founder.display_name) } };
    if (kind === "startup") return { ...common, website_url: str(row.website_url), country: str(row.country), city: str(row.city), stage: str(row.stage), founded_year: row.founded_year,
      problem_statement: str(row.problem_statement), solution: str(row.solution), target_customers: Array.isArray(row.target_customers) ? row.target_customers.filter((x): x is string => typeof x === "string").slice(0,12) : [],
      target_geographies: Array.isArray(row.target_geographies) ? row.target_geographies.filter((x): x is string => typeof x === "string").slice(0,12) : [],
      market_opportunity: str(row.market_opportunity), business_model: str(row.business_model), is_product_live: row.is_product_live === true,
      funding_round: str(row.funding_round), fundraising_status: str(row.fundraising_status), funding_target: row.funding_target, funding_currency: str(row.funding_currency).toUpperCase() || "USD",
      links: Array.isArray(row.links) ? row.links.slice(0,12).map((entry) => { const link = entry && typeof entry === "object" && !Array.isArray(entry) ? entry as Row : {}; return { kind: str(link.kind), url: str(link.url), label: str(link.label) }; }) : [] };
    return { ...common, product_url: str(row.product_url), demo_video_url: str(row.demo_video_url), startup_ref: str(row.startup_ref), launch_date: str(row.launch_date) };
  };
  // Strict allowlist: image data, passwords, roles, statuses, IDs and unknown fields are discarded.
  const startups = Array.isArray(obj.startups) ? (obj.startups as Row[]).map((row) => sanitize(row && typeof row === "object" && !Array.isArray(row) ? row : {}, "startup")) : [];
  const launches = Array.isArray(obj.launches) ? (obj.launches as Row[]).map((row) => sanitize(row && typeof row === "object" && !Array.isArray(row) ? row : {}, "launch")) : [];
  if (obj.type === "startups" && !startups.length) throw new Error("Add at least one startup to the startups array.");
  if (obj.type === "launches" && !launches.length) throw new Error("Add at least one launch to the launches array.");
  if (obj.type === "combined" && !startups.length && !launches.length) throw new Error("Add startups and/or launches.");
  if (startups.length > 100 || launches.length > 200 || startups.length + launches.length > 300) throw new Error("A batch can contain up to 100 startups and 200 launches (300 total).");
  for (const [kind, rows] of [["startup", startups], ["launch", launches]] as const) {
    rows.forEach((row, i) => {
      if (!row || typeof row !== "object" || Array.isArray(row)) throw new Error(`${kind} row ${i+1} must be an object.`);
      const name = str(row.name);
      if (name.length < 2 || name.length > 80) throw new Error(`${kind} row ${i+1}: name must be 2–80 characters.`);
      if (!emailOf(row) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailOf(row))) throw new Error(`${kind} row ${i+1}: a valid founder.email is required.`);
      if (kind === "startup" && row.website_url && !validUrl(str(row.website_url))) throw new Error(`startup row ${i+1}: website_url must be an HTTP(S) URL.`);
      if (kind === "launch") {
        if (str(row.tagline).length < 5 || str(row.tagline).length > 160) throw new Error(`launch row ${i+1}: tagline must be 5–160 characters.`);
        if (!validUrl(str(row.product_url))) throw new Error(`launch row ${i+1}: product_url must be an HTTP(S) URL.`);
        if (row.demo_video_url && !validUrl(str(row.demo_video_url))) throw new Error(`launch row ${i+1}: demo_video_url must be an HTTP(S) URL.`);
      }
      if (row.tags !== undefined && (!Array.isArray(row.tags) || row.tags.length > 12 || row.tags.some((x) => typeof x !== "string" || x.length > 30))) throw new Error(`${kind} row ${i+1}: tags must be an array of up to 12 strings (30 characters each).`);
      if (row.founder && typeof row.founder !== "object") throw new Error(`${kind} row ${i+1}: founder must be an object.`);
    });
  }
  return { type: obj.type as Parsed["type"], startups, launches };
}

export async function previewJsonImportAction(fd: FormData) {
  const admin = await requireAdmin();
  const file = fd.get("json");
  if (!(file instanceof File) || !file.size) throw new Error("Choose a JSON file.");
  if (file.size > 2_000_000) throw new Error("JSON file exceeds the 2 MB limit.");
  const parsed = parsePayload(await file.text());
  const db = createAdminClient();
  const total = parsed.startups.length + parsed.launches.length;
  const { data: batch, error } = await db.from("admin_content_import_batches").insert({
    kind: parsed.type, payload: parsed, row_count: total, created_by: admin.id, status: "preview",
  }).select("id").single();
  if (error || !batch) throw new Error("Could not stage this import. Check that migration 0055 has been applied.");
  const items = [
    ...parsed.startups.map((row, i) => ({ batch_id: batch.id, item_type: "startup", import_key: safeImportKey(row, i, "startup"), payload: row })),
    ...parsed.launches.map((row, i) => ({ batch_id: batch.id, item_type: "launch", import_key: safeImportKey(row, i, "launch"), payload: row })),
  ];
  const { error: itemError } = await db.from("admin_content_import_items").insert(items);
  if (itemError) {
    await db.from("admin_content_import_batches").delete().eq("id", batch.id);
    throw new Error("Could not stage import rows.");
  }
  await writeAuditLog({ actorId: admin.id, action: "content_import.stage", entityType: "content_import_batch", entityId: batch.id, metadata: { kind: parsed.type, rows: total } });
  revalidatePath("/admin/imports");
  redirect(`/admin/imports?batch=${batch.id}`);
}

async function resolveFounder(db: ReturnType<typeof createAdminClient>, email: string, displayName: string, cache: Map<string,string>) {
  const key = email.toLowerCase();
  const cached = cache.get(key);
  if (cached) return cached;
  let userId: string | null = null;
  for (let page = 1; page <= 10 && !userId; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw new Error("Could not look up founder accounts.");
    const match = data.users.find((u) => u.email?.toLowerCase() === key);
    if (match) userId = match.id;
    if (data.users.length < 100) break;
  }
  if (!userId) {
    const { data, error } = await db.auth.admin.inviteUserByEmail(key, {
      data: { display_name: displayName.slice(0,80) },
      redirectTo: `${getSiteUrl()}/auth/confirm?next=/onboarding`,
    });
    if (error || !data.user) throw new Error(`Could not invite ${key}: ${error?.message ?? "unknown auth error"}`);
    userId = data.user.id;
  } else if (displayName) {
    await db.from("profiles").update({ display_name: displayName.slice(0,80) }).eq("id", userId).eq("display_name", "");
  }
  const { data: profile } = await db.from("profiles").select("is_suspended").eq("id",userId).maybeSingle();
  if (profile?.is_suspended) throw new Error(`Founder account ${key} is suspended and cannot receive imported content.`);
  await db.from("profiles").update({ founder_status: "founder", ...(displayName ? { display_name: displayName.slice(0,80) } : {}) }).eq("id",userId).is("founder_status",null);
  cache.set(key,userId);
  return userId;
}

async function resolveCategory(db: ReturnType<typeof createAdminClient>, value: unknown) {
  const slug = str(value).toLowerCase();
  if (!slug) return null;
  const { data } = await db.from("categories").select("id").eq("slug",slug).eq("is_active",true).maybeSingle();
  if (!data) throw new Error(`Category "${slug}" does not exist or is inactive. Use its category slug or leave it blank.`);
  return data.id;
}

async function uniqueSlug(db: ReturnType<typeof createAdminClient>, name: string, fallback: string, max: number) {
  for (let i=0;i<30;i++) {
    const slug = slugCandidate(name, i, fallback).slice(0,max);
    const table = fallback === "launch" ? "launches" : "startups";
    const { data } = await db.from(table).select("id").eq("slug",slug).maybeSingle();
    if (!data) return slug;
  }
  throw new Error(`Could not generate a unique slug for "${name}".`);
}

export async function applyJsonImportAction(fd: FormData) {
  const admin = await requireAdmin();
  const id = str(fd.get("id"));
  const db = createAdminClient();
  const { data: batch, error } = await db.from("admin_content_import_batches").select("*").eq("id",id).maybeSingle();
  if (error || !batch || !["preview","processing","partial","failed"].includes(batch.status)) throw new Error("This import is unavailable or has already been processed.");
  const parsed = batch.payload as Parsed;
  await db.from("admin_content_import_batches").update({ status: "processing" }).eq("id",id);
  const founderCache = new Map<string,string>();
  const startupRefs = new Map<string,string>();
  let imported = 0, failed = 0;
  const rows = [
    ...parsed.startups.map((row,i)=>({row,kind:"startup" as const,key:safeImportKey(row,i,"startup")})),
    ...parsed.launches.map((row,i)=>({row,kind:"launch" as const,key:safeImportKey(row,i,"launch")})),
  ];
  for (const item of rows) {
    const { data: stored } = await db.from("admin_content_import_items").select("id,status,entity_id").eq("batch_id",id).eq("item_type",item.kind).eq("import_key",item.key).maybeSingle();
    if (!stored) continue;
    if (stored.status === "imported") { if (item.kind === "startup" && stored.entity_id) startupRefs.set(item.key,stored.entity_id); continue; }
    if (stored.entity_id) {
      await db.from("admin_content_import_items").update({status:"imported",error:null}).eq("id",stored.id);
      if (item.kind === "startup") startupRefs.set(item.key,stored.entity_id);
      continue;
    }
    try {
      const founder = item.row.founder as Row;
      const founderId = await resolveFounder(db,emailOf(item.row),str(founder.display_name),founderCache);
      if (item.kind === "startup") {
        const categoryId = await resolveCategory(db,item.row.category);
        const country = str(item.row.country).toUpperCase();
        if (country && !/^[A-Z]{2}$/.test(country)) throw new Error("country must be a two-letter ISO country code, such as ET or KE.");
        const stage = str(item.row.stage);
        if (stage && !["idea","prototype","mvp","early_revenue","growth","scale"].includes(stage)) throw new Error("stage must be idea, prototype, mvp, early_revenue, growth or scale.");
        const name = str(item.row.name);
        const slug = await uniqueSlug(db,name,"startup",60);
        const fundingRound = str(item.row.funding_round);
        const fundraisingStatus = str(item.row.fundraising_status) || "not_raising";
        const fundingTarget = item.row.funding_target === undefined || item.row.funding_target === null || item.row.funding_target === "" ? null : Number(item.row.funding_target);
        const fundingCurrency = str(item.row.funding_currency).toUpperCase() || "USD";
        if (fundingRound && !["pre_seed","seed","series_a","series_b","series_c","growth","debt","grant","other"].includes(fundingRound)) throw new Error("Invalid funding_round.");
        if (!["not_raising","raising","open_to_conversations","closed"].includes(fundraisingStatus)) throw new Error("Invalid fundraising_status.");
        if (fundingTarget !== null && (!Number.isFinite(fundingTarget) || fundingTarget < 0)) throw new Error("funding_target must be a non-negative number.");
        if (!/^[A-Z]{3}$/.test(fundingCurrency)) throw new Error("funding_currency must be a three-letter currency code.");
        const { data, error } = await db.from("startups").insert({
          slug,name,tagline:str(item.row.tagline)||null,description:str(item.row.description)||null,
          website_url:str(item.row.website_url)||null,country:country||null,city:str(item.row.city)||null,
          stage:stage||null,founded_year:item.row.founded_year ? Number(item.row.founded_year) : null,
          problem_statement:str(item.row.problem_statement)||null,solution:str(item.row.solution)||null,
          target_customers:Array.isArray(item.row.target_customers)?item.row.target_customers:[],
          target_geographies:Array.isArray(item.row.target_geographies)?item.row.target_geographies:[],
          market_opportunity:str(item.row.market_opportunity)||null,business_model:str(item.row.business_model)||null,
          is_product_live:item.row.is_product_live===true,funding_round:fundingRound||null,fundraising_status:fundraisingStatus,
          funding_target:fundingTarget,funding_currency:fundingCurrency,
          category_id:categoryId,tags:Array.isArray(item.row.tags)?item.row.tags.map(str):[],status:"draft",created_by:founderId,
        }).select("id,slug").single();
        if (error || !data) throw new Error(error?.message ?? "Could not create startup.");
        startupRefs.set(item.key,data.id);
        await db.from("admin_content_import_items").update({entity_id:data.id,founder_id:founderId}).eq("id",stored.id);
        const links = Array.isArray(item.row.links) ? item.row.links as Row[] : [];
        for (const link of links) {
          const url=str(link.url), kind=str(link.kind)||"other";
          if (!validUrl(url) || !["website","twitter","linkedin","github","facebook","instagram","youtube","telegram","other"].includes(kind)) continue;
          await db.from("startup_links").insert({startup_id:data.id,kind,url,label:str(link.label)||null});
        }
        await db.from("admin_content_import_items").update({status:"imported",entity_id:data.id,founder_id:founderId,error:null}).eq("id",stored.id);
      } else {
        const categoryId = await resolveCategory(db,item.row.category);
        let startupId: string | null = null;
        const ref = str(item.row.startup_ref);
        if (ref) {
          startupId = startupRefs.get(ref) ?? null;
          if (!startupId) {
            const { data: existing } = await db.from("startups").select("id").eq("slug",ref).maybeSingle();
            if (!existing) throw new Error(`startup_ref "${ref}" was not found. Use an imported import_key or an existing startup slug.`);
            const { data: membership } = await db.from("startup_members").select("user_id").eq("startup_id",existing.id).eq("user_id",founderId).in("role",["owner","admin","editor"]).maybeSingle();
            if (!membership) throw new Error("The founder account must already have permission to manage the linked startup.");
            startupId=existing.id;
          }
          const { data: linkedMembership } = await db.from("startup_members").select("user_id").eq("startup_id",startupId).eq("user_id",founderId).in("role",["owner","admin","editor"]).maybeSingle();
          if (!linkedMembership) throw new Error("The launch founder must have permission to manage the linked startup.");
        }
        const name=str(item.row.name), slug=await uniqueSlug(db,name,"launch",80);
        const { data,error } = await db.from("launches").insert({
          slug,name,tagline:str(item.row.tagline),description:str(item.row.description)||null,
          product_url:str(item.row.product_url),demo_video_url:str(item.row.demo_video_url)||null,
          category_id:categoryId,tags:Array.isArray(item.row.tags)?item.row.tags.map(str):[],
          startup_id:startupId,submitted_by:founderId,status:"draft",
          launch_date:str(item.row.launch_date)||null,
        }).select("id,slug").single();
        if(error||!data) throw new Error(error?.message??"Could not create launch.");
        await db.from("admin_content_import_items").update({entity_id:data.id,founder_id:founderId}).eq("id",stored.id);
        await db.from("admin_content_import_items").update({status:"imported",entity_id:data.id,founder_id:founderId,error:null}).eq("id",stored.id);
      }
      imported++;
    } catch (error) {
      failed++;
      const message = error instanceof Error ? error.message.slice(0,500) : "Import failed.";
      await db.from("admin_content_import_items").update({status:"failed",error:message}).eq("id",stored.id);
    }
  }
  const { count: importedTotal } = await db.from("admin_content_import_items").select("id",{count:"exact",head:true}).eq("batch_id",id).eq("status","imported");
  const { count: failedTotal } = await db.from("admin_content_import_items").select("id",{count:"exact",head:true}).eq("batch_id",id).eq("status","failed");
  const status = (failedTotal??0) ? ((importedTotal??0) ? "partial" : "failed") : "processed";
  await db.from("admin_content_import_batches").update({status,imported_count:importedTotal??0,error_count:failedTotal??0,processed_at:new Date().toISOString()}).eq("id",id);
  await writeAuditLog({actorId:admin.id,action:"content_import.process",entityType:"content_import_batch",entityId:id,metadata:{imported,failed}});
  revalidatePath("/admin/imports"); revalidatePath("/admin/startups"); revalidatePath("/admin/launches"); revalidatePath("/dashboard/startups"); revalidatePath("/dashboard/launches");
  redirect(`/admin/imports?batch=${id}`);
}

export async function uploadImportedImageAction(fd: FormData) {
  const admin = await requireAdmin();
  const entityType = str(fd.get("entityType"));
  const entityId = str(fd.get("entityId"));
  const kind = str(fd.get("kind"));
  if (!/^[0-9a-f-]{36}$/i.test(entityId) || !["startup","launch"].includes(entityType)) throw new Error("Invalid imported record.");
  const file = fd.get("image");
  const check = await checkImageFile(file instanceof File ? file : null, entityType === "startup" ? 2*1024*1024 : 4*1024*1024);
  if (!check.ok) throw new Error(check.error);
  const db = createAdminClient();
  const table = entityType === "startup" ? "startups" : "launches";
  const { data: record } = await db.from(table).select("id").eq("id",entityId).maybeSingle();
  if (!record) throw new Error("Record not found.");
  if (entityType === "launch" && kind !== "logo") {
    const { count } = await db.from("launch_media").select("id",{count:"exact",head:true}).eq("launch_id",entityId);
    if ((count ?? 0) >= 6) throw new Error("A launch can have up to six screenshots.");
  }
  const bucket = entityType === "startup" ? "startup-media" : "launch-media";
  const path = `${entityId}/admin-import-${crypto.randomUUID()}.${check.extension}`;
  const { error: uploadError } = await db.storage.from(bucket).upload(path,check.bytes,{contentType:check.contentType,upsert:false,cacheControl:"31536000"});
  if(uploadError) throw new Error(`Image upload failed: ${uploadError.message}`);
  const url=db.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  if(entityType==="startup") {
    if(kind==="logo") {
      const {error}=await db.from("startups").update({logo_url:url}).eq("id",entityId);
      if(error) throw new Error("Could not attach startup logo.");
      await db.from("startup_media").insert({startup_id:entityId,kind:"logo",storage_path:path,url,alt_text:"Startup logo",sort_order:0});
    } else {
      const {error}=await db.from("startup_media").insert({startup_id:entityId,kind:"gallery",storage_path:path,url,alt_text:"Startup image",sort_order:99});
      if(error) throw new Error("Could not attach startup image.");
    }
  } else if(kind==="logo") {
    const {error}=await db.from("launches").update({logo_url:url}).eq("id",entityId);
    if(error) throw new Error("Could not attach launch logo.");
  } else {
    const {error}=await db.from("launch_media").insert({launch_id:entityId,storage_path:path,url,alt_text:"Launch screenshot",sort_order:99});
    if(error) throw new Error("Could not attach launch screenshot.");
  }
  await writeAuditLog({actorId:admin.id,action:"content_import.image_upload",entityType,entityId,metadata:{kind,path}});
  revalidatePath("/admin/imports"); revalidatePath("/admin/startups"); revalidatePath("/admin/launches");
  revalidatePath(entityType==="startup"?"/startups":"/launches","layout");
}

export async function updateImportedDetailsAction(fd: FormData) {
  const admin = await requireAdmin();
  const entityType = str(fd.get("entityType"));
  const entityId = str(fd.get("entityId"));
  if (!/^[0-9a-f-]{36}$/i.test(entityId) || !["startup","launch"].includes(entityType)) throw new Error("Invalid imported record.");
  const db = createAdminClient();
  if (entityType === "startup") {
    const country = str(fd.get("country")).toUpperCase();
    const stage = str(fd.get("stage"));
    const year = str(fd.get("founded_year"));
    const categoryId = await resolveCategory(db,fd.get("category"));
    const fundingRound = str(fd.get("funding_round"));
    const fundraisingStatus = str(fd.get("fundraising_status")) || "not_raising";
    const fundingCurrency = str(fd.get("funding_currency")).toUpperCase() || "USD";
    const target = str(fd.get("funding_target"));
    if (country && !/^[A-Z]{2}$/.test(country)) throw new Error("Country must be a two-letter ISO code.");
    if (stage && !["idea","prototype","mvp","early_revenue","growth","scale"].includes(stage)) throw new Error("Invalid startup stage.");
    if (year && (!/^\\d{4}$/.test(year) || Number(year)<1900 || Number(year)>2100)) throw new Error("Founded year must be between 1900 and 2100.");
    if (fundingRound && !["pre_seed","seed","series_a","series_b","series_c","growth","debt","grant","other"].includes(fundingRound)) throw new Error("Invalid funding round.");
    if (!["not_raising","raising","open_to_conversations","closed"].includes(fundraisingStatus)) throw new Error("Invalid fundraising status.");
    if (!/^[A-Z]{3}$/.test(fundingCurrency)) throw new Error("Funding currency must be a three-letter code.");
    const fundingTarget = target ? Number(target) : null;
    if (fundingTarget !== null && (!Number.isFinite(fundingTarget) || fundingTarget < 0)) throw new Error("Funding target must be a non-negative number.");
    const patch = {
      tagline:str(fd.get("tagline"))||null,description:str(fd.get("description"))||null,
      website_url:str(fd.get("website_url"))||null,country:country||null,city:str(fd.get("city"))||null,
      stage:stage||null,founded_year:year?Number(year):null,category_id:categoryId,
      problem_statement:str(fd.get("problem_statement"))||null,solution:str(fd.get("solution"))||null,
      target_customers:str(fd.get("target_customers")).split(",").map(x=>x.trim()).filter(Boolean).slice(0,12),
      target_geographies:str(fd.get("target_geographies")).split(",").map(x=>x.trim()).filter(Boolean).slice(0,12),
      market_opportunity:str(fd.get("market_opportunity"))||null,business_model:str(fd.get("business_model"))||null,
      is_product_live:fd.get("is_product_live")==="on",funding_round:fundingRound||null,
      fundraising_status:fundraisingStatus,funding_target:fundingTarget,funding_currency:fundingCurrency,
    };
    if (patch.tagline && patch.tagline.length>160) throw new Error("Tagline cannot exceed 160 characters.");
    if (patch.description && patch.description.length>5000) throw new Error("Description cannot exceed 5,000 characters.");
    if (patch.problem_statement && patch.problem_statement.length>3000) throw new Error("Problem statement cannot exceed 3,000 characters.");
    if (patch.solution && patch.solution.length>3000) throw new Error("Solution cannot exceed 3,000 characters.");
    if (patch.market_opportunity && patch.market_opportunity.length>3000) throw new Error("Market opportunity cannot exceed 3,000 characters.");
    if (patch.business_model && patch.business_model.length>80) throw new Error("Business model cannot exceed 80 characters.");
    if (patch.website_url && !validUrl(patch.website_url)) throw new Error("Website must be an HTTP(S) URL.");
    const {error}=await db.from("startups").update(patch).eq("id",entityId);
    if(error) throw new Error("Could not update startup details.");
  } else {
    const tagline=str(fd.get("tagline")), description=str(fd.get("description")), productUrl=str(fd.get("product_url")), video=str(fd.get("demo_video_url"));
    if(tagline.length<5||tagline.length>160) throw new Error("Launch tagline must be 5–160 characters.");
    if(description.length>5000) throw new Error("Launch description cannot exceed 5,000 characters.");
    if(!validUrl(productUrl)) throw new Error("Product URL must be an HTTP(S) URL.");
    if(video&&!validUrl(video)) throw new Error("Demo video URL must be an HTTP(S) URL.");
    const categoryId=await resolveCategory(db,fd.get("category"));
    const tags=str(fd.get("tags")).split(",").map(x=>x.trim()).filter(Boolean).slice(0,12);
    if(tags.some(x=>x.length>30)) throw new Error("Each launch tag must be 30 characters or fewer.");
    const launchDate=str(fd.get("launch_date"));
    if(launchDate&&!/^\\d{4}-\\d{2}-\\d{2}$/.test(launchDate)) throw new Error("Launch date must use YYYY-MM-DD.");
    const {error}=await db.from("launches").update({tagline,description:description||null,product_url:productUrl,demo_video_url:video||null,category_id:categoryId,tags,launch_date:launchDate||null}).eq("id",entityId);
    if(error) throw new Error("Could not update launch details.");
  }
  await writeAuditLog({actorId:admin.id,action:"content_import.complete_details",entityType,entityId});
  revalidatePath("/admin/imports"); revalidatePath("/admin/startups"); revalidatePath("/admin/launches");
}

export async function submitImportedRecordForReviewAction(fd: FormData) {
  const admin = await requireAdmin();
  const entityType = str(fd.get("entityType"));
  const entityId = str(fd.get("entityId"));
  if (!/^[0-9a-f-]{36}$/i.test(entityId) || !["startup","launch"].includes(entityType)) throw new Error("Invalid imported record.");
  const db = createAdminClient();
  if (entityType === "startup") {
    const { data: startup } = await db.from("startups").select("id,status,tagline,description,country,category_id,created_by").eq("id",entityId).maybeSingle();
    if (!startup || startup.status !== "draft") throw new Error("Only an imported startup draft can be submitted.");
    if (!startup.created_by || !startup.tagline?.trim() || !startup.description?.trim() || !startup.country || !startup.category_id) throw new Error("Complete the startup tagline, description, country and category before review.");
    const { data: founder } = await db.auth.admin.getUserById(startup.created_by);
    if (!founder.user?.email_confirmed_at) throw new Error("The founder must verify their email before this startup can enter review.");
    const { error } = await db.from("startups").update({status:"pending_review"}).eq("id",entityId).eq("status","draft");
    if (error) throw new Error("Could not submit startup for review.");
  } else {
    const { data: launch } = await db.from("launches").select("id,status,tagline,description,category_id,submitted_by").eq("id",entityId).maybeSingle();
    if (!launch || launch.status !== "draft") throw new Error("Only an imported launch draft can be submitted.");
    if (!launch.submitted_by || !launch.tagline?.trim() || !launch.description?.trim() || !launch.category_id) throw new Error("Complete the launch tagline, description and category before review.");
    const { data: founder } = await db.auth.admin.getUserById(launch.submitted_by);
    if (!founder.user?.email_confirmed_at) throw new Error("The founder must verify their email before this launch can enter review.");
    const { error } = await db.from("launches").update({status:"pending_review"}).eq("id",entityId).eq("status","draft");
    if (error) throw new Error("Could not submit launch for review.");
  }
  await writeAuditLog({actorId:admin.id,action:"content_import.submit_for_review",entityType,entityId});
  revalidatePath("/admin/imports"); revalidatePath("/admin/startups"); revalidatePath("/admin/launches"); revalidatePath("/admin");
}

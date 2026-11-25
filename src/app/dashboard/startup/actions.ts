"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireActiveProfile } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";
import { createLogger } from "@/lib/logger";
import { canEditStartup, canPublishStartup } from "@/lib/permissions";
import { slugCandidate } from "@/lib/slug";
import { checkImageFile, storagePathFromPublicUrl } from "@/lib/uploads";
import { getManagedStartup } from "@/lib/startups/queries";
import { LIMITS } from "@/lib/startups/constants";
import { flattenErrors, formDataToObject, httpUrl } from "@/lib/validation/common";
import {
  createStartupSchema, galleryAltSchema, linkSchema, productSchema, publicationSchema, slugSchema, updateStartupSchema, uuidField,
} from "@/lib/validation/startup";
import type { ActionState } from "@/lib/types";
import { evaluateStartupEnrichmentProgress } from "@/app/dashboard/startup/intelligence-actions";

const log = createLogger("startup-actions");
const NO_ACCESS: ActionState = { status: "error", message: "You don’t have access to change this startup." };
const GENERIC: ActionState = { status: "error", message: "Something went wrong. Please try again." };
const LOGO_MAX = 2 * 1024 * 1024;
const GALLERY_MAX = 4 * 1024 * 1024;

const refresh = (startupId: string) => revalidatePath(`/dashboard/startup/${startupId}`, "layout");

/** Translate common Postgres/PostgREST failures into actionable, non-sensitive guidance. */
function startupSaveError(code?: string): string {
  switch (code) {
    case "42703":
    case "PGRST204":
      return "Buna’s database is missing a field required by this form. The database schema needs to be brought up to date.";
    case "23514":
      return "One of these answers does not meet Buna’s data requirements. Check the highlighted values and try again.";
    case "23502":
      return "A required value is missing. Check the required fields and try again.";
    case "22P02":
      return "One of the values has an invalid format. Check the highlighted fields and try again.";
    case "42501":
      return "Buna could not confirm your permission to edit this startup. Refresh the page and try again.";
    case "23503":
      return "One of the selected options is no longer available. Refresh the page, choose it again, and save.";
    default:
      return "Buna couldn’t save this profile. Your startup remains a draft; refresh and try again. If it continues, contact support with the time of the failed save.";
  }
}

/** Resolves the signed-in, non-suspended user's editable startup, or null when they have no edit rights. */
async function editable(startupId: string) {
  const profile = await requireActiveProfile();
  const managed = await getManagedStartup(startupId, profile.id);
  if (!managed || !canEditStartup(managed.role)) return null;
  return { profile, managed };
}

// ---------- create ----------
export async function createStartupAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireActiveProfile();
  const raw = formDataToObject(formData);
  const values = { name: String(raw.name ?? ""), tagline: String(raw.tagline ?? ""), categoryId: String(raw.categoryId ?? ""), country: String(raw.country ?? ""), city: String(raw.city ?? "") };
  const parsed = createStartupSchema.safeParse(raw);
  if (!parsed.success) return { status: "error", fieldErrors: flattenErrors(parsed.error), values };
  if (!(await rateLimit(`startup:create:${profile.id}`, 10, 86400))) {
    return { status: "error", message: "You’ve created several startups today. Please try again tomorrow.", values };
  }

  const d = parsed.data;
  const supabase = await createClient();
  let createdId: string | null = null;
  for (let attempt = 0; attempt < 8 && !createdId; attempt++) {
    const { data, error } = await supabase
      .from("startups")
      .insert({ name: d.name, slug: slugCandidate(d.name, attempt), tagline: d.tagline, category_id: d.categoryId, country: d.country, city: d.city, created_by: profile.id })
      .select("id")
      .single();
    if (data) createdId = data.id as string;
    else if (error?.code === "23505") continue; // slug taken or reserved: try the next candidate
    else {
      log.error("create startup failed", error, { code: error?.code });
      return { status: "error", message: "We couldn’t create the startup. Please try again.", values };
    }
  }
  if (!createdId) return { status: "error", fieldErrors: { name: ["Try a more distinctive name — its web address is already in use."] }, values };
  redirect(`/dashboard/startup/${createdId}`);
}

// ---------- edit profile ----------
export async function updateStartupAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const raw = formDataToObject(formData);
  const echo = (k: string) => String(raw[k] ?? "");
  const values = { name: echo("name"), tagline: echo("tagline"), description: echo("description"), problemStatement: echo("problemStatement"), solution: echo("solution"), targetCustomers: echo("targetCustomers"), targetGeographies: echo("targetGeographies"), marketOpportunity: echo("marketOpportunity"), businessModel: echo("businessModel"), fundingRound: echo("fundingRound"), fundraisingStatus: echo("fundraisingStatus"), fundingTarget: echo("fundingTarget"), fundingCurrency: echo("fundingCurrency"), websiteUrl: echo("websiteUrl"), country: echo("country"), city: echo("city"), categoryId: echo("categoryId"), stage: echo("stage"), foundedYear: echo("foundedYear"), tags: echo("tags") };
  const parsed = updateStartupSchema.safeParse(raw);
  if (!parsed.success) return { status: "error", fieldErrors: flattenErrors(parsed.error), values, message: "Fix the highlighted fields and save again." };
  const ctx = await editable(parsed.data.startupId);
  if (!ctx) return NO_ACCESS;

  const d = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("startups")
    .update({ name: d.name, tagline: d.tagline, description: d.description, problem_statement: d.problemStatement, solution: d.solution, target_customers: d.targetCustomers, target_geographies: d.targetGeographies, market_opportunity: d.marketOpportunity, business_model: d.businessModel, funding_round: d.fundingRound || null, fundraising_status: d.fundraisingStatus, funding_target: d.fundingTarget, funding_currency: d.fundingCurrency, website_url: d.websiteUrl, country: d.country, city: d.city, category_id: d.categoryId, stage: d.stage, founded_year: d.foundedYear, tags: d.tags })
    .eq("id", d.startupId)
    .select("id")
    .maybeSingle();
  if (error) {
    log.error("update startup failed", error, { code: error.code });
    return { status: "error", message: startupSaveError(error.code), values };
  }
  if (!data) return NO_ACCESS;
  refresh(d.startupId);
  revalidatePath(`/startups/${ctx.managed.startup.slug}`);
  await evaluateStartupEnrichmentProgress(ctx.profile.id, d.startupId);
  return { status: "success", message: "Saved." };
}

// ---------- logo ----------
export async function uploadLogoAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = uuidField.safeParse(formData.get("startupId"));
  if (!id.success) return GENERIC;
  const ctx = await editable(id.data);
  if (!ctx) return NO_ACCESS;
  if (!(await rateLimit(`upload:${ctx.profile.id}`, 20, 3600))) return { status: "error", message: "You’ve uploaded a lot of images recently. Please try again later." };

  const file = formData.get("logo");
  const check = await checkImageFile(file instanceof File ? file : null, LOGO_MAX);
  if (!check.ok) return { status: "error", message: check.error };

  const supabase = await createClient();
  const path = `${id.data}/logo-${crypto.randomUUID()}.${check.extension}`;
  const { error: upErr } = await supabase.storage.from("startup-media").upload(path, check.bytes, { contentType: check.contentType, upsert: false, cacheControl: "31536000" });
  if (upErr) {
    log.error("logo upload failed", upErr);
    return { status: "error", message: "The upload failed. Check your connection and try again." };
  }
  const { data: pub } = supabase.storage.from("startup-media").getPublicUrl(path);
  const { error: dbErr } = await supabase.from("startups").update({ logo_url: pub.publicUrl }).eq("id", id.data);
  if (dbErr) {
    await supabase.storage.from("startup-media").remove([path]);
    log.error("logo url update failed", dbErr);
    return { status: "error", message: "We couldn’t save the new logo. Please try again." };
  }
  const old = storagePathFromPublicUrl(ctx.managed.startup.logo_url, "startup-media");
  if (old && old !== path) await supabase.storage.from("startup-media").remove([old]);
  refresh(id.data);
  revalidatePath(`/startups/${ctx.managed.startup.slug}`);
  return { status: "success", message: "Logo updated." };
}

export async function setLogoFromUrlAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = uuidField.safeParse(formData.get("startupId"));
  if (!id.success) return GENERIC;
  const ctx = await editable(id.data);
  if (!ctx) return NO_ACCESS;

  const parsedUrl = httpUrl.safeParse(String(formData.get("logoUrl") ?? ""));
  if (!parsedUrl.success) return { status: "error", message: parsedUrl.error.issues[0]?.message ?? "Enter a valid image link." };
  let imageUrl: URL;
  try {
    imageUrl = new URL(parsedUrl.data);
  } catch {
    return { status: "error", message: "Enter a valid image link starting with https://." };
  }
  if (imageUrl.username || imageUrl.password || imageUrl.hostname === "localhost" || imageUrl.hostname.endsWith(".local")) {
    return { status: "error", message: "Use a public image link." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("startups").update({ logo_url: parsedUrl.data }).eq("id", id.data);
  if (error) {
    log.error("logo URL update failed", error);
    return { status: "error", message: "We couldn’t save that image link. Please try again." };
  }
  const old = storagePathFromPublicUrl(ctx.managed.startup.logo_url, "startup-media");
  if (old) await supabase.storage.from("startup-media").remove([old]);
  refresh(id.data);
  revalidatePath(`/startups/${ctx.managed.startup.slug}`);
  return { status: "success", message: "Image link saved. Use a direct link to an image file or image CDN." };
}

export async function removeLogoAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = uuidField.safeParse(formData.get("startupId"));
  if (!id.success) return GENERIC;
  const ctx = await editable(id.data);
  if (!ctx) return NO_ACCESS;
  const supabase = await createClient();
  const { error } = await supabase.from("startups").update({ logo_url: null }).eq("id", id.data);
  if (error) return GENERIC;
  const old = storagePathFromPublicUrl(ctx.managed.startup.logo_url, "startup-media");
  if (old) await supabase.storage.from("startup-media").remove([old]);
  refresh(id.data);
  revalidatePath(`/startups/${ctx.managed.startup.slug}`);
  return { status: "success", message: "Logo removed." };
}

// ---------- gallery ----------
export async function addGalleryImageAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = galleryAltSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return { status: "error", fieldErrors: flattenErrors(parsed.error) };
  const ctx = await editable(parsed.data.startupId);
  if (!ctx) return NO_ACCESS;
  if (!(await rateLimit(`upload:${ctx.profile.id}`, 20, 3600))) return { status: "error", message: "You’ve uploaded a lot of images recently. Please try again later." };

  const file = formData.get("image");
  const check = await checkImageFile(file instanceof File ? file : null, GALLERY_MAX);
  if (!check.ok) return { status: "error", message: check.error };

  const supabase = await createClient();
  const path = `${parsed.data.startupId}/gallery-${crypto.randomUUID()}.${check.extension}`;
  const { error: upErr } = await supabase.storage.from("startup-media").upload(path, check.bytes, { contentType: check.contentType, upsert: false, cacheControl: "31536000" });
  if (upErr) {
    log.error("gallery upload failed", upErr);
    return { status: "error", message: "The upload failed. Check your connection and try again." };
  }
  const { data: pub } = supabase.storage.from("startup-media").getPublicUrl(path);
  const { error: dbErr } = await supabase.from("startup_media").insert({ startup_id: parsed.data.startupId, kind: "gallery", storage_path: path, url: pub.publicUrl, alt_text: parsed.data.altText });
  if (dbErr) {
    await supabase.storage.from("startup-media").remove([path]);
    if (dbErr.code === "54000") return { status: "error", message: `You can add up to ${LIMITS.gallery} screenshots. Remove one first.` };
    log.error("gallery insert failed", dbErr, { code: dbErr.code });
    return GENERIC;
  }
  refresh(parsed.data.startupId);
  return { status: "success", message: "Screenshot added." };
}

export async function removeGalleryImageAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = uuidField.safeParse(formData.get("startupId"));
  const mediaId = uuidField.safeParse(formData.get("mediaId"));
  if (!id.success || !mediaId.success) return GENERIC;
  const ctx = await editable(id.data);
  if (!ctx) return NO_ACCESS;
  const supabase = await createClient();
  const { data, error } = await supabase.from("startup_media").delete().eq("id", mediaId.data).eq("startup_id", id.data).select("storage_path").maybeSingle();
  if (error || !data) return GENERIC;
  await supabase.storage.from("startup-media").remove([data.storage_path as string]);
  refresh(id.data);
  return { status: "success", message: "Screenshot removed." };
}

// ---------- products ----------
export async function saveProductAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const raw = formDataToObject(formData);
  const values = { name: String(raw.name ?? ""), description: String(raw.description ?? ""), url: String(raw.url ?? "") };
  const parsed = productSchema.safeParse(raw);
  if (!parsed.success) return { status: "error", fieldErrors: flattenErrors(parsed.error), values };
  const ctx = await editable(parsed.data.startupId);
  if (!ctx) return NO_ACCESS;

  const d = parsed.data;
  const supabase = await createClient();
  const file = formData.get("file");
  const allowed = ["application/pdf","image/jpeg","image/png","image/webp","text/plain","application/zip"];
  let uploadedPath: string | null = null;
  let fileName: string | null = null;
  let mimeType: string | null = null;
  let fileSize: number | null = null;
  let publicUrl: string | null = null;
  let previous: { storage_path: string | null; url: string | null; file_name: string | null; file_size: number | null; mime_type: string | null } | null = null;

  if (d.productId) {
    const { data } = await supabase.from("startup_products").select("storage_path,url,file_name,file_size,mime_type").eq("id",d.productId).eq("startup_id",d.startupId).maybeSingle();
    previous = data as { storage_path: string | null; url: string | null; file_name: string | null; file_size: number | null; mime_type: string | null } | null;
    if (!previous) return { ...GENERIC, values };
  }

  if (d.contentType === "file_upload") {
    if (file instanceof File && file.size > 0) {
      if (!allowed.includes(file.type) || file.size > 20 * 1024 * 1024) {
        return { status:"error", message:"Upload a PDF, image, text file or ZIP no larger than 20 MB.", values };
      }
      fileName = file.name.replace(/[\\/\\\\]/g,"_").replace(/[^a-zA-Z0-9._-]/g,"_").slice(-120) || "product-file";
      mimeType = file.type;
      fileSize = file.size;
      uploadedPath = `${d.startupId}/product-${crypto.randomUUID()}-${fileName}`;
      const { error: uploadError } = await supabase.storage.from("startup-product-files").upload(uploadedPath,file,{contentType:file.type,upsert:false,cacheControl:"31536000"});
      if (uploadError) {
        log.error("product file upload failed",uploadError);
        return { status:"error",message:"The product file could not be uploaded. Please try again.",values };
      }
      publicUrl = supabase.storage.from("startup-product-files").getPublicUrl(uploadedPath).data.publicUrl;
    } else if (!d.productId || !previous?.storage_path) {
      return { status:"error",message:"Choose a file to upload.",values };
    }
  }

  const storagePath = d.contentType === "file_upload" ? (uploadedPath ?? previous?.storage_path ?? null) : null;
  const payload = {
    name:d.name,description:d.description,url:d.contentType==="file_upload" ? (publicUrl ?? previous?.url ?? null) : d.url,
    content_type:d.contentType,storage_path:storagePath,
    file_name:fileName ?? (d.contentType==="file_upload" ? previous?.file_name : null),
    file_size:fileSize ?? (d.contentType==="file_upload" ? previous?.file_size : null),
    mime_type:mimeType ?? (d.contentType==="file_upload" ? previous?.mime_type : null)
  };
  if (d.productId) {
    const { data,error } = await supabase.from("startup_products").update(payload).eq("id",d.productId).eq("startup_id",d.startupId).select("id").maybeSingle();
    if (error || !data) {
      if(uploadedPath) await supabase.storage.from("startup-product-files").remove([uploadedPath]);
      log.error("product update failed",error);
      return { ...GENERIC, values };
    }
  } else {
    const { error } = await supabase.from("startup_products").insert({startup_id:d.startupId,...payload});
    if (error) {
      if(uploadedPath) await supabase.storage.from("startup-product-files").remove([uploadedPath]);
      if (error.code === "54000") return { status:"error",message:`You can list up to ${LIMITS.products} products. Remove one first.`,values };
      log.error("product insert failed",error,{code:error.code});
      return { ...GENERIC, values };
    }
  }
  if(previous?.storage_path && previous.storage_path !== storagePath) {
    await supabase.storage.from("startup-product-files").remove([previous.storage_path]);
  }
  refresh(d.startupId);
  return { status:"success",message:d.productId?"Product saved.":"Product added.",values:{} };
}

export async function deleteProductAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = uuidField.safeParse(formData.get("startupId"));
  const productId = uuidField.safeParse(formData.get("productId"));
  if (!id.success || !productId.success) return GENERIC;
  if (!(await editable(id.data))) return NO_ACCESS;
  const supabase = await createClient();
  const { data: product } = await supabase.from("startup_products").select("storage_path").eq("id",productId.data).eq("startup_id",id.data).maybeSingle();
  const { error } = await supabase.from("startup_products").delete().eq("id", productId.data).eq("startup_id", id.data);
  if (error) return GENERIC;
  if (product?.storage_path) await supabase.storage.from("startup-product-files").remove([product.storage_path as string]);
  refresh(id.data);
  return { status: "success", message: "Product removed." };
}

// ---------- links ----------
export async function addLinkAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const raw = formDataToObject(formData);
  const values = { kind: String(raw.kind ?? ""), url: String(raw.url ?? ""), label: String(raw.label ?? "") };
  const parsed = linkSchema.safeParse(raw);
  if (!parsed.success) return { status: "error", fieldErrors: flattenErrors(parsed.error), values };
  if (!(await editable(parsed.data.startupId))) return NO_ACCESS;
  const supabase = await createClient();
  const { error } = await supabase.from("startup_links").insert({ startup_id: parsed.data.startupId, kind: parsed.data.kind, url: parsed.data.url, label: parsed.data.label });
  if (error) {
    if (error.code === "54000") return { status: "error", message: `You can add up to ${LIMITS.links} links. Remove one first.`, values };
    if (error.code === "23505") return { status: "error", fieldErrors: { url: ["That link is already on your profile."] }, values };
    log.error("link insert failed", error, { code: error.code });
    return { ...GENERIC, values };
  }
  refresh(parsed.data.startupId);
  return { status: "success", message: "Link added.", values: {} };
}

export async function deleteLinkAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = uuidField.safeParse(formData.get("startupId"));
  const linkId = uuidField.safeParse(formData.get("linkId"));
  if (!id.success || !linkId.success) return GENERIC;
  if (!(await editable(id.data))) return NO_ACCESS;
  const supabase = await createClient();
  const { error } = await supabase.from("startup_links").delete().eq("id", linkId.data).eq("startup_id", id.data);
  if (error) return GENERIC;
  refresh(id.data);
  return { status: "success", message: "Link removed." };
}

// ---------- publishing ----------
function publicationError(message: string): string {
  if (message.includes("email_not_verified")) return "Confirm your email address before publishing.";
  if (message.includes("profile_incomplete")) return "Finish the checklist first: a one-line description, an about section, a sector and a country.";
  if (message.includes("account_suspended")) return "Your account is suspended, so you can’t publish.";
  if (message.includes("blocked_by_moderation")) return "This startup was removed or rejected by the Buna team and can’t be republished. Contact support.";
  if (message.includes("forbidden")) return "Only an owner or admin of this startup can publish it.";
  return "We couldn’t change the publication status. Please try again.";
}

export async function setPublicationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = publicationSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return GENERIC;
  const profile = await requireActiveProfile();
  const managed = await getManagedStartup(parsed.data.startupId, profile.id);
  if (!managed || !canPublishStartup(managed.role)) return { status: "error", message: "Only an owner or admin of this startup can change publication." };

  const supabase = await createClient();
  // The database function re-checks ownership, suspension, email verification and completeness.
  const { data, error } = await supabase.rpc("set_startup_publication", { p_startup_id: parsed.data.startupId, p_publish: parsed.data.publish });
  if (error) {
    if (!/email_not_verified|profile_incomplete|account_suspended|blocked_by_moderation|forbidden/.test(error.message)) log.error("publication rpc failed", error, { code: error.code });
    return { status: "error", message: publicationError(error.message) };
  }
  refresh(parsed.data.startupId);
  revalidatePath("/startups");
  revalidatePath("/");
  revalidatePath(`/startups/${managed.startup.slug}`);
  const status = String(data);
  return {
    status: "success",
    message: status === "published" ? "Your startup is live." : status === "pending_review" ? "Submitted for review. It goes live once the Buna team approves it." : "Your startup is no longer public.",
  };
}

// ---------- public address ----------
export async function changeSlugAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const raw = formDataToObject(formData);
  const values = { slug: String(raw.slug ?? "") };
  const parsed = slugSchema.safeParse(raw);
  if (!parsed.success) return { status: "error", fieldErrors: flattenErrors(parsed.error), values };
  const ctx = await editable(parsed.data.startupId);
  if (!ctx) return NO_ACCESS;
  if (!canPublishStartup(ctx.managed.role)) return { status: "error", message: "Only an owner or admin can change the public address." };
  const oldSlug = ctx.managed.startup.slug;
  if (parsed.data.slug === oldSlug) return { status: "success", message: "That’s already your address.", values };

  const supabase = await createClient();
  const { data, error } = await supabase.from("startups").update({ slug: parsed.data.slug }).eq("id", parsed.data.startupId).select("id").maybeSingle();
  if (error) {
    if (error.code === "23505") return { status: "error", fieldErrors: { slug: ["That address is already taken or reserved. Try another."] }, values };
    log.error("slug change failed", error, { code: error.code });
    return { ...GENERIC, values };
  }
  if (!data) return NO_ACCESS;
  refresh(parsed.data.startupId);
  revalidatePath(`/startups/${oldSlug}`);
  revalidatePath(`/startups/${parsed.data.slug}`);
  return { status: "success", message: `Address changed. Links to /startups/${oldSlug} will keep redirecting here.`, values };
}

// ---------- delete (never-published drafts only) ----------
export async function deleteDraftStartupAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = uuidField.safeParse(formData.get("startupId"));
  if (!id.success) return GENERIC;
  const profile = await requireActiveProfile();
  const managed = await getManagedStartup(id.data, profile.id);
  if (!managed || managed.role !== "owner") return { status: "error", message: "Only the owner can delete a startup." };
  const supabase = await createClient();
  // RLS only permits owners to delete startups that are still drafts.
  const { data, error } = await supabase.from("startups").delete().eq("id", id.data).eq("status", "draft").select("id").maybeSingle();
  if (error || !data) return { status: "error", message: "Only startups that have never been published can be deleted." };
  revalidatePath("/dashboard/startup");
  redirect("/dashboard/startup");
}

"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireActiveProfile } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";
import { createLogger } from "@/lib/logger";
import { slugCandidate } from "@/lib/slug";
import { checkImageFile, storagePathFromPublicUrl } from "@/lib/uploads";
import { uploadPublicImage } from "@/lib/uploads-server";
import { getManagedLaunch } from "@/lib/launches/queries";
import { LAUNCH_LIMITS } from "@/lib/launches/constants";
import { dispatchNotificationEmails } from "@/lib/notifications/dispatch";
import { flattenErrors, formDataToObject } from "@/lib/validation/common";
import { createLaunchSchema, launchAltSchema, launchIdSchema, updateLaunchSchema } from "@/lib/validation/launch";
import type { ActionState } from "@/lib/types";

const log = createLogger("launch-manage");
const NO_ACCESS: ActionState = { status: "error", message: "You don’t have access to change this launch." };
const GENERIC: ActionState = { status: "error", message: "Something went wrong. Please try again." };
const BUCKET = "launch-media";
const LOGO_MAX = 2 * 1024 * 1024;
const SHOT_MAX = 4 * 1024 * 1024;
const refresh = (id: string) => { revalidatePath(`/dashboard/launches/${id}`); revalidatePath("/dashboard/launches"); };

async function editable(launchId: string) {
  const profile = await requireActiveProfile();
  const launch = await getManagedLaunch(launchId, profile.id);
  return launch ? { profile, launch } : null;
}

const echo = (raw: Record<string, unknown>) => {
  const s = (k: string) => String(raw[k] ?? "");
  return { name: s("name"), tagline: s("tagline"), productUrl: s("productUrl"), description: s("description"), startupId: s("startupId"), categoryId: s("categoryId"), tags: s("tags"), launchDate: s("launchDate"), demoVideoUrl: s("demoVideoUrl") };
};

export async function createLaunchAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireActiveProfile();
  const raw = formDataToObject(formData);
  const values = echo(raw);
  const parsed = createLaunchSchema.safeParse(raw);
  if (!parsed.success) return { status: "error", fieldErrors: flattenErrors(parsed.error), values };
  if (!(await rateLimit(`launch:create:${profile.id}`, 10, 86400))) return { status: "error", message: "You’ve created several launches today. Please try again tomorrow.", values };

  const d = parsed.data;
  const supabase = await createClient();
  let createdId: string | null = null;
  for (let attempt = 0; attempt < 8 && !createdId; attempt++) {
    const { data, error } = await supabase.from("launches").insert({
      slug: slugCandidate(d.name, attempt, "launch"), name: d.name, tagline: d.tagline, product_url: d.productUrl, description: d.description,
      startup_id: d.startupId, category_id: d.categoryId, tags: d.tags, launch_date: d.launchDate, demo_video_url: d.demoVideoUrl, submitted_by: profile.id,
    }).select("id").single();
    if (data) createdId = data.id as string;
    else if (error?.code === "23505") continue;
    else if (error?.code === "42501") return { status: "error", fieldErrors: { startupId: ["You can only launch on behalf of a startup you can edit."] }, values };
    else {
      log.error("create launch failed", error, { code: error?.code });
      return { status: "error", message: "We couldn’t create the launch. Please try again.", values };
    }
  }
  if (!createdId) return { status: "error", fieldErrors: { name: ["Try a more distinctive name — its web address is already in use."] }, values };
  redirect(`/dashboard/launches/${createdId}`);
}

export async function updateLaunchAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const raw = formDataToObject(formData);
  const values = echo(raw);
  const parsed = updateLaunchSchema.safeParse(raw);
  if (!parsed.success) return { status: "error", fieldErrors: flattenErrors(parsed.error), values, message: "Fix the highlighted fields and save again." };
  const ctx = await editable(parsed.data.launchId);
  if (!ctx) return NO_ACCESS;
  if (ctx.launch.status === "removed") return { status: "error", message: "This launch was removed and can’t be edited.", values };

  const d = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.from("launches").update({
    name: d.name, tagline: d.tagline, product_url: d.productUrl, description: d.description, startup_id: d.startupId,
    category_id: d.categoryId, tags: d.tags, launch_date: d.launchDate, demo_video_url: d.demoVideoUrl,
  }).eq("id", d.launchId).select("id").maybeSingle();
  if (error) {
    if (error.code === "42501") return { status: "error", fieldErrors: { startupId: ["You can only launch on behalf of a startup you can edit."] }, values };
    log.error("update launch failed", error, { code: error.code });
    return { status: "error", message: "We couldn’t save your changes. Please try again.", values };
  }
  if (!data) return NO_ACCESS;
  refresh(d.launchId);
  revalidatePath(`/launches/${ctx.launch.slug}`);
  return { status: "success", message: "Saved." };
}

export async function uploadLaunchLogoAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = launchIdSchema.safeParse({ launchId: formData.get("launchId") });
  if (!id.success) return GENERIC;
  const ctx = await editable(id.data.launchId);
  if (!ctx) return NO_ACCESS;
  if (!(await rateLimit(`upload:${ctx.profile.id}`, 20, 3600))) return { status: "error", message: "You’ve uploaded a lot of images recently. Please try again later." };
  const file = formData.get("logo");
  const check = await checkImageFile(file instanceof File ? file : null, LOGO_MAX);
  if (!check.ok) return { status: "error", message: check.error };

  const supabase = await createClient();
  const up = await uploadPublicImage(supabase, BUCKET, id.data.launchId, "logo", check);
  if (!up.ok) { log.error("launch logo upload failed", up.error); return { status: "error", message: "The upload failed. Check your connection and try again." }; }
  const { error } = await supabase.from("launches").update({ logo_url: up.url }).eq("id", id.data.launchId);
  if (error) { await supabase.storage.from(BUCKET).remove([up.path]); return GENERIC; }
  const old = storagePathFromPublicUrl(ctx.launch.logo_url, BUCKET);
  if (old && old !== up.path) await supabase.storage.from(BUCKET).remove([old]);
  refresh(id.data.launchId);
  return { status: "success", message: "Logo updated." };
}

export async function removeLaunchLogoAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = launchIdSchema.safeParse({ launchId: formData.get("launchId") });
  if (!id.success) return GENERIC;
  const ctx = await editable(id.data.launchId);
  if (!ctx) return NO_ACCESS;
  const supabase = await createClient();
  const { error } = await supabase.from("launches").update({ logo_url: null }).eq("id", id.data.launchId);
  if (error) return GENERIC;
  const old = storagePathFromPublicUrl(ctx.launch.logo_url, BUCKET);
  if (old) await supabase.storage.from(BUCKET).remove([old]);
  refresh(id.data.launchId);
  return { status: "success", message: "Logo removed." };
}

export async function addLaunchScreenshotAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = launchAltSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return { status: "error", fieldErrors: flattenErrors(parsed.error) };
  const ctx = await editable(parsed.data.launchId);
  if (!ctx) return NO_ACCESS;
  if (!(await rateLimit(`upload:${ctx.profile.id}`, 20, 3600))) return { status: "error", message: "You’ve uploaded a lot of images recently. Please try again later." };
  const file = formData.get("image");
  const check = await checkImageFile(file instanceof File ? file : null, SHOT_MAX);
  if (!check.ok) return { status: "error", message: check.error };

  const supabase = await createClient();
  const up = await uploadPublicImage(supabase, BUCKET, parsed.data.launchId, "shot", check);
  if (!up.ok) { log.error("launch screenshot upload failed", up.error); return { status: "error", message: "The upload failed. Check your connection and try again." }; }
  const { error } = await supabase.from("launch_media").insert({ launch_id: parsed.data.launchId, storage_path: up.path, url: up.url, alt_text: parsed.data.altText });
  if (error) {
    await supabase.storage.from(BUCKET).remove([up.path]);
    if (error.code === "54000") return { status: "error", message: `You can add up to ${LAUNCH_LIMITS.screenshots} screenshots. Remove one first.` };
    log.error("launch media insert failed", error, { code: error.code });
    return GENERIC;
  }
  refresh(parsed.data.launchId);
  return { status: "success", message: "Screenshot added." };
}

export async function removeLaunchScreenshotAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = launchIdSchema.safeParse({ launchId: formData.get("launchId") });
  const mediaId = launchIdSchema.safeParse({ launchId: formData.get("mediaId") });
  if (!id.success || !mediaId.success) return GENERIC;
  const ctx = await editable(id.data.launchId);
  if (!ctx) return NO_ACCESS;
  const supabase = await createClient();
  const { data, error } = await supabase.from("launch_media").delete().eq("id", mediaId.data.launchId).eq("launch_id", id.data.launchId).select("storage_path").maybeSingle();
  if (error || !data) return GENERIC;
  await supabase.storage.from(BUCKET).remove([data.storage_path as string]);
  refresh(id.data.launchId);
  return { status: "success", message: "Screenshot removed." };
}

function submitError(message: string): string {
  if (message.includes("email_not_verified")) return "Confirm your email address before submitting.";
  if (message.includes("launch_incomplete")) return "Add a sector and a description first.";
  if (message.includes("invalid_state")) return "This launch has already been submitted.";
  if (message.includes("account_suspended")) return "Your account is suspended, so you can’t submit launches.";
  if (message.includes("forbidden")) return "You don’t have access to submit this launch.";
  return "We couldn’t submit this launch. Please try again.";
}

export async function submitLaunchAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = launchIdSchema.safeParse({ launchId: formData.get("launchId") });
  if (!id.success) return GENERIC;
  const ctx = await editable(id.data.launchId);
  if (!ctx) return NO_ACCESS;
  const supabase = await createClient();
  // The database function re-checks ownership, suspension, email verification and completeness.
  const { data, error } = await supabase.rpc("submit_launch", { p_launch_id: id.data.launchId });
  if (error) {
    if (!/email_not_verified|launch_incomplete|invalid_state|account_suspended|forbidden/.test(error.message)) log.error("submit_launch failed", error, { code: error.code });
    return { status: "error", message: submitError(error.message) };
  }
  refresh(id.data.launchId);
  revalidatePath("/launches", "layout");
  after(() => dispatchNotificationEmails().catch((e) => log.error("dispatch failed", e)));
  const status = String(data);
  return { status: "success", message: status === "pending_review" ? "Submitted for review. We’ll notify you of the decision." : status === "scheduled" ? "Approved and scheduled for its launch date." : "Your launch is live." };
}

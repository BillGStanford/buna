"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireActiveProfile } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";
import { createLogger } from "@/lib/logger";
import { canPublishStartup } from "@/lib/permissions";
import { sniffDocumentType } from "@/lib/uploads";
import { getManagedStartup } from "@/lib/startups/queries";
import { flattenErrors, formDataToObject } from "@/lib/validation/common";
import { verificationRequestSchema } from "@/lib/validation/admin";
import { uuidField } from "@/lib/validation/startup";
import type { ActionState } from "@/lib/types";

const log = createLogger("verification");
const MAX_BYTES = 10 * 1024 * 1024;
const EXT = { pdf: "pdf", jpeg: "jpg", png: "png", webp: "webp" } as const;
const MIME = { pdf: "application/pdf", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" } as const;

/** Founders ask for review; evidence goes to a private bucket only the team and staff can open. Nothing is verified automatically. */
export async function requestVerificationAction(_p: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireActiveProfile();
  const parsed = verificationRequestSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return { status: "error", fieldErrors: flattenErrors(parsed.error) };
  const managed = await getManagedStartup(parsed.data.startupId, profile.id);
  if (!managed || !canPublishStartup(managed.role)) return { status: "error", message: "Only an owner or admin of this startup can request verification." };
  if (managed.startup.verification_status === "verified") return { status: "error", message: "This startup is already verified." };
  if (managed.startup.verification_status === "pending") return { status: "error", message: "A request is already being reviewed." };
  if (!(await rateLimit(`verify:${profile.id}`, 5, 86400))) return { status: "error", message: "You’ve sent several requests today. Please try again tomorrow." };

  const files = formData.getAll("evidence").filter((f): f is File => f instanceof File && f.size > 0).slice(0, 3);
  const supabase = await createClient();
  const paths: string[] = [];
  for (const file of files) {
    if (file.size > MAX_BYTES) { await supabase.storage.from("verification-docs").remove(paths); return { status: "error", message: `“${file.name}” is over 10 MB.` }; }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const kind = sniffDocumentType(bytes);
    if (!kind) { await supabase.storage.from("verification-docs").remove(paths); return { status: "error", message: `“${file.name}” isn’t a PDF, JPEG, PNG or WebP file.` }; }
    const path = `${parsed.data.startupId}/${crypto.randomUUID()}.${EXT[kind]}`;
    const { error } = await supabase.storage.from("verification-docs").upload(path, bytes, { contentType: MIME[kind], upsert: false });
    if (error) { log.error("evidence upload failed", error); await supabase.storage.from("verification-docs").remove(paths); return { status: "error", message: "The upload failed. Please try again." }; }
    paths.push(path);
  }
  const { error } = await supabase.rpc("submit_verification_request", {
    p_startup: parsed.data.startupId, p_notes: parsed.data.notes, p_evidence_paths: paths,
  });
  if (error) {
    if (paths.length) await supabase.storage.from("verification-docs").remove(paths);
    if (error.code === "23505" || error.message.includes("invalid_state")) return { status: "error", message: "A request is already being reviewed." };
    if (error.message.includes("already_verified")) return { status: "error", message: "This startup is already verified." };
    log.error("request insert failed", error, { code: error.code });
    return { status: "error", message: "We couldn’t send your request. Please try again." };
  }
  revalidatePath(`/dashboard/startup/${parsed.data.startupId}`, "layout");
  return { status: "success", message: "Request sent. The Buna team will review it and tell you the outcome." };
}

export async function withdrawVerificationAction(_p: ActionState, formData: FormData): Promise<ActionState> {
  await requireActiveProfile();
  const id = uuidField.safeParse(formData.get("requestId"));
  const startupId = uuidField.safeParse(formData.get("startupId"));
  if (!id.success || !startupId.success) return { status: "error", message: "Something went wrong." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("withdraw_verification_request", { p_request: id.data });
  if (error) return { status: "error", message: error.message.includes("forbidden") ? "You don’t have permission to do that." : "That request can’t be withdrawn." };
  revalidatePath(`/dashboard/startup/${startupId.data}`, "layout");
  return { status: "success", message: "Request withdrawn." };
}

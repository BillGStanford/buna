"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireActiveProfile } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";
import { writeAuditLog } from "@/lib/audit";

const CORRECTABLE = new Set(["name", "tagline", "description", "website_url", "country", "city", "stage", "founded_year"]);
const value = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();

export async function submitStartupCorrectionAction(formData: FormData) {
  const profile = await requireActiveProfile();
  const slug = value(formData, "startupSlug").toLowerCase();
  const fieldName = value(formData, "field_name");
  let proposedValue = value(formData, "proposed_value");
  const reason = value(formData, "reason");

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || !CORRECTABLE.has(fieldName)) throw new Error("This correction request is invalid.");
  if (proposedValue.length < 1 || proposedValue.length > 5000 || reason.length < 5 || reason.length > 2000) throw new Error("Enter the proposed correction and an explanation.");
  if (fieldName === "stage") {\n    proposedValue = proposedValue.toLowerCase().replace(/\\s+/g, "_");\n    if (!["idea", "prototype", "mvp", "early_revenue", "growth", "scale"].includes(proposedValue)) throw new Error("Choose a valid startup stage: idea, prototype, mvp, early_revenue, growth or scale.");\n  }\n  if (fieldName === "country") {
    if (!/^[A-Za-z]{2}$/.test(proposedValue)) throw new Error("Enter a two-letter country code, such as ET or KE.");
    proposedValue = proposedValue.toUpperCase();
  }
  if (fieldName === "founded_year") {
    const year = Number(proposedValue);
    if (!/^\d{4}$/.test(proposedValue) || year < 1800 || year > new Date().getFullYear()) throw new Error("Enter a valid four-digit founding year.");
  }
  if (fieldName === "website_url" && proposedValue) {
    try {
      const url = new URL(proposedValue);
      if (!["http:", "https:"].includes(url.protocol)) throw new Error();
    } catch {
      throw new Error("Enter a valid website address beginning with https:// or http://.");
    }
  }
  if (!(await rateLimit(`startup-correction:${profile.id}`, 5, 86400))) throw new Error("You have submitted several correction requests recently. Please try again later.");

  const admin = createAdminClient();
  const { data: startup, error: startupError } = await admin.from("startups")
    .select("id,slug,status,is_demo,name,tagline,description,website_url,country,city,stage,founded_year")
    .eq("slug", slug).maybeSingle();
  if (startupError || !startup || startup.status !== "published" || startup.is_demo) throw new Error("This startup is not accepting public correction requests.");

  const current = startup[fieldName as keyof typeof startup];
  const { data: request, error } = await admin.from("startup_correction_requests").insert({
    startup_id: startup.id, field_name: fieldName, current_value: current == null ? null : String(current),
    proposed_value: proposedValue, reason, submitted_by: profile.id,
  }).select("id").single();
  if (error || !request) throw new Error("We could not submit your correction. Please try again.");

  await writeAuditLog({ actorId: profile.id, action: "company_correction.submit", entityType: "startup_correction_request", entityId: request.id, metadata: { startup_id: startup.id, field: fieldName } });
  revalidatePath(`/startups/${startup.slug}`);
  revalidatePath("/admin/operations");
  redirect(`/startups/${startup.slug}?correction=submitted`);
}

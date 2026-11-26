"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/lib/audit";
import type { ActionState } from "@/lib/types";

const schema = z.object({
  tagId: z.string().uuid().optional().or(z.literal("")),
  name: z.string().trim().min(2).max(48),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(60),
  description: z.string().trim().max(240).optional(),
  isActive: z.enum(["true", "false"]),
});

export async function savePlatformTagAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const staff = await requireAdmin();
  const parsed = schema.safeParse({
    tagId: String(formData.get("tagId") ?? ""),
    name: String(formData.get("name") ?? ""),
    slug: String(formData.get("slug") ?? ""),
    description: String(formData.get("description") ?? ""),
    isActive: ["true", "on"].includes(String(formData.get("isActive") ?? "")) ? "true" : "false",
  });
  if (!parsed.success) return { status: "error", message: "Check the tag name, slug and description." };
  const { tagId, ...values } = parsed.data;
  const row = { name: values.name, slug: values.slug, description: values.description || null, is_active: values.isActive === "true" };
  const admin = createAdminClient();
  const query = tagId
    ? admin.from("platform_tags").update(row).eq("id", tagId).select("id").maybeSingle()
    : admin.from("platform_tags").insert(row).select("id").maybeSingle();
  const { data, error } = await query;
  if (error?.code === "23505") return { status: "error", message: "That tag slug is already in use." };
  if (error || !data) return { status: "error", message: "We couldn’t save the tag." };
  await writeAuditLog({ actorId: staff.id, action: tagId ? "tag.update" : "tag.create", entityType: "tag", entityId: data.id, metadata: { name: row.name, slug: row.slug, is_active: row.is_active } });
  revalidatePath("/admin/tags");
  revalidatePath("/admin/audit");
  revalidatePath("/", "layout");
  return { status: "success", message: tagId ? "Tag updated." : "Tag created." };
}

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/session";
import { formDataToObject } from "@/lib/validation/common";
import { uuidField } from "@/lib/validation/startup";
import { z } from "zod";
import type { ActionState } from "@/lib/types";

const schema = z.object({ messageId: uuidField, status: z.enum(["new", "handled", "spam"]) });

export async function setMessageStatusAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const staff = await requireStaff();
  const parsed = schema.safeParse(formDataToObject(formData));
  if (!parsed.success) return { status: "error", message: "Something went wrong." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("platform_messages").update({ status: parsed.data.status, handled_by: parsed.data.status === "new" ? null : staff.id, handled_at: parsed.data.status === "new" ? null : new Date().toISOString() }).eq("id", parsed.data.messageId).select("id").maybeSingle();
  if (error || !data) return { status: "error", message: "We couldn’t update that." };
  revalidatePath("/admin/messages");
  return { status: "success", message: "Updated." };
}

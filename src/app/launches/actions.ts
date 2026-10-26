"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireActiveProfile } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";
import { createLogger } from "@/lib/logger";
import { dispatchNotificationEmails } from "@/lib/notifications/dispatch";
import { flattenErrors, formDataToObject } from "@/lib/validation/common";
import { commentIdSchema, createCommentSchema, editCommentSchema, voteSchema } from "@/lib/validation/launch";
import type { ActionState } from "@/lib/types";

const log = createLogger("launch-actions");
const refresh = () => { revalidatePath("/launches", "layout"); revalidatePath("/"); };

/**
 * Casts a vote. Votes are permanent: the database has no update or delete path for them, a primary key
 * on (launch, user) rules out duplicates, and the counter is incremented inside the same transaction.
 */
export async function voteAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireActiveProfile();
  const parsed = voteSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return { status: "error", message: "That launch isn’t available." };
  if (!(await rateLimit(`vote:${profile.id}`, 60, 3600))) return { status: "error", message: "You’re voting very quickly. Please wait a few minutes." };

  const supabase = await createClient();
  const { error } = await supabase.from("launch_votes").insert({ launch_id: parsed.data.launchId, user_id: profile.id });
  if (error) {
    if (error.code === "23505") return { status: "success", message: "You’ve already voted for this launch." };
    if (error.code === "42501") return { status: "error", message: "Votes need a confirmed email address, and only live launches can be voted on." };
    log.error("vote failed", error, { code: error.code });
    return { status: "error", message: "We couldn’t record your vote. Please try again." };
  }
  refresh();
  return { status: "success", message: "Vote counted. Votes are final." };
}

export async function createCommentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireActiveProfile();
  const parsed = createCommentSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return { status: "error", fieldErrors: flattenErrors(parsed.error), values: { body: String(formData.get("body") ?? "") } };
  const values = { body: parsed.data.body };
  if (!(await rateLimit(`comment:${profile.id}`, 20, 3600))) return { status: "error", message: "You’re commenting very quickly. Please wait a few minutes.", values };

  const supabase = await createClient();
  const { error } = await supabase.from("comments").insert({ launch_id: parsed.data.launchId, author_id: profile.id, parent_id: parsed.data.parentId, body: parsed.data.body });
  if (error) {
    if (error.code === "42501") return { status: "error", message: "Comments need a confirmed email address, and only live launches can be discussed.", values };
    if (error.code === "23514") return { status: "error", message: "You can’t reply to that comment.", values };
    log.error("comment insert failed", error, { code: error.code });
    return { status: "error", message: "We couldn’t post your comment. Please try again.", values };
  }
  refresh();
  after(() => dispatchNotificationEmails().catch((e) => log.error("dispatch failed", e)));
  return { status: "success", message: "Comment posted.", values: {} };
}

export async function editCommentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireActiveProfile();
  const parsed = editCommentSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return { status: "error", fieldErrors: flattenErrors(parsed.error) };
  const supabase = await createClient();
  const { data, error } = await supabase.from("comments").update({ body: parsed.data.body, edited_at: new Date().toISOString() })
    .eq("id", parsed.data.commentId).eq("author_id", profile.id).select("id").maybeSingle();
  if (error) {
    log.error("comment edit failed", error, { code: error.code });
    return { status: "error", message: "We couldn’t save your edit. Please try again." };
  }
  if (!data) return { status: "error", message: "You can only edit your own visible comments." };
  refresh();
  return { status: "success", message: "Comment updated." };
}

/** Authors remove their own comments; the row is kept (status "deleted") so replies keep their context. */
export async function deleteCommentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireActiveProfile();
  const parsed = commentIdSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return { status: "error", message: "That comment isn’t available." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("comments").update({ status: "deleted" })
    .eq("id", parsed.data.commentId).eq("author_id", profile.id).select("id").maybeSingle();
  if (error || !data) return { status: "error", message: "You can only delete your own comments." };
  refresh();
  return { status: "success", message: "Comment deleted." };
}

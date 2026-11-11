import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { moderateCommunityReplyAction, moderateCommunityThreadAction } from "./actions";

export const metadata: Metadata = { title: "Community moderation", robots: { index: false } };

const STATUSES = ["published", "hidden", "deleted"] as const;
const moderationLabel = (status: (typeof STATUSES)[number]) =>
  status === "published" ? "Restore" : status === "hidden" ? "Hide" : "Remove";

export default async function AdminCommunityPage() {
  await requireStaff();
  const supabase = await createClient();
  const [{ data: threads, error: threadError }, { data: replies, error: replyError }] = await Promise.all([
    supabase.from("community_threads").select("id, title, category, body, status, created_at").order("created_at", { ascending: false }).limit(100),
    supabase.from("community_replies").select("id, thread_id, body, status, created_at").order("created_at", { ascending: false }).limit(150),
  ]);
  if (threadError) throw threadError;
  if (replyError) throw replyError;
  const threadIds = [...new Set((replies ?? []).map((reply) => reply.thread_id))];
  const { data: parentThreads } = threadIds.length
    ? await supabase.from("community_threads").select("id, title").in("id", threadIds)
    : { data: [] };
  const titles = new Map((parentThreads ?? []).map((thread) => [thread.id, thread.title]));

  return <div className="space-y-8">
    <p className="text-sm"><Link href="/admin" className="underline">Admin</Link></p>
    <header><h1 className="text-3xl font-semibold tracking-tight">Community moderation</h1><p className="mt-1 text-sm text-muted">Hide, restore or remove discussions and individual replies that violate Buna’s community guidelines.</p></header>
    <section className="space-y-3">
      <h2 className="text-base font-semibold tracking-tight">Discussions ({threads?.length ?? 0})</h2>
      {threads?.length ? <ul className="space-y-3">{threads.map((thread) => <li key={thread.id} className="rounded-xl border border-line bg-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">{thread.title}</h3><span className="text-xs text-muted">{thread.status} · {thread.category}</span></div>
        <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm text-muted">{thread.body}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {STATUSES.filter((status) => status !== thread.status).map((status) => <form key={status} action={moderateCommunityThreadAction}>
            <input type="hidden" name="threadId" value={thread.id} /><input type="hidden" name="status" value={status} />
            <button className="rounded-md border border-line px-3 py-1.5 text-xs font-semibold hover:bg-primary-pale">{moderationLabel(status)}</button>
          </form>)}
          <Link href={"/community/" + thread.id} className="self-center text-xs underline">Open</Link>
        </div>
      </li>)}</ul> : <p className="text-sm text-muted">No discussions yet.</p>}
    </section>
    <section className="space-y-3">
      <h2 className="text-base font-semibold tracking-tight">Individual replies ({replies?.length ?? 0})</h2>
      {replies?.length ? <ul className="space-y-3">{replies.map((reply) => <li key={reply.id} className="rounded-xl border border-line bg-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-medium">{titles.get(reply.thread_id) ?? "Discussion"}</p><span className="text-xs text-muted">{reply.status}</span></div>
        <p className="mt-2 whitespace-pre-wrap text-sm text-muted">{reply.body}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {STATUSES.filter((status) => status !== reply.status).map((status) => <form key={status} action={moderateCommunityReplyAction}>
            <input type="hidden" name="replyId" value={reply.id} /><input type="hidden" name="status" value={status} />
            <button className="rounded-md border border-line px-3 py-1.5 text-xs font-semibold hover:bg-primary-pale">{moderationLabel(status)}</button>
          </form>)}
          <Link href={"/community/" + reply.thread_id + "#replies"} className="self-center text-xs underline">Open thread</Link>
        </div>
      </li>)}</ul> : <p className="text-sm text-muted">No replies yet.</p>}
    </section>
  </div>;
}

import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { moderateCommunityThreadAction } from "./actions";

export const metadata: Metadata = { title: "Community moderation", robots: { index: false } };

export default async function AdminCommunityPage() {
  await requireStaff();
  const supabase = await createClient();
  const { data: threads, error } = await supabase.from("community_threads")
    .select("id, title, category, body, status, created_at").order("created_at", { ascending: false }).limit(100);
  if (error) throw error;
  return <div className="space-y-5">
    <p className="text-sm"><Link href="/admin" className="underline">Admin</Link></p>
    <h1 className="text-2xl font-bold">Community moderation</h1>
    <p className="text-sm text-muted">Hide or restore discussions that violate Buna’s community guidelines.</p>
    {threads?.length ? <ul className="space-y-3">{threads.map((thread) => <li key={thread.id} className="rounded-lg border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">{thread.title}</h2><span className="text-xs text-muted">{thread.status} · {thread.category}</span></div>
      <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm text-muted">{thread.body}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {(["published", "hidden", "deleted"] as const).map((status) => <form key={status} action={moderateCommunityThreadAction}>
          <input type="hidden" name="threadId" value={thread.id} /><input type="hidden" name="status" value={status} />
          <button className="rounded-md border border-line px-3 py-1.5 text-xs font-semibold hover:bg-primary-pale">{status === "published" ? "Restore" : status === "hidden" ? "Hide" : "Remove"}</button>
        </form>)}
        <Link href={"/community/" + thread.id} className="self-center text-xs underline">Open</Link>
      </div>
    </li>)}</ul> : <p className="text-sm text-muted">No discussions yet.</p>}
  </div>;
}

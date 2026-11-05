import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { buttonStyles } from "@/components/ui/button";
import { TextAreaField } from "@/components/ui/fields";
import { COMMUNITY_CATEGORIES, communityCategoryLabel } from "@/lib/community/constants";
import { getCommunityThread } from "@/lib/community/queries";
import { createCommunityReplyAction, toggleCommunitySubscriptionAction } from "../actions";

export const metadata: Metadata = { title: "Discussion" };

export default async function CommunityThreadPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const [{ id }, profile, query] = await Promise.all([params, getProfile(), searchParams]);
  const result = await getCommunityThread(id);
  if (!result || result.thread.status !== "published") notFound();
  const { thread, replies } = result;
  const supabase = await createClient();
  const { data: subscription } = profile ? await supabase.from("community_thread_subscriptions").select("thread_id").eq("thread_id", id).eq("user_id", profile.id).maybeSingle() : { data: null };
  const category = COMMUNITY_CATEGORIES.find((item) => item.value === thread.category);
  return <article className="container-page max-w-4xl space-y-7 py-10">
    <p className="text-sm"><Link href="/community" className="underline">Community</Link> / {category?.label ?? "Discussion"}</p>
    <header className="space-y-3">
      <span className="inline-flex rounded-full bg-primary-pale px-3 py-1 text-xs font-semibold text-primary-deep">{communityCategoryLabel(thread.category)}</span>
      <h1 className="text-3xl font-bold">{thread.title}</h1>
      <p className="text-sm text-muted">Started by <Link href={thread.author ? "/users/" + thread.author.username : "/founders"} className="font-medium underline">{thread.author?.display_name || "Buna member"}</Link> · <time dateTime={thread.created_at}>{new Date(thread.created_at).toLocaleString()}</time></p>
    </header>
    <div className="whitespace-pre-wrap rounded-xl border border-line bg-surface p-5 leading-relaxed">{thread.body}</div>
    {profile ? <form action={toggleCommunitySubscriptionAction}>
      <input type="hidden" name="threadId" value={id} />
      <button className={buttonStyles("secondary", "sm")}>{subscription ? "Turn reply notifications off" : "Notify me of replies"}</button>
    </form> : <p className="text-sm text-muted"><Link className="underline" href={"/login?next=" + encodeURIComponent("/community/" + id)}>Sign in</Link> to receive reply notifications.</p>}
    <section id="replies" className="space-y-4">
      <h2 className="text-xl font-semibold">Replies ({replies.length})</h2>
      {replies.length ? <ol className="space-y-4">{replies.map((reply) => <li key={reply.id} className="rounded-lg border border-line bg-surface p-4">
        <p className="text-sm font-semibold"><Link href={reply.author ? "/users/" + reply.author.username : "/founders"} className="text-ink underline">{reply.author?.display_name || "Buna member"}</Link> <span className="font-normal text-muted">· {new Date(reply.created_at).toLocaleString()}</span></p>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{reply.body}</p>
      </li>)}</ol> : <p className="text-sm text-muted">No replies yet. Share a useful answer or ask a clarifying question.</p>}
    </section>
    <section className="rounded-xl border border-line bg-surface p-5">
      <h2 className="text-lg font-semibold">Add your answer</h2>
      {profile ? <form action={createCommunityReplyAction} className="mt-3 space-y-3">
        <input type="hidden" name="threadId" value={id} />
        <TextAreaField label="Your reply" name="body" required maxLength={3000} rows={5} placeholder="Share practical experience, steps, or useful resources." />
        {query.error ? <p className="text-sm text-danger">Your reply could not be posted. Check the form and try again.</p> : null}
        <button className={buttonStyles("primary", "md")}>Post reply</button>
      </form> : <p className="mt-2 text-sm"><Link href={"/login?next=" + encodeURIComponent("/community/" + id)} className="underline">Sign in</Link> to reply.</p>}
    </section>
  </article>;
}

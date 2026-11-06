import type { Metadata } from "next";
import Link from "next/link";
import { getProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { buttonStyles } from "@/components/ui/button";
import { SelectField, TextAreaField, TextField } from "@/components/ui/fields";
import { COMMUNITY_CATEGORIES, communityCategoryLabel } from "@/lib/community/constants";
import { listCommunityThreads } from "@/lib/community/queries";
import { createCommunityThreadAction } from "./actions";

export const metadata: Metadata = {
  title: "Community discussions",
  description: "Ask questions and exchange practical answers with African founders and startup operators.",
};

export default async function CommunityPage({ searchParams }: { searchParams: Promise<{ category?: string; error?: string }> }) {
  const [{ category, error }, profile] = await Promise.all([searchParams, getProfile()]);
  const threads = await listCommunityThreads(category);
  const supabase = await createClient();
  const categories = await Promise.all(COMMUNITY_CATEGORIES.map(async (item) => {
    const { count } = await supabase.from("community_threads").select("id", { count: "exact", head: true }).eq("status", "published").eq("category", item.value);
    return { ...item, count: count ?? 0 };
  }));
  return <div className="container-page space-y-8 py-10">
    <header className="max-w-3xl space-y-3">
      <p className="text-sm font-semibold uppercase tracking-wide text-primary">Buna community</p>
      <h1 className="text-3xl font-bold">Ask. Answer. Build together.</h1>
      <p className="text-muted">A practical discussion space for the questions founders and startup teams face while building across Africa. This is a discussion board, not another activity feed.</p>
    </header>
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" aria-label="Discussion categories">
      {categories.map((item) => <Link key={item.value} href={"/community?category=" + item.value} className={"rounded-lg border p-4 no-underline " + (category === item.value ? "border-primary bg-primary-pale" : "border-line bg-surface hover:border-primary/40")}>
        <h2 className="font-semibold text-ink">{item.label}</h2><p className="mt-1 text-xs text-muted">{item.description}</p><p className="mt-3 text-xs text-muted">{item.count} discussions</p>
      </Link>)}
    </section>
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">{category ? communityCategoryLabel(category) : "Recent discussions"}</h2><Link href="/community" className="text-sm underline">All discussions</Link></div>
        {threads.length ? <ul className="space-y-3">{threads.map((thread) => <li key={thread.id} className="rounded-lg border border-line bg-surface p-4">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted"><span className="rounded-full bg-primary-pale px-2 py-1 text-primary-deep">{communityCategoryLabel(thread.category)}</span><span>{thread.author?.display_name || "Buna member"}</span><span>·</span><time dateTime={thread.created_at}>{new Date(thread.created_at).toLocaleDateString()}</time><span>·</span><span>{thread.reply_count} replies</span></div>
          <h3 className="mt-2 text-lg font-semibold"><Link href={"/community/" + thread.id} className="text-ink no-underline hover:underline">{thread.title}</Link></h3>
          <p className="mt-2 line-clamp-2 whitespace-pre-wrap text-sm text-muted">{thread.body}</p>
        </li>)}</ul> : <p className="rounded-lg border border-dashed border-line p-6 text-sm text-muted">No discussions here yet. Start the first one.</p>}
      </section>
      <aside className="rounded-xl border border-line bg-surface p-5">
        <h2 className="text-lg font-semibold">Start a discussion</h2>
        <p className="mt-1 text-sm text-muted">Ask a clear question. Include enough context for another founder to give a useful answer.</p>
        {profile ? <form action={createCommunityThreadAction} className="mt-4 space-y-3">
          <SelectField label="Category" name="category" required><option value="">Choose a category</option>{COMMUNITY_CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</SelectField>
          <TextField label="Question or topic" name="title" required maxLength={140} placeholder="e.g. How do I register a company in Ethiopia?" />
          <TextAreaField label="Details" name="body" required minLength={20} maxLength={5000} rows={6} placeholder="Explain what you have tried, where you are operating, and what kind of answer would help." />
          {error ? <p className="text-sm text-danger">{error === "rate" ? "Please wait before starting another discussion." : "The discussion could not be posted. Check the fields and try again."}</p> : null}
          <button className={buttonStyles("primary", "md")}>Post discussion</button>
        </form> : <p className="mt-4 text-sm"><Link href="/login?next=%2Fcommunity" className="font-semibold underline">Sign in</Link> to start a discussion or reply.</p>}
      </aside>
    </div>
  </div>;
}

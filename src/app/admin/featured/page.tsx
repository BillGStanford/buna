import type { Metadata } from "next";
import Link from "next/link";
import { NoteActionForm } from "@/components/admin/note-action-form";
import { listFeatured, listStartupsAdmin } from "@/lib/admin/queries";
import { sanitizeSearchTerm } from "@/lib/startups/params";
import { buttonStyles } from "@/components/ui/button";
import { moderateStartupAction } from "../actions";

export const metadata: Metadata = { title: "Featured (admin)" };

export default async function AdminFeaturedPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const q = sanitizeSearchTerm(sp.q ?? "");
  const [featured, candidates] = await Promise.all([listFeatured(), q ? listStartupsAdmin("published", q, 1) : Promise.resolve({ rows: [], total: 0 })]);
  return (
    <div className="space-y-8">
      <div><h1 className="text-2xl font-bold">Featured picks</h1><p className="mt-1 text-sm text-muted">Featured items are chosen by the team, never bought. Launches are featured from <Link href="/admin/launches" className="font-medium">launch moderation</Link>.</p></div>
      <section aria-labelledby="fs" className="space-y-3">
        <h2 id="fs" className="text-lg font-semibold">Featured startups <span className="tabular-nums text-muted">({featured.startups.length})</span></h2>
        <ul className="space-y-2">{featured.startups.map((s) => <li key={s.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-line p-3"><Link href={`/startups/${s.slug}`} className="min-w-0 flex-1 font-medium">{s.name}</Link><NoteActionForm action={moderateStartupAction} fields={{ startupId: s.id, action: "unfeature" }} button="Unfeature" /></li>)}{featured.startups.length === 0 ? <li className="text-sm text-muted">None.</li> : null}</ul>
        <form action="/admin/featured" method="get" role="search" aria-label="Find a startup to feature" className="flex flex-wrap items-end gap-3">
          <div><label htmlFor="feat-q" className="mb-1 block text-sm font-medium">Find a published startup</label><input id="feat-q" name="q" defaultValue={q} className="h-10 rounded-md border border-line px-3 text-sm" /></div>
          <button type="submit" className={buttonStyles("secondary", "md")}>Search</button>
        </form>
        {q ? <ul className="space-y-2">{candidates.rows.filter((c) => !c.is_featured).map((s) => <li key={s.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-line p-3"><span className="min-w-0 flex-1">{s.name}</span><NoteActionForm action={moderateStartupAction} fields={{ startupId: s.id, action: "feature" }} button="Feature" variant="primary" /></li>)}</ul> : null}
      </section>
      <section aria-labelledby="fl" className="space-y-3">
        <h2 id="fl" className="text-lg font-semibold">Featured launches <span className="tabular-nums text-muted">({featured.launches.length})</span></h2>
        <ul className="space-y-2">{featured.launches.map((l) => <li key={l.id}><Link href={`/launches/${l.slug}`} className="font-medium">{l.name}</Link></li>)}{featured.launches.length === 0 ? <li className="text-sm text-muted">None.</li> : null}</ul>
      </section>
    </div>
  );
}

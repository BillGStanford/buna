import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth/session";
import { getInvestorPortal } from "@/lib/investors/queries";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/illustrations";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Watchlist", robots: { index: false } };

export default async function InvestorSavedStartupsPage() {
  const profile = await requireProfile("/dashboard/investor/startups");
  const { investor } = await getInvestorPortal(profile.id);
  if (!investor) redirect("/dashboard/investor");
  const supabase = await createClient();
  const { data, error } = await supabase.from("investor_saved_startups")
    .select("created_at, startup:startups(id, slug, name, tagline, country, stage, status)")
    .eq("investor_id", investor.id).order("created_at", { ascending: false }).limit(100);
  if (error) throw error;
  const rows = (data ?? []).flatMap((row) => {
    const startup = Array.isArray(row.startup) ? row.startup[0] : row.startup;
    return startup && startup.status === "published" ? [{ ...startup, created_at: row.created_at }] : [];
  });
  const startupIds = rows.map((s) => s.id);
  const { data: updates } = startupIds.length ? await supabase.from("startup_updates").select("id,startup_id,title,body,created_at").in("startup_id", startupIds).order("created_at", { ascending: false }).limit(30) : { data: [] };
  return <div className="space-y-5">
    <div><p className="text-sm text-muted"><Link href="/dashboard/investor">Investor workspace</Link></p><h1 className="text-2xl font-bold">Watchlist</h1><p className="mt-1 text-sm text-muted">Your private shortlist. Saving a startup does not notify its founders or mean you intend to invest.</p></div>
    {rows.length ? <ul className="grid gap-3 sm:grid-cols-2">{rows.map((s) => <li key={s.id}><Card><CardBody className="space-y-2"><h2 className="font-semibold"><Link href={"/startups/" + s.slug}>{s.name}</Link></h2>{s.tagline ? <p className="text-sm text-muted">{s.tagline}</p> : null}<div className="flex flex-wrap gap-1.5">{s.stage ? <Badge>{s.stage.replace(/_/g," ")}</Badge> : null}{s.country ? <Badge>{s.country}</Badge> : null}</div><p className="text-xs text-muted">Saved {new Date(s.created_at).toLocaleDateString()}</p>
            {(updates ?? []).filter((u) => u.startup_id === s.id).slice(0,2).map((u) => <div key={u.id} className="rounded-md bg-surface p-2"><p className="text-xs font-semibold">Update · {u.title}</p><p className="mt-1 line-clamp-2 text-xs text-muted">{u.body}</p></div>)}</CardBody></Card></li>)}</ul> : <EmptyState illustration="saved" title="Your watchlist is empty">Browse the <Link href="/startups" className="font-medium underline">startup directory</Link> and use “Save to your watchlist” on promising profiles.</EmptyState>}
  </div>;
}

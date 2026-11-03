import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth/session";
import { getInvestorPortal } from "@/lib/investors/queries";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/illustrations";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Saved startups", robots: { index: false } };

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
  return <div className="space-y-5">
    <div><p className="text-sm text-muted"><Link href="/dashboard/investor">Investor workspace</Link></p><h1 className="text-2xl font-bold">Saved startups</h1><p className="mt-1 text-sm text-muted">A private shortlist for your investment research.</p></div>
    {rows.length ? <ul className="grid gap-3 sm:grid-cols-2">{rows.map((s) => <li key={s.id}><Card><CardBody className="space-y-2"><h2 className="font-semibold"><Link href={"/startups/" + s.slug}>{s.name}</Link></h2>{s.tagline ? <p className="text-sm text-muted">{s.tagline}</p> : null}<div className="flex flex-wrap gap-1.5">{s.stage ? <Badge>{s.stage.replace(/_/g," ")}</Badge> : null}{s.country ? <Badge>{s.country}</Badge> : null}</div><p className="text-xs text-muted">Saved {new Date(s.created_at).toLocaleDateString()}</p></CardBody></Card></li>)}</ul> : <EmptyState illustration="saved" title="No saved startups yet">Browse the <Link href="/startups" className="font-medium underline">startup directory</Link> and use “Save to investor list” on promising profiles.</EmptyState>}
  </div>;
}

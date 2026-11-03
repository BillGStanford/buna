import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { listMyStartups } from "@/lib/startups/queries";
import { InvestorPitchForm } from "@/components/investors/investor-forms";
import { Alert } from "@/components/ui/alert";

export const metadata: Metadata = { title: "Request an investor introduction", robots: { index: false } };

export default async function SubmitInvestorPitchPage({ searchParams }: { searchParams: Promise<{ investorId?: string }> }) {
  const profile = await requireProfile("/dashboard/investor/submit");
  const { investorId = "" } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(investorId)) notFound();
  const investor = await getInvestorById(investorId);
  if (!investor) notFound();
  const supabase = await createClient();
  const { data: accepts } = await supabase.rpc("investor_accepts_introductions", { p_investor: investorId });
  if (!investor.is_published || !accepts) return <Alert tone="warning" title="Introduction requests are not enabled">This investor has not activated Investor Mode yet. You can still use the public contact details on their profile.</Alert>;
  const managed = await listMyStartups(profile.id);
  const startups = managed.filter((startup) => ["owner", "admin", "editor"].includes(startup.role)).map((startup) => ({ id: startup.id, name: startup.name }));
  return <div className="max-w-3xl space-y-5">
    <p className="text-sm"><Link href={"/investors/" + investor.slug}>Back to {investor.name}</Link></p>
    <div><p className="text-sm font-semibold text-primary-deep">Capital connections</p><h1 className="mt-1 text-2xl font-bold">Approach {investor.name}</h1><p className="mt-2 text-sm text-muted">Give the investor enough context to assess fit. Your submission is private to you and the investor.</p></div>
    <InvestorPitchForm investorId={investorId} startups={startups} />
  </div>;
}

async function getInvestorById(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("investors").select("id, slug, name, is_published").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

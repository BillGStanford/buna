import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardBody } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
 title: "African startup ecosystem intelligence",
 description: "Explore the African startup ecosystem through company records and disclosed funding information on Buna.",
};
type Overview = { total_companies: number | string; countries: number | string; sectors: number | string; disclosed_funding_rounds: number | string };
export default async function EcosystemPage() {
 const supabase=await createClient();
 const {data,error}=await supabase.rpc("published_ecosystem_overview");
 if(error) throw error;
 const row=((data??[]) as Overview[])[0];
 const stats=[
  ["Companies listed",Number(row?.total_companies??0).toLocaleString()],
  ["Countries represented",Number(row?.countries??0).toLocaleString()],
  ["Sectors represented",Number(row?.sectors??0).toLocaleString()],
  ["Publicly disclosed funding rounds",Number(row?.disclosed_funding_rounds??0).toLocaleString()],
 ];
 return <main className="container-page space-y-8 py-10">
  <header className="max-w-3xl space-y-3"><p className="text-sm font-semibold uppercase tracking-wide text-primary">Buna Ecosystem Intelligence</p><h1 className="text-3xl font-bold sm:text-4xl">Explore the African startup ecosystem.</h1><p className="text-muted">A growing, source-conscious view of companies and the markets they operate in. The figures below describe records currently listed on Buna—not a complete census of every African business.</p></header>
  <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{stats.map(([label,value])=><Card key={label}><CardBody className="space-y-2 py-6"><p className="text-sm text-muted">{label}</p><p className="text-3xl font-bold tabular-nums">{value}</p></CardBody></Card>)}</section>
  <Card><CardBody className="space-y-3 py-6"><h2 className="text-xl font-semibold">Understand the coverage</h2><p className="text-sm text-muted">Buna is building this dataset progressively. Companies can submit information over time, and optional operating metrics or funding history are never required to create or publish a listing. Financial figures are counted here only when the company has chosen public visibility.</p><p className="text-sm text-muted">Company claims are labelled by source status. Founder-reported information is not independently verified unless it has completed review. Missing data should never be interpreted as zero activity or zero funding.</p><div className="flex flex-wrap gap-3 pt-2"><Link href="/startups" className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white">Explore companies</Link><Link href="/dashboard/startup/new" className="rounded-md border border-line px-4 py-2 text-sm font-semibold">Add a company</Link></div></CardBody></Card>
 </main>;
}

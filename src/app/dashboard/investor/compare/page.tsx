import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth/session";
import { getInvestorPortal } from "@/lib/investors/queries";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Compare startups", robots: { index: false } };
type CompareRow = {
  id: string; slug: string; name: string; tagline: string | null; problem_statement: string | null;
  solution: string | null; target_customers: string[]; target_geographies: string[]; market_opportunity: string | null;
  business_model: string | null; country: string | null; stage: string | null; funding_round: string | null;
  fundraising_status: string; funding_target: number | null; funding_currency: string;
  category: { name: string } | { name: string }[] | null;
};
const fields = ["Sector","Stage","Location","Problem","Solution","Customers","Geographies","Market opportunity","Business model","Funding round","Fundraising status","Funding target"] as const;
type FieldKey = "category" | "stage" | "country" | "problem_statement" | "solution" | "target_customers" | "target_geographies" | "market_opportunity" | "business_model" | "funding_round" | "fundraising_status" | "funding_target";
const keys: FieldKey[] = ["category","stage","country","problem_statement","solution","target_customers","target_geographies","market_opportunity","business_model","funding_round","fundraising_status","funding_target"];
function valueFor(row: CompareRow, key: FieldKey): string {
  if (key === "category") return (Array.isArray(row.category) ? row.category[0]?.name : row.category?.name) ?? "—";
  if (key === "funding_target") return row.funding_target == null ? "Not disclosed" : row.funding_currency + " " + Number(row.funding_target).toLocaleString();
  const value = row[key];
  return Array.isArray(value) ? value.join(", ") : String(value ?? "—").replace(/_/g, " ");
}

export default async function CompareStartupsPage({ searchParams }: { searchParams: Promise<{ ids?: string | string[] }> }) {
  const profile = await requireProfile("/dashboard/investor/compare");
  const { investor } = await getInvestorPortal(profile.id);
  if (!investor) redirect("/dashboard/investor");
  const params = await searchParams;
  const ids = (Array.isArray(params.ids) ? params.ids : [params.ids ?? ""]).filter((id) => /^[0-9a-f-]{36}$/i.test(id)).slice(0, 4);
  if (ids.length < 2) return <div className="space-y-3"><h1 className="text-2xl font-bold">Compare startups</h1><p className="text-sm text-muted">Select at least two companies in <Link className="underline" href="/dashboard/investor/discover">startup discovery</Link> to compare them side by side.</p></div>;
  const supabase = await createClient();
  const { data, error } = await supabase.from("startups")
    .select("id,slug,name,tagline,problem_statement,solution,target_customers,target_geographies,market_opportunity,business_model,country,stage,funding_round,fundraising_status,funding_target,funding_currency,category:categories(name)")
    .in("id", ids).eq("status", "published");
  if (error) throw error;
  const rows = (data ?? []) as unknown as CompareRow[];
  return (
    <div className="space-y-5">
      <header><p className="text-sm text-muted"><Link href="/dashboard/investor/discover">← Discovery</Link></p><h1 className="text-2xl font-bold">Startup comparison</h1><p className="text-sm text-muted">Compare up to four companies against the same investment criteria.</p></header>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {rows.map((startup) => <Card key={startup.id}><CardBody><h2 className="font-semibold"><Link href={"/startups/" + startup.slug}>{startup.name}</Link></h2><p className="text-sm text-muted">{startup.tagline}</p><Badge>{startup.fundraising_status}</Badge></CardBody></Card>)}
      </div>
      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full min-w-[42rem] text-sm"><tbody>
          {fields.map((label, index) => <tr key={label} className="border-b border-line"><th className="w-40 bg-surface p-3 text-left font-semibold">{label}</th>{rows.map((startup) => <td key={startup.id} className="min-w-48 p-3 align-top">{valueFor(startup, keys[index]!)}</td>)}</tr>)}
        </tbody></table>
      </div>
    </div>
  );
}

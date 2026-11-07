import type { Metadata } from "next";
import Link from "next/link";
import { requireProfile } from "@/lib/auth/session";
import { getInvestorPortal } from "@/lib/investors/queries";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { addStartupToPipelineAction, saveInvestorSearchAction } from "@/app/dashboard/investor/actions";
import { buttonStyles } from "@/components/ui/button";

export const metadata: Metadata = { title: "Discover deals", robots: { index: false } };

type Params = { q?: string; sector?: string; country?: string; stage?: string; round?: string; businessModel?: string; minTarget?: string; maxTarget?: string; raising?: string };
const clean = (v?: string) => (v ?? "").trim().slice(0, 100);

export default async function InvestorDiscoverPage({ searchParams }: { searchParams: Promise<Params> }) {
  const profile = await requireProfile("/dashboard/investor/discover");
  const { investor } = await getInvestorPortal(profile.id);
  if (!investor) redirect("/dashboard/investor");
  const p = await searchParams;
  const q = clean(p.q), country = clean(p.country), stage = clean(p.stage), round = clean(p.round), businessModel = clean(p.businessModel);
  const supabase = await createClient();
  let query = supabase.from("startups").select("id,slug,name,tagline,description,problem_statement,solution,country,stage,funding_round,fundraising_status,funding_target,funding_currency,business_model,target_geographies,category:categories(name,slug)")
    .eq("status","published").eq("is_demo",false).order("published_at",{ascending:false}).limit(100);
  if (q) query = query.or(`name.ilike."*${q}*",tagline.ilike."*${q}*",description.ilike."*${q}*",problem_statement.ilike."*${q}*"`);
  if (country) query = query.eq("country",country.toUpperCase());
  if (stage) query = query.eq("stage",stage);
  if (round) query = query.eq("funding_round",round);
  if (businessModel) query = query.ilike("business_model",`%${businessModel}%`);
  if (p.raising === "yes") query = query.in("fundraising_status",["raising","open_to_conversations"]);
  if (p.minTarget && Number.isFinite(Number(p.minTarget))) query = query.gte("funding_target",Number(p.minTarget));
  if (p.maxTarget && Number.isFinite(Number(p.maxTarget))) query = query.lte("funding_target",Number(p.maxTarget));
  if (p.sector) {
    const { data: category } = await supabase.from("categories").select("id").eq("slug",clean(p.sector)).maybeSingle();
    if (category) query = query.eq("category_id",category.id);
  }
  const { data, error } = await query;
  if (error) throw error;
  const rows = (data ?? []) as unknown as Array<{id:string;slug:string;name:string;tagline:string|null;description:string|null;problem_statement:string|null;solution:string|null;country:string|null;stage:string|null;funding_round:string|null;fundraising_status:string;funding_target:number|null;funding_currency:string;business_model:string|null;target_geographies:string[];category:{name:string;slug:string}|{name:string;slug:string}[]|null}>;
  const { data: categories } = await supabase.from("categories").select("name,slug").eq("is_active",true).order("sort_order");
  const filters = { sectors: clean(p.sector), stages: stage, geographies: country, businessModels: businessModel, fundingRounds: round, minTarget: clean(p.minTarget), maxTarget: clean(p.maxTarget), fundraisingOnly: p.raising === "yes" };
  return <div className="space-y-5">
    <header><p className="text-sm text-muted"><Link href="/dashboard/investor">Investor workspace</Link></p><h1 className="text-2xl font-bold">Discover investment opportunities</h1><p className="mt-1 text-sm text-muted">Filter live startup profiles against your investment thesis. Save a search to receive alerts when matching companies join Buna or begin fundraising.</p></header>
    <Card><CardBody>
      <form method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm">Keyword<input name="q" defaultValue={q} placeholder="Company, problem, product" className="mt-1 w-full rounded-md border border-line bg-canvas px-3 py-2" /></label>
        <label className="text-sm">Sector<select name="sector" defaultValue={clean(p.sector)} className="mt-1 w-full rounded-md border border-line bg-canvas px-3 py-2"><option value="">All sectors</option>{(categories ?? []).map(c=><option key={c.slug} value={c.slug}>{c.name}</option>)}</select></label>
        <label className="text-sm">Country<input name="country" defaultValue={country} placeholder="ET, KE, NG…" maxLength={2} className="mt-1 w-full rounded-md border border-line bg-canvas px-3 py-2" /></label>
        <label className="text-sm">Stage<select name="stage" defaultValue={stage} className="mt-1 w-full rounded-md border border-line bg-canvas px-3 py-2"><option value="">Any stage</option>{["idea","prototype","mvp","early_revenue","growth","scale"].map(x=><option key={x} value={x}>{x.replace(/_/g," ")}</option>)}</select></label>
        <label className="text-sm">Funding round<select name="round" defaultValue={round} className="mt-1 w-full rounded-md border border-line bg-canvas px-3 py-2"><option value="">Any round</option>{["pre_seed","seed","series_a","series_b","series_c","growth","debt","grant","other"].map(x=><option key={x} value={x}>{x.replace(/_/g," ")}</option>)}</select></label>
        <label className="text-sm">Business model<input name="businessModel" defaultValue={businessModel} placeholder="SaaS, marketplace…" className="mt-1 w-full rounded-md border border-line bg-canvas px-3 py-2" /></label>
        <label className="text-sm">Minimum funding target<input name="minTarget" defaultValue={clean(p.minTarget)} inputMode="decimal" className="mt-1 w-full rounded-md border border-line bg-canvas px-3 py-2" /></label>
        <label className="text-sm">Maximum funding target<input name="maxTarget" defaultValue={clean(p.maxTarget)} inputMode="decimal" className="mt-1 w-full rounded-md border border-line bg-canvas px-3 py-2" /></label>
        <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="raising" value="yes" defaultChecked={p.raising === "yes"} /> Only startups raising or open to investor conversations</label>
        <div className="flex gap-2 lg:col-span-4"><button className={buttonStyles("primary","md")} type="submit">Apply filters</button><Link href="/dashboard/investor/discover" className={buttonStyles("secondary","md")}>Clear</Link></div>
      </form>
    </CardBody></Card>
    <form action={saveInvestorSearchAction} className="flex flex-wrap items-end gap-2 rounded-lg border border-line p-3">
      <input type="hidden" name="sectors" value={filters.sectors} /><input type="hidden" name="stages" value={filters.stages} /><input type="hidden" name="geographies" value={filters.geographies} />
      <input type="hidden" name="businessModels" value={filters.businessModels} /><input type="hidden" name="fundingRounds" value={filters.fundingRounds} /><input type="hidden" name="minTarget" value={filters.minTarget} /><input type="hidden" name="maxTarget" value={filters.maxTarget} />
      <input type="hidden" name="fundraisingOnly" value={filters.fundraisingOnly ? "on" : ""} />
      <label className="min-w-48 flex-1 text-sm">Save this search<input name="name" required minLength={2} maxLength={80} placeholder="e.g. East African seed fintech" className="mt-1 w-full rounded-md border border-line bg-canvas px-3 py-2" /></label>
      <button className={buttonStyles("secondary","md")} type="submit">Save search + alerts</button>
    </form>
    <div className="flex items-center justify-between"><h2 className="font-semibold">{rows.length} matching startups</h2><Link href="/dashboard/investor/searches" className="text-sm font-medium underline">Saved searches</Link></div>
    <form action="/dashboard/investor/compare" method="get" className="space-y-3">
      {rows.length ? <div className="grid gap-3 lg:grid-cols-2">{rows.map(s=>{
        const cat=Array.isArray(s.category)?s.category[0]:s.category;
        return <Card key={s.id}><CardBody className="space-y-3">
          <div className="flex items-start justify-between gap-2"><div><h3 className="font-semibold"><Link href={"/startups/"+s.slug} className="hover:underline">{s.name}</Link></h3><p className="text-sm text-muted">{s.tagline}</p></div><input aria-label={"Select "+s.name+" to compare"} type="checkbox" name="ids" value={s.id} /></div>
          <p className="line-clamp-2 text-sm">{s.problem_statement || s.description || "The startup has not added a problem statement yet."}</p>
          <div className="flex flex-wrap gap-1.5">{cat?.name?<Badge>{cat.name}</Badge>:null}{s.stage?<Badge>{s.stage.replace(/_/g," ")}</Badge>:null}{s.funding_round?<Badge>{s.funding_round.replace(/_/g," ")}</Badge>:null}{s.fundraising_status==="raising"?<Badge tone="green">Raising</Badge>:null}</div>
          <div className="flex flex-wrap justify-between gap-2 text-xs text-muted"><span>{s.country || "Location not set"} · {s.business_model || "Model not set"}</span><span>{s.funding_target != null ? s.funding_currency+" "+Number(s.funding_target).toLocaleString() : "Target not disclosed"}</span></div>
          <form action={addStartupToPipelineAction}><input type="hidden" name="startupId" value={s.id}/><button className={buttonStyles("secondary","sm")} type="submit">Add to pipeline</button></form>
        </CardBody></Card>
      })}</div> : <p className="rounded-lg border border-line p-6 text-sm text-muted">No startups match those filters. Broaden your thesis criteria or clear a filter.</p>}
      <button className={buttonStyles("primary","md")} type="submit">Compare selected startups</button>
    </form>
  </div>;
}

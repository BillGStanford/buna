import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth/session";
import { getInvestorPortal } from "@/lib/investors/queries";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
export const metadata: Metadata = { title: "Compare startups", robots: { index: false } };
export default async function CompareStartupsPage({searchParams}:{searchParams:Promise<{ids?:string|string[]}>}){
 const profile=await requireProfile("/dashboard/investor/compare"); const {investor}=await getInvestorPortal(profile.id); if(!investor) redirect("/dashboard/investor");
 const p=await searchParams; const ids=(Array.isArray(p.ids)?p.ids:[p.ids??""]).filter(x=>/^[0-9a-f-]{36}$/i.test(x)).slice(0,4);
 if(ids.length<2) return <div className="space-y-3"><h1 className="text-2xl font-bold">Compare startups</h1><p className="text-sm text-muted">Select at least two companies in <Link className="underline" href="/dashboard/investor/discover">startup discovery</Link> to compare them side by side.</p></div>;
 const supabase=await createClient(); const {data,error}=await supabase.from("startups").select("id,slug,name,tagline,problem_statement,solution,target_customers,target_geographies,market_opportunity,business_model,country,stage,funding_round,fundraising_status,funding_target,funding_currency,category:categories(name)").in("id",ids).eq("status","published"); if(error) throw error;
 const rows=(data??[]) as Array<Record<string,any>>;
 const fields:[string,string][]=[["Sector","category"],["Stage","stage"],["Location","country"],["Problem","problem_statement"],["Solution","solution"],["Customers","target_customers"],["Geographies","target_geographies"],["Market opportunity","market_opportunity"],["Business model","business_model"],["Funding round","funding_round"],["Fundraising status","fundraising_status"],["Funding target","funding_target"]];
 return <div className="space-y-5"><header><p className="text-sm text-muted"><Link href="/dashboard/investor/discover">← Discovery</Link></p><h1 className="text-2xl font-bold">Startup comparison</h1><p className="text-sm text-muted">Compare up to four companies against the same investment criteria.</p></header><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{rows.map(s=><Card key={s.id}><CardBody><h2 className="font-semibold"><Link href={"/startups/"+s.slug}>{s.name}</Link></h2><p className="text-sm text-muted">{s.tagline}</p><Badge>{s.fundraising_status}</Badge></CardBody></Card>)}</div><div className="overflow-x-auto rounded-lg border border-line"><table className="w-full min-w-[42rem] text-sm"><tbody>{fields.map(([label,key])=><tr key={key} className="border-b border-line"><th className="w-40 bg-surface p-3 text-left font-semibold">{label}</th>{rows.map(s=><td key={s.id} className="min-w-48 p-3 align-top">{key==="category"?(Array.isArray(s.category)?s.category[0]?.name:s.category?.name)||"—":key==="funding_target"?(s.funding_target==null?"Not disclosed":s.funding_currency+" "+Number(s.funding_target).toLocaleString()):Array.isArray(s[key])?s[key].join(", "):String(s[key]??"—").replace(/_/g," ")}</td>)}</tr>)}</tbody></table></div></div>;
}
import Link from "next/link";
import { WorkProjectCard,type WorkProjectSummary } from "@/components/work/work-project-card";
import { createClient } from "@/lib/supabase/server";

type Props={searchParams:Promise<{q?:string;category?:string;skill?:string}>};
export const metadata={title:"Find paid projects — Buna Work"};
export default async function ProjectsPage({searchParams}:Props){
 const params=await searchParams,q=(params.q??"").trim().slice(0,80),category=(params.category??"").trim().slice(0,60),skill=(params.skill??"").trim().slice(0,40);
 const supabase=await createClient();
 let query=supabase.from("work_projects").select("id,slug,title,summary,category,skills,budget_min,budget_max,currency,experience_level,work_location,created_at").eq("status","published").order("created_at",{ascending:false}).limit(60);
 if(q)query=query.or(`title.ilike.%${q}%,summary.ilike.%${q}%,category.ilike.%${q}%`);
 if(category)query=query.eq("category",category);
 if(skill)query=query.contains("skills",[skill]);
 const {data}=await query;
 const categories=[...new Set((data??[]).map(p=>p.category))].sort();
 return <div className="container-page space-y-6 py-9">
  <header><p className="text-xs font-semibold uppercase tracking-wide text-primary-deep">Buna Work</p><h1 className="mt-2 text-3xl font-bold">Find paid projects</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted">Explore fixed-price projects from founders and organizations. Budgets are shown in Ethiopian birr for the V1 payment flow.</p></header>
  <form className="grid gap-3 rounded-xl border border-line bg-surface p-4 md:grid-cols-[1fr_15rem_auto]"><label className="text-sm font-medium">Search projects<input name="q" defaultValue={q} placeholder="e.g. Flutter developer, brand identity" className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm font-normal"/></label><label className="text-sm font-medium">Category<select name="category" defaultValue={category} className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm font-normal"><option value="">All categories</option>{categories.map(c=><option key={c}>{c}</option>)}</select></label><button className="self-end rounded-md bg-primary px-5 py-2 text-sm font-semibold text-white">Search</button></form>
  <div className="flex items-center justify-between"><p className="text-sm text-muted">{data?.length??0} open projects</p><Link href="/dashboard/work/projects/new" className="text-sm font-semibold text-primary-deep">Post a project →</Link></div>
  {data?.length?<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{data.map(p=><WorkProjectCard key={p.id} project={p as WorkProjectSummary}/>)}</div>:<div className="rounded-xl border border-dashed border-line p-10 text-center"><h2 className="font-semibold">No matching projects yet</h2><p className="mt-2 text-sm text-muted">Try another search or check back as founders publish new work.</p></div>}
 </div>;
}

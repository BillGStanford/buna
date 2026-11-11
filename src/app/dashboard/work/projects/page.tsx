import Link from "next/link";
import {Card,CardBody} from "@/components/ui/card";
import {buttonStyles} from "@/components/ui/button";
import {requireProfile} from "@/lib/auth/session";
import {createClient} from "@/lib/supabase/server";
export const metadata={title:"My projects — Buna Work"};
export default async function MyWorkProjects(){
 const profile=await requireProfile("/dashboard/work/projects"),supabase=await createClient();
 const {data}=await supabase.from("work_projects").select("id,slug,title,summary,status,budget_min,budget_max,applications_count,created_at").eq("employer_id",profile.id).order("created_at",{ascending:false});
 return <div className="space-y-5"><header className="flex flex-wrap items-end justify-between gap-3"><div><Link href="/dashboard/work" className="text-sm text-primary-deep">← Work dashboard</Link><h1 className="mt-2 text-2xl font-bold">My projects</h1><p className="mt-1 text-sm text-muted">Manage published work and review proposals from freelancers.</p></div><Link href="/dashboard/work/projects/new" className={buttonStyles("primary","md")}>Post a project</Link></header>
 {data?.length?<div className="space-y-3">{data.map(p=><Card key={p.id}><CardBody className="flex flex-wrap items-center justify-between gap-3 p-5"><div className="min-w-0"><h2 className="font-semibold"><Link href={"/dashboard/work/projects/"+p.id} className="text-ink no-underline hover:underline">{p.title}</Link></h2><p className="mt-1 line-clamp-2 text-sm text-muted">{p.summary}</p><p className="mt-2 text-xs text-muted">{p.applications_count} proposals · ETB {Number(p.budget_min).toLocaleString()}–{Number(p.budget_max).toLocaleString()}</p></div><span className="rounded-md border border-line px-3 py-1.5 text-xs font-semibold capitalize">{p.status}</span></CardBody></Card>)}</div>:<Card><CardBody className="p-8 text-center"><h2 className="font-semibold">You have not posted a project</h2><p className="mt-1 text-sm text-muted">Start by describing the work you need done.</p><Link href="/dashboard/work/projects/new" className="mt-4 inline-block text-sm font-semibold text-primary-deep">Publish your first project →</Link></CardBody></Card>}
 </div>;
}

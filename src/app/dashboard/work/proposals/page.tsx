import Link from "next/link";
import {Card,CardBody} from "@/components/ui/card";
import {requireProfile} from "@/lib/auth/session";
import {createClient} from "@/lib/supabase/server";
export const metadata={title:"My proposals — Buna Work"};
export default async function MyWorkProposals(){
 const profile=await requireProfile("/dashboard/work/proposals"),supabase=await createClient();
 const {data}=await supabase.from("work_proposals").select("id,project_id,cover_letter,proposed_amount,estimated_days,status,created_at,work_projects(title,slug,status)").eq("freelancer_id",profile.id).order("created_at",{ascending:false});
 return <div className="space-y-5"><header><Link href="/dashboard/work" className="text-sm text-primary-deep">← Work dashboard</Link><h1 className="mt-2 text-2xl font-bold">My proposals</h1><p className="mt-1 text-sm text-muted">Track applications and employer decisions.</p></header>
 {data?.length?<div className="space-y-3">{data.map(p=>{const project=Array.isArray(p.work_projects)?p.work_projects[0]:p.work_projects;return <Card key={p.id}><CardBody className="flex flex-wrap items-center justify-between gap-3 p-5"><div><Link href={"/work/projects/"+project?.slug} className="font-semibold text-ink no-underline hover:underline">{project?.title??"Project"}</Link><p className="mt-1 text-sm text-muted">ETB {Number(p.proposed_amount).toLocaleString()} · {p.estimated_days} days</p><p className="mt-1 line-clamp-2 text-xs text-muted">{p.cover_letter}</p></div><span className="rounded-md border border-line px-3 py-1.5 text-xs font-semibold capitalize">{p.status}</span></CardBody></Card>})}</div>:<Card><CardBody className="p-8 text-center"><p className="font-medium">No proposals yet</p><Link href="/work/projects" className="mt-2 inline-block text-sm font-semibold text-primary-deep">Find your first project →</Link></CardBody></Card>}
 </div>;
}

import Link from "next/link";
import {Card,CardBody} from "@/components/ui/card";
import {requireProfile} from "@/lib/auth/session";
import {createClient} from "@/lib/supabase/server";
export const metadata={title:"Contracts — Buna Work"};
export default async function WorkContractsPage(){
 const profile=await requireProfile("/dashboard/work/contracts"),supabase=await createClient();
 const {data}=await supabase.from("work_contracts").select("id,title,agreed_amount,currency,status,employer_id,freelancer_id,created_at,due_at").or("employer_id.eq."+profile.id+",freelancer_id.eq."+profile.id).order("created_at",{ascending:false});
 const ids=[...new Set((data??[]).map(c=>c.employer_id===profile.id?c.freelancer_id:c.employer_id))],{data:people}=ids.length?await supabase.from("public_profiles").select("id,username,display_name").in("id",ids):{data:[]};
 const map=new Map((people??[]).map(p=>[p.id,p]));
 return <div className="space-y-5"><header><Link href="/dashboard/work" className="text-sm text-primary-deep">← Work dashboard</Link><h1 className="mt-2 text-2xl font-bold">Contracts</h1><p className="mt-1 text-sm text-muted">Your agreements, deliverables, conversations and payment records.</p></header>
 {data?.length?<div className="space-y-3">{data.map(c=>{const other=map.get(c.employer_id===profile.id?c.freelancer_id:c.employer_id);return <Card key={c.id}><CardBody className="flex flex-wrap items-center justify-between gap-3 p-5"><div><Link href={"/dashboard/work/contracts/"+c.id} className="font-semibold text-ink no-underline hover:underline">{c.title}</Link><p className="mt-1 text-sm text-muted">{c.employer_id===profile.id?"Freelancer":"Client"}: {other?.display_name??"Buna member"}</p><p className="mt-1 text-xs capitalize text-muted">{c.status} · Due {c.due_at?new Date(c.due_at).toLocaleDateString():"to be agreed"}</p></div><div className="text-right"><p className="font-semibold">ETB {Number(c.agreed_amount).toLocaleString()}</p><span className="text-xs text-muted">Agreed total</span></div></CardBody></Card>})}</div>:<Card><CardBody className="p-8 text-center"><p className="font-medium">No contracts yet</p><p className="mt-1 text-sm text-muted">Contracts are created when an employer hires a proposal.</p><Link href="/work/projects" className="mt-3 inline-block text-sm font-semibold text-primary-deep">Explore projects →</Link></CardBody></Card>}
 </div>;
}

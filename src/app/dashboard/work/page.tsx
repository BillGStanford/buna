import Link from "next/link";
import {BriefcaseBusiness,FileText,Handshake,Users} from "lucide-react";
import {Card,CardBody,CardHeader} from "@/components/ui/card";
import {buttonStyles} from "@/components/ui/button";
import {requireProfile} from "@/lib/auth/session";
import {createClient} from "@/lib/supabase/server";
export const metadata={title:"Work dashboard"};
export default async function WorkDashboard(){
 const profile=await requireProfile("/dashboard/work"),supabase=await createClient();
 const [workProfile,projects,proposals,contracts,incoming]=await Promise.all([
  supabase.from("work_profiles").select("user_id,headline,availability").eq("user_id",profile.id).maybeSingle(),
  supabase.from("work_projects").select("id,status").eq("employer_id",profile.id),
  supabase.from("work_proposals").select("id,status").eq("freelancer_id",profile.id),
  supabase.from("work_contracts").select("id,status,title,created_at").or("employer_id.eq."+profile.id+",freelancer_id.eq."+profile.id).order("created_at",{ascending:false}).limit(5),
  supabase.from("work_invitations").select("id,status").eq("freelancer_id",profile.id).eq("status","pending"),
 ]);
 const stats=[{label:"Your projects",value:projects.data?.length??0,icon:BriefcaseBusiness},{label:"Proposals sent",value:proposals.data?.length??0,icon:FileText},{label:"Active contracts",value:contracts.data?.filter(c=>c.status==="active").length??0,icon:Handshake},{label:"Invitations",value:incoming.data?.length??0,icon:Users}];
 return <div className="space-y-6"><header className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-primary-deep">Buna Work</p><h1 className="mt-1 text-2xl font-bold">Work dashboard</h1><p className="mt-1 text-sm text-muted">Manage your freelance profile, projects, proposals and contracts.</p></div><Link href="/work" className={buttonStyles("secondary","md")}>View marketplace</Link></header>
  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{stats.map(s=><Card key={s.label}><CardBody className="flex items-center gap-3 p-4"><s.icon className="h-5 w-5 text-primary-deep"/><div><p className="text-xs text-muted">{s.label}</p><p className="text-2xl font-bold tabular-nums">{s.value}</p></div></CardBody></Card>)}</div>
  <div className="grid gap-4 lg:grid-cols-2"><Card><CardHeader><h2 className="font-semibold">Freelancer profile</h2></CardHeader><CardBody>{workProfile.data?<><p className="font-medium">{workProfile.data.headline}</p><p className="mt-1 text-sm text-muted">Availability: {workProfile.data.availability}</p><Link href="/dashboard/work/profile" className="mt-4 inline-block text-sm font-semibold text-primary-deep">Manage your profile →</Link></>:<><p className="text-sm text-muted">Show your skills and portfolio to founders looking for independent talent.</p><Link href="/dashboard/work/profile" className="mt-4 inline-block text-sm font-semibold text-primary-deep">Create freelancer profile →</Link></>}</CardBody></Card>
  <Card><CardHeader><h2 className="font-semibold">Hire talent</h2></CardHeader><CardBody><p className="text-sm text-muted">Publish a paid project, review proposals and hire from the Buna talent network.</p><Link href="/dashboard/work/projects/new" className="mt-4 inline-block text-sm font-semibold text-primary-deep">Post a project →</Link></CardBody></Card></div>
  <Card><CardHeader className="flex flex-row items-center justify-between"><h2 className="font-semibold">Recent contracts</h2><Link href="/dashboard/work/contracts" className="text-sm font-semibold text-primary-deep">All contracts</Link></CardHeader><CardBody>{contracts.data?.length?<ul className="divide-y divide-line">{contracts.data.map(c=><li key={c.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"><div><Link href={"/dashboard/work/contracts/"+c.id} className="font-medium text-ink no-underline hover:underline">{c.title}</Link><p className="mt-1 text-xs capitalize text-muted">{c.status}</p></div><span className="text-xs text-muted">{new Date(c.created_at).toLocaleDateString()}</span></li>)}</ul>:<p className="text-sm text-muted">Your contracts will appear here after a proposal is accepted.</p>}</CardBody></Card>
  <div className="flex flex-wrap gap-3 text-sm"><Link href="/dashboard/work/projects" className="text-primary-deep">My projects</Link><Link href="/dashboard/work/proposals" className="text-primary-deep">My proposals</Link><Link href="/dashboard/work/invitations" className="text-primary-deep">Invitations</Link><Link href="/dashboard/work/contracts" className="text-primary-deep">Contracts</Link><Link href="/dashboard/work/projects" className="text-primary-deep">My projects</Link></div>
 </div>;
}

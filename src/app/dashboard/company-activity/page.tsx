import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Bell, Building2, CalendarDays, MessageSquare, Megaphone, Package, Sparkles } from "lucide-react";
import { requireProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Company activity" };
type Event = { id:string; company:string; title:string; detail:string; date:string; kind:string; href:string; attention?:boolean };
const dateLabel=(v:string)=>new Date(v).toLocaleDateString("en",{month:"short",day:"numeric",year:"numeric"});

export default async function CompanyActivityPage(){
 const profile=await requireProfile("/dashboard/activity"); const db=await createClient();
 const {data:members,error:memberError}=await db.from("startup_members").select("startup_id,role,startup:startups(id,name)").eq("user_id",profile.id);
 if(memberError) throw memberError;
 const companies=(members??[]).flatMap(r=>{const s=(Array.isArray(r.startup)?r.startup[0]:r.startup) as {id:string;name:string}|null;return s&&["owner","admin","editor"].includes(r.role)?[s]:[]});
 const ids=companies.map(c=>c.id), names=new Map(companies.map(c=>[c.id,c.name]));
 const [inq,news,miles,releases,launches]=ids.length?await Promise.all([
  db.from("inquiries").select("id,startup_id,subject,sender_name,status,created_at").in("startup_id",ids).order("created_at",{ascending:false}).limit(30),
  db.from("startup_announcements").select("id,startup_id,title,announcement_type,created_at,published_at,is_public").in("startup_id",ids).order("created_at",{ascending:false}).limit(20),
  db.from("startup_milestones").select("id,startup_id,title,created_at,completed_at,target_date").in("startup_id",ids).order("created_at",{ascending:false}).limit(20),
  db.from("startup_changelog").select("id,startup_id,title,version,released_on").in("startup_id",ids).order("released_on",{ascending:false}).limit(20),
  db.from("launches").select("id,startup_id,name,status,vote_count,comment_count,created_at").in("startup_id",ids).order("created_at",{ascending:false}).limit(20)
 ]):[{data:[]},{data:[]},{data:[]},{data:[]},{data:[]} ] as const;
 for(const r of [inq,news,miles,releases,launches]) if("error" in r&&r.error) throw r.error;
 const events:Event[]=[];
 for(const r of inq.data??[])events.push({id:"i"+r.id,company:names.get(r.startup_id)??"",title:r.subject,detail:"Inquiry from "+r.sender_name,date:r.created_at,kind:"inquiry",href:"/dashboard/inquiries",attention:r.status==="new"});
 for(const r of news.data??[])events.push({id:"n"+r.id,company:names.get(r.startup_id)??"",title:r.title,detail:r.announcement_type.replace(/_/g," ")+(r.is_public?" · Public":" · Private"),date:r.published_at??r.created_at,kind:"announcement",href:`/dashboard/startup/${r.startup_id}/updates`});
 for(const r of miles.data??[])events.push({id:"m"+r.id,company:names.get(r.startup_id)??"",title:r.title,detail:r.completed_at?"Milestone completed":"Company milestone",date:r.completed_at??r.created_at,kind:"milestone",href:`/dashboard/startup/${r.startup_id}/updates`});
 for(const r of releases.data??[])events.push({id:"r"+r.id,company:names.get(r.startup_id)??"",title:r.title,detail:r.version?"Product release · "+r.version:"Product release",date:r.released_on,kind:"release",href:`/dashboard/startup/${r.startup_id}/updates`});
 for(const r of launches.data??[])events.push({id:"l"+r.id,company:names.get(r.startup_id)??"",title:r.name,detail:`${r.vote_count} votes · ${r.comment_count} comments · ${r.status}`,date:r.created_at,kind:"launch",href:"/dashboard/launches"});
 events.sort((a,b)=>Date.parse(b.date)-Date.parse(a.date));
 const unread=(inq.data??[]).filter(r=>r.status==="new").length, published=(news.data??[]).filter(r=>r.is_public).length, live=(launches.data??[]).filter(r=>r.status==="published").length;
 const actions=[...(unread?[{title:"Respond to new inquiries",body:`${unread} new message(s) are waiting for a response.`,href:"/dashboard/inquiries",cta:"Open inquiries"}]:[]),...(companies.length&&published===0?[{title:"Share a company update",body:"Tell followers what your team is building or what has changed.",href:`/dashboard/startup/${companies[0].id}/updates`,cta:"Write an update"}]:[]),...(companies.length&&live===0?[{title:"Introduce a product launch",body:"Help customers and investors discover what your company makes.",href:"/dashboard/launches",cta:"Explore launches"}]:[])].slice(0,3);
 const icon=(kind:string)=>kind==="inquiry"?MessageSquare:kind==="announcement"?Megaphone:kind==="milestone"?CalendarDays:kind==="release"?Package:Building2;
 return <div className="mx-auto max-w-6xl space-y-6">
  <header className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary-deep">Business workspace</p><h1 className="mt-2 text-3xl font-bold">Company activity</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted">Inquiries, announcements, milestones, product releases and launches across the companies you manage.</p></div><Link href="/dashboard" className="text-sm font-semibold text-primary-deep">Back to workspace <ArrowRight className="ml-1 inline h-4 w-4"/></Link></header>
  <section className="grid gap-3 sm:grid-cols-3"><Card><CardBody className="p-5"><p className="text-2xl font-bold">{companies.length}</p><p className="text-sm text-muted">Companies managed</p></CardBody></Card><Card><CardBody className="p-5"><p className="text-2xl font-bold">{unread}</p><p className="text-sm text-muted">New inquiries in recent activity</p></CardBody></Card><Card><CardBody className="p-5"><p className="text-2xl font-bold">{events.length}</p><p className="text-sm text-muted">Recorded recent events</p></CardBody></Card></section>
  {actions.length?<section className="space-y-3"><div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary-deep"/><h2 className="font-semibold">Recommended next actions</h2></div><div className="grid gap-3 md:grid-cols-2">{actions.map(a=><Card key={a.title}><CardBody className="flex h-full flex-col items-start gap-3 p-5"><div><h3 className="font-semibold">{a.title}</h3><p className="mt-1 text-sm text-muted">{a.body}</p></div><Link href={a.href} className="mt-auto text-sm font-semibold text-primary-deep">{a.cta} <ArrowRight className="ml-1 inline h-3.5 w-3.5"/></Link></CardBody></Card>)}</div></section>:null}
  <Card><CardHeader><div className="flex items-center justify-between gap-3"><div><h2 className="font-semibold">Latest activity</h2><p className="mt-1 text-sm text-muted">Private company records are visible only to authorized teammates.</p></div><Badge tone="neutral">{events.length} items</Badge></div></CardHeader><CardBody>
   {!companies.length?<div className="py-8 text-center"><Building2 className="mx-auto h-8 w-8 text-muted"/><h3 className="mt-3 font-semibold">No company workspace yet</h3><p className="mt-1 text-sm text-muted">Create a startup or accept a team invitation to see activity.</p><Link href="/dashboard/startup/new" className="mt-4 inline-flex text-sm font-semibold text-primary-deep">Create a startup <ArrowRight className="ml-1 h-4 w-4"/></Link></div>:!events.length?<div className="py-8 text-center"><Bell className="mx-auto h-8 w-8 text-muted"/><h3 className="mt-3 font-semibold">Your activity will appear here</h3><p className="mt-1 text-sm text-muted">Publish an update, receive an inquiry, add a milestone or launch a product.</p></div>:<ol className="divide-y divide-line">{events.slice(0,60).map(e=>{const Icon=icon(e.kind);return <li key={e.id} className="flex gap-3 py-4"><div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-secondary"><Icon className="h-4 w-4 text-muted"/></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-medium">{e.title}</p><Badge tone="neutral">{e.kind}</Badge>{e.attention?<Badge tone="warning">Needs attention</Badge>:null}</div><p className="mt-1 text-sm text-muted">{e.company} · {e.detail}</p><p className="mt-1 text-xs text-muted">{dateLabel(e.date)}</p></div><Link href={e.href} className="shrink-0 self-center text-sm font-semibold text-primary-deep">Open <ArrowRight className="ml-1 inline h-3.5 w-3.5"/></Link></li>})}</ol>}
  </CardBody></Card>
 </div>;
}
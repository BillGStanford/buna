import Link from "next/link";
import { ArrowRight, BriefcaseBusiness, Search, ShieldCheck, Users } from "lucide-react";
import { Card,CardBody } from "@/components/ui/card";
import { buttonStyles } from "@/components/ui/button";
import { WorkProjectCard,type WorkProjectSummary } from "@/components/work/work-project-card";
import { WorkTalentCard,type WorkTalentSummary } from "@/components/work/work-talent-card";
import { createClient } from "@/lib/supabase/server";

export const metadata={title:"Work — Find talent and paid projects",description:"A professional marketplace for African startups and independent talent."};
export default async function WorkHome(){
 const supabase=await createClient();
 const [{data:projects},{data:workProfiles}]=await Promise.all([
  supabase.from("work_projects").select("id,slug,title,summary,category,skills,budget_min,budget_max,currency,experience_level,work_location,created_at").eq("status","published").order("created_at",{ascending:false}).limit(6),
  supabase.from("work_profiles").select("user_id,headline,bio,skills,experience_level,hourly_rate,availability").eq("is_public",true).eq("availability","available").order("updated_at",{ascending:false}).limit(6),
 ]);
 const ids=(workProfiles??[]).map(x=>x.user_id);
 const {data:publicProfiles}=ids.length?await supabase.from("public_profiles").select("id,username,display_name,avatar_url,country,city").in("id",ids):{data:[]};
 const map=new Map((publicProfiles??[]).map(p=>[p.id,p]));
 const talent=(workProfiles??[]).flatMap(p=>{const u=map.get(p.user_id);return u?[{...p,username:u.username,display_name:u.display_name,avatar_url:u.avatar_url,country:u.country,city:u.city}]:[]}) as WorkTalentSummary[];
 return <div className="container-page space-y-12 py-10 sm:py-14">
  <section className="grid gap-8 rounded-2xl border border-line bg-primary-pale/50 p-6 sm:p-10 lg:grid-cols-[1.2fr_.8fr] lg:items-center">
   <div><p className="text-xs font-semibold uppercase tracking-[.16em] text-primary-deep">Buna Work</p><h1 className="mt-3 max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">Good work deserves a bigger market.</h1><p className="mt-4 max-w-xl text-base leading-7 text-muted">A professional place for African startups to hire skilled people—and for independent talent to find meaningful, paid work.</p>
    <div className="mt-7 flex flex-wrap gap-3"><Link href="/work/projects" className={buttonStyles("primary","lg")}>Find projects <ArrowRight className="ml-2 h-4 w-4"/></Link><Link href="/work/talent" className={buttonStyles("secondary","lg")}>Find talent</Link></div>
    <p className="mt-4 text-xs text-muted">One Buna account. Two ways to participate: hire and freelance.</p>
   </div>
   <div className="grid gap-3 sm:grid-cols-2">
    <Card><CardBody className="p-5"><BriefcaseBusiness className="h-6 w-6 text-primary-deep"/><h2 className="mt-4 font-semibold">Hire for the work</h2><p className="mt-2 text-sm leading-6 text-muted">Publish a project, review proposals, agree terms and manage delivery.</p><Link href="/dashboard/work/projects/new" className="mt-4 inline-block text-sm font-semibold text-primary-deep">Post a project →</Link></CardBody></Card>
    <Card><CardBody className="p-5"><Users className="h-6 w-6 text-primary-deep"/><h2 className="mt-4 font-semibold">Get hired for your skills</h2><p className="mt-2 text-sm leading-6 text-muted">Show your expertise, build a portfolio and apply for paid projects.</p><Link href="/dashboard/work/profile" className="mt-4 inline-block text-sm font-semibold text-primary-deep">Create talent profile →</Link></CardBody></Card>
   </div>
  </section>
  <section className="grid gap-4 sm:grid-cols-3">
   {[{icon:Search,title:"Discover opportunities",body:"Browse real projects with clear budgets and expectations."},{icon:ShieldCheck,title:"Work with clarity",body:"Agreements, milestones, submissions and messages stay together."},{icon:BriefcaseBusiness,title:"Build a record",body:"Completed contracts and verified reviews strengthen your profile."}].map(x=><div key={x.title} className="border-l-2 border-primary/30 pl-4"><x.icon className="h-5 w-5 text-primary-deep"/><h2 className="mt-2 font-semibold">{x.title}</h2><p className="mt-1 text-sm leading-6 text-muted">{x.body}</p></div>)}
  </section>
  <section className="space-y-4"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-primary-deep">Open opportunities</p><h2 className="mt-1 text-2xl font-bold">Projects looking for talent</h2></div><Link href="/work/projects" className="text-sm font-semibold text-primary-deep">Browse all projects →</Link></div>
   {(projects??[]).length?<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{(projects??[]).map(p=><WorkProjectCard key={p.id} project={p as WorkProjectSummary}/>)}</div>:<Card><CardBody className="p-7 text-center"><p className="font-medium">The marketplace is ready for its first projects.</p><p className="mt-1 text-sm text-muted">Be among the first founders to publish paid work.</p><Link href="/dashboard/work/projects/new" className="mt-4 inline-block text-sm font-semibold text-primary-deep">Post the first project →</Link></CardBody></Card>}
  </section>
  <section className="space-y-4"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-primary-deep">Independent talent</p><h2 className="mt-1 text-2xl font-bold">People ready to contribute</h2></div><Link href="/work/talent" className="text-sm font-semibold text-primary-deep">Explore talent →</Link></div>
   {talent.length?<div className="grid gap-3 lg:grid-cols-2">{talent.map(p=><WorkTalentCard key={p.user_id} person={p}/>)}</div>:<Card><CardBody className="p-7 text-center text-sm text-muted">Freelancer profiles will appear here as people activate their Work profiles.</CardBody></Card>}
  </section>
  <section className="rounded-xl border border-line p-6 sm:flex sm:items-center sm:justify-between sm:gap-6"><div><h2 className="text-xl font-semibold">Bring your skills into the Buna economy.</h2><p className="mt-1 text-sm text-muted">Your existing Buna identity is your professional identity.</p></div><Link href="/dashboard/work" className={buttonStyles("secondary","md")}>Open Work dashboard</Link></section>
 </div>;
}

import Link from "next/link";
import {WorkTalentCard,type WorkTalentSummary} from "@/components/work/work-talent-card";
import {createClient} from "@/lib/supabase/server";
type Props={searchParams:Promise<{q?:string;skill?:string;availability?:string}>};
export const metadata={title:"Find independent talent — Buna Work"};
export default async function TalentPage({searchParams}:Props){
 const params=await searchParams,q=(params.q??"").trim().slice(0,60),skill=(params.skill??"").trim().slice(0,40),availability=params.availability??"available";
 const supabase=await createClient();
 let query=supabase.from("work_profiles").select("user_id,headline,bio,skills,experience_level,hourly_rate,availability").eq("is_public",true).order("updated_at",{ascending:false}).limit(100);
 if(availability!=="all")query=query.eq("availability",availability);
 if(skill)query=query.contains("skills",[skill]);
 const {data:profiles}=await query;
 const ids=(profiles??[]).map(p=>p.user_id);
 const {data:publicUsers}=ids.length?await supabase.from("public_profiles").select("id,username,display_name,avatar_url,country,city").in("id",ids):{data:[]};
 const map=new Map((publicUsers??[]).map(p=>[p.id,p]));
 const people=(profiles??[]).flatMap(p=>{const u=map.get(p.user_id);if(!u)return[];const person={...p,username:u.username,display_name:u.display_name,avatar_url:u.avatar_url,country:u.country,city:u.city};return !q||[person.headline,person.bio,person.display_name,...person.skills].some(v=>v.toLowerCase().includes(q.toLowerCase()))?[person]:[]}) as WorkTalentSummary[];
 return <div className="container-page space-y-6 py-9"><header><p className="text-xs font-semibold uppercase tracking-wide text-primary-deep">Buna Work</p><h1 className="mt-2 text-3xl font-bold">Find independent talent</h1><p className="mt-2 text-sm leading-6 text-muted">Discover designers, developers, operators, writers and other professionals building across Africa.</p></header>
 <form className="grid gap-3 rounded-xl border border-line p-4 sm:grid-cols-[1fr_14rem_auto]"><label className="text-sm font-medium">Search people and skills<input name="q" defaultValue={q} placeholder="Name, specialty or skill" className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm font-normal"/></label><label className="text-sm font-medium">Availability<select name="availability" defaultValue={availability} className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm font-normal"><option value="available">Available</option><option value="limited">Limited availability</option><option value="unavailable">All profiles</option><option value="all">All</option></select></label><button className="self-end rounded-md bg-primary px-5 py-2 text-sm font-semibold text-white">Search</button></form>
 <div className="flex justify-between text-sm text-muted"><span>{people.length} people listed</span><Link href="/dashboard/work/profile" className="font-semibold text-primary-deep">List your skills →</Link></div>
 {people.length?<div className="grid gap-3 lg:grid-cols-2">{people.map(p=><WorkTalentCard key={p.user_id} person={p}/>)}</div>:<div className="rounded-xl border border-dashed border-line p-10 text-center"><h2 className="font-semibold">No talent profiles match yet</h2><p className="mt-2 text-sm text-muted">People can create a profile from their existing Buna account.</p></div>}
 </div>;
}

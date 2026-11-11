import type { Metadata } from "next";
import Link from "next/link";
import { getUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Co-Founder Discovery",
  description: "Meet ambitious people building the next generation of African companies.",
  alternates: { canonical: "/cofounders" },
};

async function saveProfile(formData: FormData) {
  "use server";
  const user = await getUser();
  if (!user) return;
  const supabase = await createClient();
  const headline = String(formData.get("headline") ?? "").trim();
  const bio = String(formData.get("bio") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  const skills = String(formData.get("skills") ?? "").split(",").map((v) => v.trim()).filter(Boolean).slice(0, 20);
  const roles = String(formData.get("roles") ?? "").split(",").map((v) => v.trim()).filter(Boolean).slice(0, 10);
  const commitment = String(formData.get("commitment") ?? "exploring");
  const { data: existing } = await supabase.from("cofounder_profiles").select("user_id").eq("user_id", user.id).maybeSingle();
  const payload = { user_id: user.id, headline, bio, location: location || null, skills, role_seeking: roles, commitment, opted_in: true, approval_status: "pending", is_paused: false };
  if (existing) await supabase.from("cofounder_profiles").update(payload).eq("user_id", user.id);
  else await supabase.from("cofounder_profiles").insert(payload);
}

async function createOpportunity(formData: FormData) {
  "use server";
  const user = await getUser();
  if (!user) return;
  const title = String(formData.get("title") ?? "").trim();
  const problem = String(formData.get("problem") ?? "").trim();
  const industry = String(formData.get("industry") ?? "").trim();
  const lookingFor = String(formData.get("looking_for") ?? "").split(",").map((v) => v.trim()).filter(Boolean).slice(0, 10);
  if (title.length < 5 || problem.length < 30) return;
  const supabase = await createClient();
  await supabase.from("cofounder_opportunities").insert({ user_id: user.id, title, problem, industry: industry || null, looking_for: lookingFor });
}

async function sendConnection(formData: FormData) {
  "use server";
  const user = await getUser();
  if (!user) return;
  const recipient = String(formData.get("recipient") ?? "");
  const message = String(formData.get("message") ?? "").trim();
  if (!recipient || message.length < 30 || message.length > 1500) return;
  const supabase = await createClient();
  await supabase.from("cofounder_connections").insert({ sender_id: user.id, recipient_id: recipient, message });
}

async function sendPrivateMessage(formData: FormData) {
  "use server";
  const user = await getUser();
  if (!user) return;
  const connectionId = String(formData.get("connection_id") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!connectionId || !body || body.length > 4000) return;
  const supabase = await createClient();
  await supabase.from("cofounder_messages").insert({ connection_id: connectionId, sender_id: user.id, body });
}

async function respondConnection(formData: FormData) {
  "use server";
  const user = await getUser();
  if (!user) return;
  const id = String(formData.get("connection_id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !["accepted", "declined"].includes(status)) return;
  const supabase = await createClient();
  await supabase.from("cofounder_connections").update({ status }).eq("id", id).eq("recipient_id", user.id);
}

async function togglePause(formData: FormData) {
  "use server";
  const user = await getUser();
  if (!user) return;
  const supabase = await createClient();
  const paused = String(formData.get("paused")) === "true";
  await supabase.from("cofounder_profiles").update({ is_paused: paused }).eq("user_id", user.id);
}

export default async function CoFoundersPage() {
  const user = await getUser();
  const supabase = user ? await createClient() : null;
  const { data: own } = supabase
    ? await supabase.from("cofounder_profiles").select("headline,bio,location,skills,role_seeking,commitment,opted_in,approval_status,is_paused").eq("user_id", user!.id).maybeSingle()
    : { data: null };
  const { data: connections } = supabase && own?.opted_in && own.approval_status === "approved" && !own.is_paused
    ? await supabase.from("cofounder_connections").select("id,sender_id,recipient_id,message,status,created_at").or(`sender_id.eq.${user!.id},recipient_id.eq.${user!.id}`).order("created_at", { ascending: false }).limit(40)
    : { data: [] };
  const acceptedIds = (connections || []).filter((c: {status:string;id:string}) => c.status === "accepted").map((c: {id:string}) => c.id);
  const { data: messages } = supabase && acceptedIds.length ? await supabase.from("cofounder_messages").select("id,connection_id,sender_id,body,created_at").in("connection_id", acceptedIds).order("created_at", { ascending: true }).limit(200) : { data: [] };
  const { data: opportunities } = supabase && own?.opted_in && own.approval_status === "approved" && !own.is_paused ? await supabase.from("cofounder_opportunities").select("id,user_id,title,problem,industry,stage,looking_for,created_at").eq("is_open", true).order("created_at", { ascending: false }).limit(40) : { data: [] };
  const { data: members } = own?.opted_in && own.approval_status === "approved" && !own.is_paused && supabase
    ? await supabase.from("cofounder_profiles").select("user_id,headline,bio,location,skills,role_seeking,commitment,idea_status").neq("user_id", user!.id).eq("opted_in", true).eq("approval_status", "approved").eq("is_paused", false).order("updated_at", { ascending: false }).limit(60)
    : { data: [] };
  const rankedMembers = (members || []).map((member: {user_id:string;headline:string;bio:string;location:string|null;skills:string[];role_seeking:string[];commitment:string;idea_status:string}) => {
    const mySkills = (own?.skills || []).map((v: string) => v.toLowerCase());
    const myNeeds = (own?.role_seeking || []).map((v: string) => v.toLowerCase());
    const theirSkills = (member.skills || []).map((v) => v.toLowerCase());
    const theirNeeds = (member.role_seeking || []).map((v) => v.toLowerCase());
    const score = theirSkills.filter((v) => myNeeds.includes(v)).length * 4 + mySkills.filter((v) => theirNeeds.includes(v)).length * 4 + (own?.commitment && own.commitment === member.commitment ? 2 : 0);
    return { ...member, score };
  }).sort((a, b) => b.score - a.score);
  return <div className="container-page space-y-10 py-10">
    <section className="grid gap-8 border-b border-line pb-10 pt-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(260px,.7fr)] lg:items-end">
      <p className="text-xs font-semibold uppercase tracking-[.18em] text-primary">Buna · Co-Founder Discovery</p>
      <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl">Find a co-founder. Build something that matters.</h1>
      <p className="mt-5 max-w-2xl text-base leading-7 text-muted">A private network for serious builders across Africa and its diaspora. Meet people with complementary skills, aligned ambitions, and the commitment to build a company together.</p>
      <div className="mt-7 flex flex-wrap gap-3"><a href="#how-it-works" className="rounded-lg border border-line bg-surface px-5 py-3 font-semibold">How it works</a>{!user ? <Link href="/signup" className="rounded-lg bg-primary px-5 py-3 font-semibold text-white">Sign up to view more</Link> : <a href="#join" className="rounded-lg bg-primary px-5 py-3 font-semibold text-white">Join discovery</a>}</div>
    </section>
    <section id="how-it-works" className="grid gap-0 border-b border-line md:grid-cols-3">
      {[
        ["01","Show what you bring","Share your skills, experience, ambitions, availability, and the kind of co-founder you hope to meet."],
        ["02","Discover complementary people","Explore approved members who have also opted in. Filter by skills, commitment, location, and startup stage."],
        ["03","Start with a conversation","Send a thoughtful introduction. If they accept, you can message privately and test the partnership before making big commitments."]
      ].map(([n,t,d]) => <article key={n} className="border-t border-line py-5 md:border-r md:px-5 md:first:pl-0 md:last:border-r-0"><p className="text-sm font-semibold text-primary">{n}</p><h2 className="mt-3 text-xl font-semibold">{t}</h2><p className="mt-2 text-sm leading-6 text-muted">{d}</p></article>)}
    </section>
    {!user ? <section className="border-b border-line py-8">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">The network</p><h2 className="mt-2 text-2xl font-semibold tracking-tight">A glimpse of the community</h2></div><span className="text-xs text-muted">Private · Opt-in · Moderated</span></div><p className="mt-2 text-muted">Member profiles are private. Sign up and opt in to discover people who are actively looking to build.</p>
      <div className="relative mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
        {["Product-minded engineer","Commercial co-founder","Design & operations builder"].map((x,i)=><div key={x} className="rounded-xl border border-line bg-surface p-5"><div className="h-10 w-10 rounded-full bg-primary-pale"/><p className="mt-4 font-semibold">{x}</p><p className="mt-2 text-sm text-muted">Skills · Startup interests · Commitment</p><div className="mt-4 h-2 rounded bg-primary-pale"/><div className="mt-2 h-2 w-2/3 rounded bg-primary-pale"/></div>)}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-4/5 bg-gradient-to-b from-transparent via-surface/80 to-surface backdrop-blur-[2px]"/>
      </div>
      <div className="relative -mt-8 text-center"><Link href="/signup" className="inline-flex rounded-lg bg-primary px-6 py-3 font-semibold text-white">Sign up to view more</Link><p className="mt-2 text-xs text-muted">No real member information is shown on this public preview.</p></div>
    </section> : <section id="join" className="border-b border-line py-8">
      <p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">Your membership</p><h2 className="mt-2 text-2xl font-semibold tracking-tight">Your co-founder profile</h2>
      {!own ? <><p className="mt-2 text-muted">Complete your profile and opt in. Your profile will be reviewed before it becomes discoverable.</p><form action={saveProfile} className="mt-6 grid gap-4 md:grid-cols-2">
        <label className="grid gap-1 text-sm font-medium">Headline<input required minLength={8} maxLength={120} name="headline" placeholder="e.g. Engineer looking to build fintech in East Africa" className="rounded-lg border border-line bg-surface px-3 py-2"/></label>
        <label className="grid gap-1 text-sm font-medium">Location<input name="location" maxLength={100} placeholder="City, country or remote" className="rounded-lg border border-line bg-surface px-3 py-2"/></label>
        <label className="grid gap-1 text-sm font-medium md:col-span-2">About you<textarea required minLength={40} maxLength={2400} name="bio" rows={4} placeholder="What have you built? What are you good at? What motivates you?" className="rounded-lg border border-line bg-surface px-3 py-2"/></label>
        <label className="grid gap-1 text-sm font-medium">Skills (comma separated)<input name="skills" placeholder="Engineering, sales, product" className="rounded-lg border border-line bg-surface px-3 py-2"/></label>
        <label className="grid gap-1 text-sm font-medium">Co-founder roles sought<input name="roles" placeholder="Business, technical, design" className="rounded-lg border border-line bg-surface px-3 py-2"/></label>
        <label className="grid gap-1 text-sm font-medium">Commitment<select name="commitment" className="rounded-lg border border-line bg-surface px-3 py-2"><option value="exploring">Exploring</option><option value="part_time">Part-time</option><option value="full_time">Full-time</option></select></label>
        <div className="md:col-span-2"><button className="rounded-lg bg-primary px-5 py-3 font-semibold text-white">Submit profile for review</button></div>
      </form></> : <><p className="mt-2 text-muted">Status: <strong>{own.approval_status === "approved" ? (own.is_paused ? "Paused" : "Approved — discoverable to opted-in members") : own.approval_status === "pending" ? "Pending review" : "Not approved"}</strong></p>
        {own.approval_status === "pending" ? <p className="mt-3 text-sm text-muted">Your profile is not visible to other members until it is approved.</p> : null}
        {own.approval_status === "approved" ? <form action={togglePause} className="mt-4"><input type="hidden" name="paused" value={String(!own.is_paused)}/><button className="rounded-lg border border-line px-4 py-2 font-semibold">{own.is_paused ? "Resume discovery" : "Pause my profile"}</button></form> : null}
      </>}
    </section>}
    {connections && connections.length ? <section><h2 className="text-2xl font-bold">Your connection requests</h2><div className="mt-4 grid gap-3">{connections.map((c: {id:string;sender_id:string;recipient_id:string;message:string;status:string})=><article key={c.id} className="rounded-xl border border-line p-4"><p className="text-sm font-semibold">{c.status === "accepted" ? "Connected" : c.status === "pending" ? (c.recipient_id === user?.id ? "Incoming request" : "Request sent") : c.status}</p><p className="mt-2 text-sm text-muted">{c.message}</p>{c.status === "accepted" ? <div className="mt-4 space-y-3 rounded-lg bg-primary-pale p-3"><p className="text-xs font-semibold uppercase tracking-wide text-primary">Private conversation</p>{(messages || []).filter((msg: {connection_id:string}) => msg.connection_id === c.id).map((msg: {id:string;sender_id:string;body:string}) => <p key={msg.id} className="rounded-lg bg-surface p-3 text-sm"><span className="font-semibold">{msg.sender_id === user?.id ? "You" : "Co-founder"}: </span>{msg.body}</p>)}<form action={sendPrivateMessage} className="flex flex-col gap-2"><input type="hidden" name="connection_id" value={c.id}/><textarea name="body" required maxLength={4000} rows={2} placeholder="Write a private message" className="rounded-lg border border-line bg-surface px-3 py-2 text-sm"/><button className="self-start rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white">Send message</button></form></div> : null}{c.status === "pending" && c.recipient_id === user?.id ? <form action={respondConnection} className="mt-3 flex gap-2"><input type="hidden" name="connection_id" value={c.id}/><button name="status" value="accepted" className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white">Accept</button><button name="status" value="declined" className="rounded-lg border border-line px-3 py-2 text-sm">Decline</button></form> : null}</article>)}</div></section> : null}
    {opportunities && opportunities.length ? <section><h2 className="text-2xl font-bold">Startup ideas seeking a co-founder</h2><div className="mt-4 grid gap-3 md:grid-cols-2">{opportunities.map((o: {id:string;title:string;problem:string;industry:string|null;stage:string;looking_for:string[]})=><article key={o.id} className="rounded-xl border border-line p-5"><h3 className="font-semibold">{o.title}</h3><p className="mt-1 text-xs text-muted">{o.industry || "Industry open"} · {o.stage}</p><p className="mt-3 text-sm">{o.problem}</p><p className="mt-3 text-xs text-muted">Seeking: {(o.looking_for || []).join(", ") || "Open to complementary skills"}</p></article>)}</div></section> : null}
    {own?.approval_status === "approved" && !own.is_paused ? <section className="rounded-xl border border-line p-6"><h2 className="text-xl font-bold">Share a company opportunity</h2><p className="mt-1 text-sm text-muted">Describe a problem you want to solve and the co-founder skills you are missing. This is not a job listing.</p><form action={createOpportunity} className="mt-4 grid gap-3 md:grid-cols-2"><input name="title" required minLength={5} maxLength={120} placeholder="Working title" className="rounded-lg border border-line bg-surface px-3 py-2"/><input name="industry" maxLength={80} placeholder="Industry" className="rounded-lg border border-line bg-surface px-3 py-2"/><textarea name="problem" required minLength={30} maxLength={2000} rows={3} placeholder="What problem are you trying to solve?" className="rounded-lg border border-line bg-surface px-3 py-2 md:col-span-2"/><input name="looking_for" placeholder="Skills sought, comma separated" className="rounded-lg border border-line bg-surface px-3 py-2"/><button className="rounded-lg bg-primary px-4 py-2 font-semibold text-white">Publish idea</button></form></section> : null}
    {rankedMembers && rankedMembers.length ? <section><h2 className="text-2xl font-bold">People building together</h2><p className="mt-2 text-muted">Approved members who have chosen to be discoverable.</p><div className="mt-5 grid gap-4 md:grid-cols-2">{rankedMembers.map((m: {user_id:string;headline:string;bio:string;location:string|null;skills:string[];role_seeking:string[];commitment:string;idea_status:string})=><article key={m.user_id} className="rounded-xl border border-line p-5"><h3 className="font-semibold">{m.headline}</h3><p className="mt-1 text-xs font-semibold text-primary">{m.score > 0 ? `Complementary fit · ${m.score} points` : "Explore this founder"}</p><p className="mt-1 text-sm text-muted">{m.location || "Location not specified"} · {m.commitment.replace("_"," ")}</p><p className="mt-3 text-sm">{m.bio}</p><p className="mt-3 text-xs text-muted">Skills: {(m.skills || []).join(", ") || "Not listed"}</p><p className="mt-1 text-xs text-muted">Looking for: {(m.role_seeking || []).join(", ") || "Open"}</p><form action={sendConnection} className="mt-4 grid gap-2"><input type="hidden" name="recipient" value={m.user_id}/><textarea name="message" required minLength={30} maxLength={1500} rows={2} placeholder="Introduce yourself and explain why you may build well together." className="rounded-lg border border-line bg-surface px-3 py-2 text-sm"/><button className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white">Request to connect</button></form></article>)}</div></section> : null}
    <section className="border-t border-line py-7"><h2 className="text-xl font-bold">A co-founder is not an employee</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-muted">This space is for people exploring genuine company-building partnerships—not job listings, freelance gigs, or paid service offers. Discuss expectations openly, work together on a short trial, and get independent legal advice before agreeing to equity or ownership.</p></section>
  </div>;
}

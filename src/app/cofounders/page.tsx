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
  const { data: existing } = await supabase.from("cofounder_profiles").select("user_id").eq("user_id", user.id).maybeSingle();
  const payload = { user_id: user.id, headline, bio, location: location || null, skills, role_seeking: roles, opted_in: true, approval_status: "pending", is_paused: false };
  if (existing) await supabase.from("cofounder_profiles").update(payload).eq("user_id", user.id);
  else await supabase.from("cofounder_profiles").insert(payload);
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
    ? await supabase.from("cofounder_profiles").select("headline,bio,location,skills,role_seeking,opted_in,approval_status,is_paused").eq("user_id", user!.id).maybeSingle()
    : { data: null };
  const { data: members } = own?.opted_in && own.approval_status === "approved" && !own.is_paused && supabase
    ? await supabase.from("cofounder_profiles").select("user_id,headline,bio,location,skills,role_seeking,commitment,idea_status").neq("user_id", user!.id).eq("opted_in", true).eq("approval_status", "approved").eq("is_paused", false).order("updated_at", { ascending: false }).limit(60)
    : { data: [] };
  return <div className="container-page space-y-10 py-10">
    <section className="relative overflow-hidden rounded-2xl border border-line bg-primary-pale px-6 py-12 sm:px-10">
      <p className="text-sm font-semibold uppercase tracking-[.16em] text-primary">Build together</p>
      <h1 className="mt-3 max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">Find the person you’ll build your company with.</h1>
      <p className="mt-5 max-w-2xl text-lg text-muted">Buna is where African startups are discovered. Co-Founder Discovery helps the people behind those startups find complementary skills, shared ambition, and a reason to build together.</p>
      <div className="mt-7 flex flex-wrap gap-3"><a href="#how-it-works" className="rounded-lg border border-line bg-surface px-5 py-3 font-semibold">How it works</a>{!user ? <Link href="/signup" className="rounded-lg bg-primary px-5 py-3 font-semibold text-white">Sign up to view more</Link> : <a href="#join" className="rounded-lg bg-primary px-5 py-3 font-semibold text-white">Join discovery</a>}</div>
    </section>
    <section id="how-it-works" className="grid gap-4 md:grid-cols-3">
      {[
        ["01","Show what you bring","Share your skills, experience, ambitions, availability, and the kind of co-founder you hope to meet."],
        ["02","Discover complementary people","Explore approved members who have also opted in. Filter by skills, commitment, location, and startup stage."],
        ["03","Start with a conversation","Send a thoughtful introduction. If they accept, you can message privately and test the partnership before making big commitments."]
      ].map(([n,t,d]) => <article key={n} className="rounded-xl border border-line p-5"><p className="text-sm font-semibold text-primary">{n}</p><h2 className="mt-3 text-xl font-semibold">{t}</h2><p className="mt-2 text-sm leading-6 text-muted">{d}</p></article>)}
    </section>
    {!user ? <section className="relative overflow-hidden rounded-2xl border border-line p-6">
      <h2 className="text-2xl font-bold">A glimpse of the community</h2><p className="mt-2 text-muted">Member profiles are private. Sign up and opt in to discover people who are actively looking to build.</p>
      <div className="relative mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
        {["Product-minded engineer","Commercial co-founder","Design & operations builder"].map((x,i)=><div key={x} className="rounded-xl border border-line bg-surface p-5"><div className="h-10 w-10 rounded-full bg-primary-pale"/><p className="mt-4 font-semibold">{x}</p><p className="mt-2 text-sm text-muted">Skills · Startup interests · Commitment</p><div className="mt-4 h-2 rounded bg-primary-pale"/><div className="mt-2 h-2 w-2/3 rounded bg-primary-pale"/></div>)}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-4/5 bg-gradient-to-b from-transparent via-surface/80 to-surface backdrop-blur-[2px]"/>
      </div>
      <div className="relative -mt-8 text-center"><Link href="/signup" className="inline-flex rounded-lg bg-primary px-6 py-3 font-semibold text-white">Sign up to view more</Link><p className="mt-2 text-xs text-muted">No real member information is shown on this public preview.</p></div>
    </section> : <section id="join" className="rounded-2xl border border-line p-6">
      <h2 className="text-2xl font-bold">Your co-founder profile</h2>
      {!own ? <><p className="mt-2 text-muted">Complete your profile and opt in. Your profile will be reviewed before it becomes discoverable.</p><form action={saveProfile} className="mt-6 grid gap-4 md:grid-cols-2">
        <label className="grid gap-1 text-sm font-medium">Headline<input required minLength={8} maxLength={120} name="headline" placeholder="e.g. Engineer looking to build fintech in East Africa" className="rounded-lg border border-line bg-surface px-3 py-2"/></label>
        <label className="grid gap-1 text-sm font-medium">Location<input name="location" maxLength={100} placeholder="City, country or remote" className="rounded-lg border border-line bg-surface px-3 py-2"/></label>
        <label className="grid gap-1 text-sm font-medium md:col-span-2">About you<textarea required minLength={40} maxLength={2400} name="bio" rows={4} placeholder="What have you built? What are you good at? What motivates you?" className="rounded-lg border border-line bg-surface px-3 py-2"/></label>
        <label className="grid gap-1 text-sm font-medium">Skills (comma separated)<input name="skills" placeholder="Engineering, sales, product" className="rounded-lg border border-line bg-surface px-3 py-2"/></label>
        <label className="grid gap-1 text-sm font-medium">Co-founder roles sought<input name="roles" placeholder="Business, technical, design" className="rounded-lg border border-line bg-surface px-3 py-2"/></label>
        <div className="md:col-span-2"><button className="rounded-lg bg-primary px-5 py-3 font-semibold text-white">Submit profile for review</button></div>
      </form></> : <><p className="mt-2 text-muted">Status: <strong>{own.approval_status === "approved" ? (own.is_paused ? "Paused" : "Approved — discoverable to opted-in members") : own.approval_status === "pending" ? "Pending review" : "Not approved"}</strong></p>
        {own.approval_status === "pending" ? <p className="mt-3 text-sm text-muted">Your profile is not visible to other members until it is approved.</p> : null}
        {own.approval_status === "approved" ? <form action={togglePause} className="mt-4"><input type="hidden" name="paused" value={String(!own.is_paused)}/><button className="rounded-lg border border-line px-4 py-2 font-semibold">{own.is_paused ? "Resume discovery" : "Pause my profile"}</button></form> : null}
      </>}
    </section>}
    {members && members.length ? <section><h2 className="text-2xl font-bold">People building together</h2><p className="mt-2 text-muted">Approved members who have chosen to be discoverable.</p><div className="mt-5 grid gap-4 md:grid-cols-2">{members.map((m:any)=><article key={m.user_id} className="rounded-xl border border-line p-5"><h3 className="font-semibold">{m.headline}</h3><p className="mt-1 text-sm text-muted">{m.location || "Location not specified"} · {m.commitment.replace("_"," ")}</p><p className="mt-3 text-sm">{m.bio}</p><p className="mt-3 text-xs text-muted">Skills: {(m.skills || []).join(", ") || "Not listed"}</p><p className="mt-1 text-xs text-muted">Looking for: {(m.role_seeking || []).join(", ") || "Open"}</p></article>)}</div></section> : null}
    <section className="rounded-xl bg-primary-pale p-6"><h2 className="text-xl font-bold">A co-founder is not an employee</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-muted">This space is for people exploring genuine company-building partnerships—not job listings, freelance gigs, or paid service offers. Discuss expectations openly, work together on a short trial, and get independent legal advice before agreeing to equity or ownership.</p></section>
  </div>;
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Globe, MapPin } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { FollowButton } from "@/components/social/follow-button";
import { SocialLinks } from "@/components/social/social-links";
import { ReportDialog } from "@/components/startups/report-dialog";
import { StartupLogo } from "@/components/startups/startup-logo";
import { getUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import { followerCount, getPublicUser, getUserLaunches, getUserStartups, isFollowing, locationOf } from "@/lib/social/queries";

type Props = { params: Promise<{ username: string }> };
const NAME_RE = /^[a-z0-9][a-z0-9_-]{2,29}$/;

function safeExternal(url: string | null): string | null {
  if (!url) return null;
  try { const u = new URL(url); return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null; } catch { return null; }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const u = NAME_RE.test(username.toLowerCase()) ? await getPublicUser(username.toLowerCase()) : null;
  if (!u) return { title: "Member not found", robots: { index: false } };
  return {
    title: u.display_name || `@${u.username}`,
    description: u.is_public_profile && u.headline ? u.headline : `${u.display_name || u.username} on Buna`,
    alternates: { canonical: `/users/${u.username}` },
    // Members who haven't made their profile public are never indexed.
    robots: u.is_public_profile ? undefined : { index: false, follow: false },
  };
}

export default async function UserPage({ params }: Props) {
  const { username } = await params;
  const name = username.toLowerCase();
  if (!NAME_RE.test(name)) notFound();
  const u = await getPublicUser(name);
  if (!u) notFound();
  const viewer = await getUser();
  const isMe = viewer?.id === u.id;
  const showDetails = u.is_public_profile || isMe;
  const [startups, launches, followers, following] = await Promise.all([
    showDetails ? getUserStartups(u.id) : Promise.resolve([]),
    showDetails ? getUserLaunches(u.id) : Promise.resolve([]),
    followerCount("user", u.id),
    isFollowing(viewer?.id ?? null, "user", u.id),
  ]);
  const site = showDetails ? safeExternal(u.website_url) : null;
  const location = showDetails ? locationOf(u) : "";
  const loginHref = `/login?next=${encodeURIComponent(`/users/${u.username}`)}`;
  const supabase = await createClient();
  const { data: workProfile } = showDetails ? await supabase.from("work_profiles").select("headline,skills,availability").eq("user_id",u.id).eq("is_public",true).maybeSingle() : { data: null };

  return (
    <div className="container-page space-y-6 py-8">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <Avatar name={u.display_name} src={u.avatar_url} size={96} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><h1 className="text-3xl font-bold">{u.display_name || `@${u.username}`}</h1>{u.is_founding_supporter ? <Badge tone="green">Founding Supporter</Badge> : null}</div>
          <p className="text-muted"><Link href={`/users/${u.username}`} className="no-underline hover:underline">@{u.username}</Link></p>
          {showDetails && u.headline ? <p className="mt-2 max-w-2xl text-lg">{u.headline}</p> : null}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
            {location ? <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" aria-hidden="true" />{location}</span> : null}
            {site ? <a href={site} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1"><Globe className="h-4 w-4" aria-hidden="true" />{new URL(site).host.replace(/^www\./, "")}<span className="sr-only"> (opens in a new tab)</span></a> : null}
          </div>
          {showDetails ? <SocialLinks links={u.social_links} /> : null}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {isMe ? <Link href="/dashboard/profile" className={buttonStyles("secondary", "sm")}>Edit profile</Link> : (
              <>
                <FollowButton targetType="user" targetId={u.id} name={u.display_name || u.username} following={following} count={followers} signedIn={Boolean(viewer)} loginHref={loginHref} returnTo={`/users/${u.username}`} />
                <ReportDialog targetType="user" targetId={u.id} targetName={u.display_name || `@${u.username}`} signedIn={Boolean(viewer)} loginHref={loginHref} />
              </>
            )}
            {isMe ? <span className="text-sm text-muted tabular-nums">{followers} {followers === 1 ? "follower" : "followers"}</span> : null}
          </div>
        </div>
      </header>

      {workProfile ? <Card><CardBody className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-primary-deep">Buna Work</p><h2 className="mt-1 font-semibold">{workProfile.headline}</h2><p className="mt-1 text-xs text-muted">{workProfile.skills.slice(0,6).join(" · ")} · {workProfile.availability.replace("_"," ")}</p></div><Link href={`/work/talent/${u.username}`} className={buttonStyles("secondary","sm")}>View freelancer profile</Link></CardBody></Card> : isMe ? <Card><CardBody className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Offer your skills through Buna Work</h2><p className="mt-1 text-sm text-muted">Create a professional freelancer profile and apply for paid projects.</p></div><Link href="/dashboard/work/profile" className={buttonStyles("secondary","sm")}>Set up Work profile</Link></CardBody></Card> : null}

      {!showDetails ? (
        <p className="rounded-md border border-line bg-primary-pale p-4 text-sm text-muted">This member hasn’t made their profile public, so only their name and photo are shown.</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
          <div className="min-w-0 space-y-6">
            {u.bio ? <Card><CardHeader><h2 className="font-semibold">About</h2></CardHeader><CardBody><p className="whitespace-pre-line text-[15px] leading-relaxed">{u.bio}</p></CardBody></Card> : null}
            <Card>
              <CardHeader><h2 className="font-semibold">Launches</h2></CardHeader>
              <CardBody>
                {launches.length === 0 ? <p className="text-sm text-muted">No launches yet.</p> : (
                  <ul className="divide-y divide-line">
                    {launches.map((l) => (
                      <li key={l.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                        <StartupLogo name={l.name} src={l.logo_url} size={40} />
                        <div className="min-w-0 flex-1"><Link href={`/launches/${l.slug}`} className="font-medium text-ink no-underline hover:underline">{l.name}</Link>{l.is_demo ? <Badge tone="warning" className="ml-2">Demo</Badge> : null}<p className="truncate text-sm text-muted">{l.tagline}</p></div>
                        <span className="text-xs text-muted tabular-nums">{l.vote_count} votes · {formatDate(l.published_at)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
          </div>
          <aside className="space-y-4">
            {startups.length > 0 ? (
              <Card>
                <CardHeader><h2 className="font-semibold">Startups</h2></CardHeader>
                <CardBody>
                  <ul className="space-y-3">
                    {startups.map((s) => (
                      <li key={s.id} className="flex items-center gap-3">
                        <StartupLogo name={s.name} src={s.logo_url} size={36} />
                        <div className="min-w-0"><Link href={`/startups/${s.slug}`} className="block truncate font-medium text-ink no-underline hover:underline">{s.name}</Link>{s.public_title ? <p className="truncate text-sm text-muted">{s.public_title}</p> : null}</div>
                      </li>
                    ))}
                  </ul>
                </CardBody>
              </Card>
            ) : null}
            {u.expertise.length > 0 ? (
              <Card><CardHeader><h2 className="font-semibold">Expertise</h2></CardHeader><CardBody className="flex flex-wrap gap-2">{u.expertise.map((e) => <Badge key={e}>{e}</Badge>)}</CardBody></Card>
            ) : null}
          </aside>
        </div>
      )}
    </div>
  );
}

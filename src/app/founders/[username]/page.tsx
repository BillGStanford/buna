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
import { OPEN_TO } from "@/lib/people/params";
import { listCategories } from "@/lib/startups/queries";
import { followerCount, getPublicUser, getUserLaunches, getUserStartups, isFollowing, locationOf } from "@/lib/social/queries";

type Props = { params: Promise<{ username: string }> };
const NAME_RE = /^[a-z0-9][a-z0-9_-]{2,29}$/;
const safe = (url: string | null) => { if (!url) return null; try { const u = new URL(url); return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null; } catch { return null; } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const u = NAME_RE.test(username.toLowerCase()) ? await getPublicUser(username.toLowerCase()) : null;
  if (!u || !u.is_discoverable_founder) return { title: "Founder not found", robots: { index: false } };
  return { title: `${u.display_name || u.username} — founder`, description: (u.headline || u.bio || `${u.display_name} on Buna`).slice(0, 160), alternates: { canonical: `/founders/${u.username}` } };
}

export default async function FounderPage({ params }: Props) {
  const { username } = await params;
  const name = username.toLowerCase();
  if (!NAME_RE.test(name)) notFound();
  const u = await getPublicUser(name);
  // only members who opted in to the directory have a founder page
  if (!u || !u.is_discoverable_founder) notFound();
  const viewer = await getUser();
  const [startups, launches, followers, following, categories] = await Promise.all([getUserStartups(u.id), getUserLaunches(u.id), followerCount("user", u.id), isFollowing(viewer?.id ?? null, "user", u.id), listCategories().catch(() => [])]);
  const site = safe(u.website_url);
  const location = locationOf(u);
  const loginHref = `/login?next=${encodeURIComponent(`/founders/${u.username}`)}`;
  const isMe = viewer?.id === u.id;
  const interestName = (slug: string) => categories.find((c) => c.slug === slug)?.name ?? slug.replace(/-/g, " ");

  return (
    <div className="container-page space-y-6 py-8">
      <p className="text-sm"><Link href="/founders" className="font-medium">All founders</Link></p>
      <header className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <Avatar name={u.display_name} src={u.avatar_url} size={96} />
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-bold">{u.display_name || `@${u.username}`}</h1>
          <p className="text-muted"><Link href={`/users/${u.username}`} className="no-underline hover:underline">@{u.username}</Link></p>
          {u.headline ? <p className="mt-2 max-w-2xl text-lg">{u.headline}</p> : null}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
            {location ? <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" aria-hidden="true" />{location}</span> : null}
            {site ? <a href={site} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1"><Globe className="h-4 w-4" aria-hidden="true" />{new URL(site).host.replace(/^www\./, "")}<span className="sr-only"> (opens in a new tab)</span></a> : null}
          </div>
          {u.open_to.length > 0 ? <div className="mt-3 flex flex-wrap items-center gap-2"><span className="text-sm text-muted">Open to:</span>{u.open_to.map((o) => <Badge key={o} tone="green">{OPEN_TO.find((x) => x.value === o)?.label ?? o}</Badge>)}</div> : null}
          <SocialLinks links={u.social_links} />
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {isMe ? <Link href="/dashboard/profile" className={buttonStyles("secondary", "sm")}>Edit profile</Link> : (
              <>
                <FollowButton targetType="user" targetId={u.id} name={u.display_name || u.username} following={following} count={followers} signedIn={Boolean(viewer)} loginHref={loginHref} returnTo={`/founders/${u.username}`} />
                <ReportDialog targetType="user" targetId={u.id} targetName={u.display_name || `@${u.username}`} signedIn={Boolean(viewer)} loginHref={loginHref} />
              </>
            )}
          </div>
        </div>
      </header>
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0 space-y-6">
          {u.bio ? <Card><CardHeader><h2 className="font-semibold">About</h2></CardHeader><CardBody><p className="whitespace-pre-line text-[15px] leading-relaxed">{u.bio}</p></CardBody></Card> : null}
          {launches.length > 0 ? (
            <Card><CardHeader><h2 className="font-semibold">Launches</h2></CardHeader><CardBody><ul className="divide-y divide-line">{launches.map((l) => <li key={l.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"><StartupLogo name={l.name} src={l.logo_url} size={40} /><div className="min-w-0 flex-1"><Link href={`/launches/${l.slug}`} className="font-medium text-ink no-underline hover:underline">{l.name}</Link><p className="truncate text-sm text-muted">{l.tagline}</p></div></li>)}</ul></CardBody></Card>
          ) : null}
        </div>
        <aside className="space-y-4">
          {startups.length > 0 ? <Card><CardHeader><h2 className="font-semibold">Startups</h2></CardHeader><CardBody><ul className="space-y-3">{startups.map((s) => <li key={s.id} className="flex items-center gap-3"><StartupLogo name={s.name} src={s.logo_url} size={36} /><div className="min-w-0"><Link href={`/startups/${s.slug}`} className="block truncate font-medium text-ink no-underline hover:underline">{s.name}</Link>{s.public_title ? <p className="truncate text-sm text-muted">{s.public_title}</p> : null}</div></li>)}</ul></CardBody></Card> : null}
          {u.expertise.length > 0 ? <Card><CardHeader><h2 className="font-semibold">Expertise</h2></CardHeader><CardBody className="flex flex-wrap gap-2">{u.expertise.map((e) => <Badge key={e}>{e}</Badge>)}</CardBody></Card> : null}
          {u.interests.length > 0 ? <Card><CardHeader><h2 className="font-semibold">Industries of interest</h2></CardHeader><CardBody className="flex flex-wrap gap-2">{u.interests.map((i) => <Badge key={i}>{interestName(i)}</Badge>)}</CardBody></Card> : null}
          <p className="text-xs leading-relaxed text-muted">Members decide what appears here. To get in touch, use the contact form on their startup’s page.</p>
        </aside>
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { buttonStyles } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { FollowButton } from "@/components/social/follow-button";
import { StartupLogo } from "@/components/startups/startup-logo";
import { requireProfile } from "@/lib/auth/session";
import { listFollowing } from "@/lib/social/queries";

export const metadata: Metadata = { title: "Following" };

export default async function FollowingPage() {
  const profile = await requireProfile("/dashboard/following");
  const { startups, people } = await listFollowing(profile.id);
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Following</h1><p className="mt-1 text-sm text-muted">Startups and people you follow. Only you can see this list.</p></div>
      <Card>
        <CardHeader><h2 className="font-semibold">Startups</h2></CardHeader>
        <CardBody>
          {startups.length === 0 ? (
            <div className="space-y-3"><p className="text-sm text-muted">You aren’t following any startups yet.</p><Link href="/startups" className={buttonStyles("secondary", "sm")}>Discover startups</Link></div>
          ) : (
            <ul className="divide-y divide-line">
              {startups.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <StartupLogo name={s.name} src={s.logo_url} size={40} />
                  <div className="min-w-0 flex-1"><Link href={`/startups/${s.slug}`} className="font-medium text-ink no-underline hover:underline">{s.name}</Link>{s.tagline ? <p className="truncate text-sm text-muted">{s.tagline}</p> : null}</div>
                  <FollowButton targetType="startup" targetId={s.id} name={s.name} following count={0} signedIn loginHref="/login" returnTo="/dashboard/following" />
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
      <Card>
        <CardHeader><h2 className="font-semibold">People</h2></CardHeader>
        <CardBody>
          {people.length === 0 ? <p className="text-sm text-muted">You aren’t following anyone yet. Find makers on launch pages.</p> : (
            <ul className="divide-y divide-line">
              {people.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <Avatar name={p.display_name} src={p.avatar_url} size={40} />
                  <div className="min-w-0 flex-1"><Link href={`/users/${p.username}`} className="font-medium text-ink no-underline hover:underline">{p.display_name || `@${p.username}`}</Link><p className="text-sm text-muted">@{p.username}</p></div>
                  <FollowButton targetType="user" targetId={p.id} name={p.display_name || p.username} following count={0} signedIn loginHref="/login" returnTo="/dashboard/following" />
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

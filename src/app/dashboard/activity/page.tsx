import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Bookmark, Rocket, Users, Building2 } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardBody } from "@/components/ui/card";
import { buttonStyles } from "@/components/ui/button";
import { requireProfile } from "@/lib/auth/session";
import { listFollowingActivity } from "@/lib/activity/queries";
import { listFollowing } from "@/lib/social/queries";

export const metadata: Metadata = { title: "Your activity feed" };

const labels = {
  launch: "published a launch",
  startup_update: "updated a startup",
  founder_follow: "made a new connection",
  opportunity_save: "saved an opportunity",
} as const;

const icons = {
  launch: Rocket,
  startup_update: Building2,
  founder_follow: Users,
  opportunity_save: Bookmark,
} as const;

function timeAgo(value: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

export default async function ActivityPage() {
  const profile = await requireProfile("/dashboard/activity");
  const [{ startups, people }, items] = await Promise.all([
    listFollowing(profile.id),
    listFollowingActivity(50),
  ]);
  const followingCount = startups.length + people.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Your activity feed</h1>
          <p className="mt-1 text-sm text-muted">The latest from founders and startups you follow.</p>
        </div>
        <Link href="/dashboard/following" className={buttonStyles("secondary", "sm")}>Manage following</Link>
      </div>

      {followingCount === 0 ? (
        <Card><CardBody className="space-y-3 py-8 text-center">
          <Users className="mx-auto h-8 w-8 text-muted" aria-hidden="true" />
          <h2 className="font-semibold">Build your network to get started</h2>
          <p className="mx-auto max-w-md text-sm text-muted">Follow founders and startups to see their launches, updates, new connections, and saved opportunities here.</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Link href="/founders" className={buttonStyles("primary", "sm")}>Discover founders</Link>
            <Link href="/startups" className={buttonStyles("secondary", "sm")}>Discover startups</Link>
          </div>
        </CardBody></Card>
      ) : items.length === 0 ? (
        <Card><CardBody className="space-y-3 py-8 text-center">
          <Rocket className="mx-auto h-8 w-8 text-muted" aria-hidden="true" />
          <h2 className="font-semibold">You’re all caught up</h2>
          <p className="mx-auto max-w-md text-sm text-muted">New launches, startup updates, connections, and opportunity saves from your network will appear here as they happen.</p>
          <Link href="/startups" className={buttonStyles("secondary", "sm")}>Discover more startups</Link>
        </CardBody></Card>
      ) : (
        <Card><CardBody className="divide-y divide-line p-0">
          {items.map((item) => {
            const Icon = icons[item.activity_type];
            const actorName = item.actor_display_name || (item.actor_username ? `@${item.actor_username}` : "A member you follow");
            return (
              <article key={item.activity_id} className="flex gap-3 px-4 py-4 sm:px-5">
                <div className="pt-0.5"><Avatar name={actorName} src={item.actor_avatar_url} size={40} /></div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-6">
                    <span className="font-semibold text-ink">{actorName}</span>{" "}
                    <span className="text-muted">{labels[item.activity_type]}</span>
                  </p>
                  <Link href={item.href} className="mt-0.5 inline-flex items-center gap-1 font-semibold text-ink no-underline hover:underline">
                    {item.subject}<ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                  <p className="mt-0.5 text-sm text-muted">{item.description}</p>
                  <time className="mt-1 block text-xs text-muted" dateTime={item.happened_at}>{timeAgo(item.happened_at)}</time>
                </div>
                <div className="hidden shrink-0 pt-1 text-muted sm:block"><Icon className="h-4 w-4" aria-hidden="true" /></div>
              </article>
            );
          })}
        </CardBody></Card>
      )}
    </div>
  );
}

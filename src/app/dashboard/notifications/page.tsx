import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/illustrations";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PreferencesForm } from "@/components/notifications/preferences-form";
import { Pagination } from "@/components/startups/pagination";
import { requireProfile } from "@/lib/auth/session";
import { isEmailConfigured } from "@/lib/env";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getPreferences, listNotifications, NOTIFICATIONS_PAGE_SIZE } from "@/lib/notifications/queries";
import { markAllNotificationsReadAction, markNotificationReadAction } from "./actions";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const profile = await requireProfile("/dashboard/notifications");
  const parsed = Number.parseInt((await searchParams).page ?? "1", 10);
  const page = Number.isFinite(parsed) && parsed >= 1 ? Math.min(parsed, 1000) : 1;
  const [{ items, total }, prefs] = await Promise.all([listNotifications(profile.id, page), getPreferences(profile.id)]);
  const pages = Math.max(1, Math.ceil(total / NOTIFICATIONS_PAGE_SIZE));
  const unread = items.filter((n) => !n.read_at).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold">Notifications</h1><p className="mt-1 text-sm text-muted">Comments, replies and decisions on your launches.</p></div>
        {unread > 0 ? <form action={markAllNotificationsReadAction}><Button type="submit" variant="secondary" size="sm">Mark all as read</Button></form> : null}
      </div>

      {items.length === 0 ? (
        <EmptyState illustration="notifications" title={page > 1 ? "No notifications on this page" : "You’re all caught up"}>
          {page > 1 ? <Link href="/dashboard/notifications" className="font-medium">Back to the first page</Link> : "When someone comments on your launch, messages your startup or a moderator reviews your work, you’ll see it here."}
        </EmptyState>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line">
          {items.map((n) => (
            <li key={n.id} className={cn("flex flex-wrap items-start justify-between gap-3 p-4", !n.read_at && "bg-primary-pale")}>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-sm">
                  {!n.read_at ? <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-primary" /> : null}
                  <Link href={`/dashboard/notifications/open/${n.id}`} className={cn("no-underline hover:underline", n.read_at ? "text-ink" : "font-semibold text-ink")}>{n.title}</Link>
                  {!n.read_at ? <span className="sr-only">(unread)</span> : null}
                </p>
                {n.body ? <p className="mt-1 break-words text-sm text-muted">{n.body}</p> : null}
                <p className="mt-1 text-xs text-muted"><time dateTime={n.created_at}>{formatDateTime(n.created_at)}</time></p>
              </div>
              {!n.read_at ? (
                <form action={markNotificationReadAction}><input type="hidden" name="notificationId" value={n.id} /><Button type="submit" variant="ghost" size="sm">Mark read</Button></form>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <Pagination page={page} pages={pages} hrefFor={(n) => (n > 1 ? `/dashboard/notifications?page=${n}` : "/dashboard/notifications")} />

      <Card><CardHeader><h2 className="font-semibold">Email preferences</h2></CardHeader><CardBody><PreferencesForm prefs={prefs} emailConfigured={isEmailConfigured()} /></CardBody></Card>
    </div>
  );
}

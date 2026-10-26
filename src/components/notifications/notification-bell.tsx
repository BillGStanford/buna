import Link from "next/link";
import { Bell } from "lucide-react";

export function NotificationBell({ unread }: { unread: number }) {
  return (
    <Link href="/dashboard/notifications" aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-ink no-underline hover:bg-primary-mint">
      <Bell className="h-5 w-5" aria-hidden="true" />
      {unread > 0 ? (
        <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 inline-flex min-w-[1.1rem] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-4 text-white tabular-nums">
          {unread > 9 ? "9+" : unread}
        </span>
      ) : null}
    </Link>
  );
}

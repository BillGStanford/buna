import Link from "next/link";
import { Logo } from "./logo";
import { MobileNav } from "./mobile-nav";
import { UserMenu } from "./user-menu";
import { buttonStyles } from "@/components/ui/button";
import { availableNav, primaryNav } from "@/config/site";
import { getProfile, getUser } from "@/lib/auth/session";
import { isStaff } from "@/lib/permissions";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { unreadCount } from "@/lib/notifications/queries";

export async function SiteHeader() {
  const user = await getUser();
  const profile = user ? await getProfile() : null;
  const items = availableNav(primaryNav);
  const unread = user ? await unreadCount(user.id) : 0;

  return (
    <header className="relative sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-8">
          <Logo />
          {items.length > 0 ? (
            <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
              {items.map((item) => (
                <Link key={item.href} href={item.href} className="rounded-md px-3 py-2 text-sm font-medium text-ink no-underline hover:bg-primary-mint">
                  {item.label}
                </Link>
              ))}
            </nav>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {user && profile ? <NotificationBell unread={unread} /> : null}
          {user && profile ? (
            <UserMenu name={profile.display_name} username={profile.username} avatarUrl={profile.avatar_url} showAdmin={isStaff(profile.role)} />
          ) : (
            <div className="hidden items-center gap-2 md:flex">
              <Link href="/login" className={buttonStyles("ghost", "md")}>Sign in</Link>
              <Link href="/signup" className={buttonStyles("primary", "md")}>Get started</Link>
            </div>
          )}
          <MobileNav items={items} signedIn={Boolean(user)} />
        </div>
      </div>
    </header>
  );
}

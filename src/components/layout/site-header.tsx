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
import { PrimaryNav } from "./primary-nav";

export async function SiteHeader() {
  const user = await getUser();
  const profile = user ? await getProfile() : null;
  const items = availableNav(primaryNav);
  const unread = user ? await unreadCount(user.id) : 0;
  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-surface/90 shadow-[0_4px_18px_rgba(23,43,36,0.035)] backdrop-blur-xl">
      <div className="container-page flex min-h-[76px] items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-5 2xl:gap-7"><Logo /><PrimaryNav items={items} /></div>
        <div className="flex shrink-0 items-center gap-2.5">
          {user && profile ? <NotificationBell unread={unread} /> : null}
          {user && profile ? <UserMenu name={profile.display_name} username={profile.username} avatarUrl={profile.avatar_url} showAdmin={isStaff(profile.role)} /> :
            <div className="hidden items-center gap-2 md:flex"><Link href="/login" className={buttonStyles("ghost","md")}>Sign in</Link><Link href="/signup" className={buttonStyles("primary","md")}>Create account</Link></div>}
          <MobileNav items={items} signedIn={Boolean(user)} />
        </div>
      </div>
    </header>
  );
}

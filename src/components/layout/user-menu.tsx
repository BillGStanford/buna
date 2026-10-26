"use client";

import Link from "next/link";
import { LayoutDashboard, LogOut, ShieldCheck, UserRound, Lock } from "lucide-react";
import { Dropdown, menuItemClass } from "@/components/ui/dropdown";
import { Avatar } from "@/components/ui/avatar";
import { signOutAction } from "@/app/(auth)/actions";

export function UserMenu({ name, username, avatarUrl, showAdmin }: {
  name: string; username: string; avatarUrl: string | null; showAdmin: boolean;
}) {
  return (
    <Dropdown label="Open account menu" trigger={<Avatar name={name} src={avatarUrl} size={34} />}>
      <div className="border-b border-line px-3 py-2">
        <p className="truncate text-sm font-semibold text-ink">{name || "Your account"}</p>
        <p className="truncate text-xs text-muted">@{username}</p>
      </div>
      <nav aria-label="Account" className="pt-1.5">
        <Link href="/dashboard" className={menuItemClass}><LayoutDashboard className="h-4 w-4" aria-hidden="true" />Dashboard</Link>
        <Link href="/dashboard/profile" className={menuItemClass}><UserRound className="h-4 w-4" aria-hidden="true" />Edit profile</Link>
        <Link href="/dashboard/security" className={menuItemClass}><Lock className="h-4 w-4" aria-hidden="true" />Security</Link>
        {showAdmin ? <Link href="/admin" className={menuItemClass}><ShieldCheck className="h-4 w-4" aria-hidden="true" />Admin</Link> : null}
      </nav>
      <form action={signOutAction} className="mt-1.5 border-t border-line pt-1.5">
        <button type="submit" className={menuItemClass}><LogOut className="h-4 w-4" aria-hidden="true" />Sign out</button>
      </form>
    </Dropdown>
  );
}

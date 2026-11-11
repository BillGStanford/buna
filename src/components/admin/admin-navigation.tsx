"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Flag, Building2, Rocket, MessagesSquare, BriefcaseBusiness,
  Landmark, Users, ShieldCheck, Tags, ScrollText, Settings, UserRoundCheck,
  Inbox, Star, Gift, ChevronRight,
} from "lucide-react";

const groups = [
  { label: "WORKSPACE", items: [
    { label: "Overview", href: "/admin", Icon: LayoutDashboard, exact: true },
    { label: "Reports", href: "/admin/reports", Icon: Flag },
    { label: "Startups", href: "/admin/startups", Icon: Building2 },
    { label: "Launches", href: "/admin/launches", Icon: Rocket },
    { label: "Community", href: "/admin/community", Icon: MessagesSquare },
    { label: "Opportunities", href: "/admin/opportunities", Icon: BriefcaseBusiness },
    { label: "Investors", href: "/admin/investors", Icon: Landmark },
    { label: "Co-founder review", href: "/admin/cofounders", Icon: UserRoundCheck },
  ]},
  { label: "MEMBERS", items: [
    { label: "Users", href: "/admin/users", Icon: Users },
    { label: "Messages", href: "/admin/messages", Icon: Inbox },
    { label: "Featured", href: "/admin/featured", Icon: Star },
    { label: "Investor applications", href: "/admin/investor-applications", Icon: Landmark },
    { label: "Referral rewards", href: "/admin/referral-rewards", Icon: Gift },
  ]},
  { label: "CONTROL", items: [
    { label: "Verification", href: "/admin/verification", Icon: ShieldCheck, adminOnly: true },
    { label: "Categories", href: "/admin/categories", Icon: Tags, adminOnly: true },
    { label: "Audit log", href: "/admin/audit", Icon: ScrollText, adminOnly: true },
    { label: "Settings", href: "/admin/settings", Icon: Settings, adminOnly: true },
  ]},
];

export function AdminNavigation({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const visible = groups.map((group) => ({ ...group, items: group.items.filter((item) => !("adminOnly" in item && item.adminOnly) || isAdmin) })).filter((group) => group.items.length);
  return (
    <>
      <nav aria-label="Staff navigation" className="hidden w-60 shrink-0 border-r border-line/80 bg-surface-subtle/45 px-3 py-5 lg:block">
        <div className="mb-5 px-3"><p className="text-[10px] font-bold tracking-[.16em] text-muted">BUNA OPERATIONS</p><p className="mt-1 text-sm font-semibold text-ink">Staff workspace</p></div>
        {visible.map((group) => <section key={group.label} className="mb-6">
          <h2 className="mb-2 px-3 text-[10px] font-bold tracking-[.14em] text-muted">{group.label}</h2>
          <ul className="space-y-0.5">{group.items.map(({label,href,Icon,exact}) => {
            const active = exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");
            return <li key={href}><Link href={href} aria-current={active ? "page" : undefined} className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium no-underline transition-colors ${active ? "bg-primary-pale text-primary-deep" : "text-muted hover:bg-surface hover:text-ink"}`}><Icon className={`h-4 w-4 shrink-0 ${active ? "text-primary" : "text-muted group-hover:text-ink"}`} aria-hidden="true"/><span className="min-w-0 flex-1">{label}</span>{active ? <ChevronRight className="h-3.5 w-3.5" aria-hidden="true"/> : null}</Link></li>;
          })}</ul>
        </section>)}
      </nav>
      <nav aria-label="Staff navigation" className="flex gap-1 overflow-x-auto border-b border-line bg-surface px-4 py-2 lg:hidden">
        {visible.flatMap((group) => group.items).map(({label,href,exact}) => {
          const active = exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");
          return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`shrink-0 rounded-lg px-3 py-2 text-xs font-semibold no-underline ${active ? "bg-primary-pale text-primary-deep" : "text-muted hover:bg-surface-subtle"}`}>{label}</Link>;
        })}
      </nav>
    </>
  );
}

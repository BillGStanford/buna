"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Activity, BarChart3, Building2, ChevronDown, ClipboardList, Database,
  Flag, Handshake, LayoutDashboard, Mail, MessageSquare, Rocket, Settings,
  ShieldCheck, Star, Tags, Users, X, BriefcaseBusiness,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = { label: string; href: string; icon: LucideIcon; exact?: boolean };
type NavGroup = { label: string; items: NavItem[] };

const groups: NavGroup[] = [
  { label: "Workspace", items: [
    { label: "Overview", href: "/admin", icon: LayoutDashboard, exact: true },
  ]},
  { label: "Moderation", items: [
    { label: "Reports", href: "/admin/reports", icon: Flag },
    { label: "Startups", href: "/admin/startups", icon: Building2 },
    { label: "Launches", href: "/admin/launches", icon: Rocket },
    { label: "Community", href: "/admin/community", icon: MessageSquare },
    { label: "Opportunities", href: "/admin/opportunities", icon: BriefcaseBusiness },
    { label: "Investors", href: "/admin/investors", icon: Handshake },
  ]},
  { label: "Company intelligence", items: [
    { label: "Company data", href: "/admin/company-data", icon: Building2 },
    { label: "Data sources", href: "/admin/company-sources", icon: Database },
    { label: "Investor applications", href: "/admin/investor-applications", icon: ShieldCheck },
    { label: "Referral rewards", href: "/admin/referral-rewards", icon: Star },
  ]},
  { label: "People & communication", items: [
    { label: "Users", href: "/admin/users", icon: Users },
    { label: "Messages", href: "/admin/messages", icon: Mail },
  ]},
  { label: "Growth", items: [
    { label: "Featured", href: "/admin/featured", icon: Star },
  ]},
];

const adminGroup: NavGroup = { label: "Administration", items: [
  { label: "Operations", href: "/admin/operations", icon: ClipboardList },
  { label: "Analytics", href: "/admin/analytics", icon: BarChart3 },
  { label: "Verification", href: "/admin/verification", icon: ShieldCheck },
  { label: "Categories", href: "/admin/categories", icon: Tags },
  { label: "Tags", href: "/admin/tags", icon: Tags },
  { label: "Audit log", href: "/admin/audit", icon: Activity },
  { label: "Settings", href: "/admin/settings", icon: Settings },
]};

function SidebarLinks({ onNavigate, isAdmin }: { onNavigate?: () => void; isAdmin: boolean }) {
  const pathname = usePathname();
  const visibleGroups = isAdmin ? [...groups, adminGroup] : groups;

  return <nav aria-label="Admin navigation" className="space-y-6 px-3 pb-5">
    {visibleGroups.map((group) => (
      <section key={group.label} aria-label={group.label}>
        <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted/80">{group.label}</p>
        <ul className="space-y-1">
          {group.items.map((item) => {
            const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            return <li key={item.href}>
              <Link href={item.href} onClick={onNavigate} aria-current={active ? "page" : undefined}
                className={cn(
                  "group flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium no-underline transition-colors",
                  active
                    ? "bg-primary-pale text-primary-deep shadow-[inset_3px_0_0_rgb(var(--primary))]"
                    : "text-muted hover:bg-pale hover:text-ink"
                )}>
                <Icon aria-hidden="true" size={17} strokeWidth={active ? 2.3 : 1.8} className={cn("shrink-0", active ? "text-primary" : "text-muted group-hover:text-primary")} />
                <span className="min-w-0 flex-1">{item.label}</span>
                {active ? <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" /> : null}
              </Link>
            </li>;
          })}
        </ul>
      </section>
    ))}
  </nav>;
}

export function AdminSidebar({ role }: { role: string }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const isAdmin = role === "admin";

  return <>
    <div className="mb-4 flex items-center justify-between rounded-xl border border-line bg-surface px-4 py-3 lg:hidden">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">Admin workspace</p>
        <p className="truncate text-sm font-semibold text-ink">Navigation</p>
      </div>
      <button type="button" onClick={() => setMobileOpen((value) => !value)}
        aria-expanded={mobileOpen} aria-controls="admin-mobile-navigation"
        className="inline-flex h-10 items-center gap-2 rounded-lg border border-line px-3 text-sm font-semibold text-ink hover:bg-pale">
        {mobileOpen ? <X size={17} /> : <ChevronDown size={17} />}
        {mobileOpen ? "Close" : "Sections"}
      </button>
    </div>

    <aside className="hidden w-[292px] shrink-0 self-start lg:sticky lg:top-20 lg:block lg:h-[calc(100dvh-6rem)]">
      <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_8px_30px_rgba(23,43,36,0.04)]">
        <div className="border-b border-line px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-lg font-bold tracking-tight text-white">b</div>
            <div className="min-w-0">
              <p className="text-[15px] font-bold tracking-tight text-ink">buna</p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">Admin workspace</p>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between rounded-lg bg-pale px-3 py-2">
            <span className="text-xs font-medium text-muted">Signed in as</span>
            <span className="rounded-full border border-primary/15 bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary-deep">{role}</span>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto py-5">
          <SidebarLinks isAdmin={isAdmin} />
        </div>
        <div className="border-t border-line px-5 py-3">
          <p className="text-[11px] leading-relaxed text-muted">Buna administration · Authorized staff only</p>
        </div>
      </div>
    </aside>

    {mobileOpen ? <div id="admin-mobile-navigation" className="mb-4 rounded-2xl border border-line bg-surface py-4 shadow-sm lg:hidden">
      <div className="mb-4 flex items-center justify-between border-b border-line px-5 pb-4">
        <div><p className="font-bold text-ink">buna</p><p className="text-xs text-muted">Admin workspace · {role}</p></div>
        <button type="button" onClick={() => setMobileOpen(false)} aria-label="Close admin navigation" className="rounded-lg p-2 text-muted hover:bg-pale"><X size={18}/></button>
      </div>
      <SidebarLinks isAdmin={isAdmin} onNavigate={() => setMobileOpen(false)} />
    </div> : null}
  </>;
}

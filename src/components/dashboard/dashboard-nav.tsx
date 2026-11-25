"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { NavItem } from "@/config/site";

const groups: { label: string; hrefs: string[] }[] = [
  { label: "Workspace", hrefs: ["/dashboard", "/dashboard/startup", "/dashboard/launches", "/dashboard/inquiries"] },
  { label: "Discover", hrefs: ["/cofounders", "/dashboard/investor-portal"] },
  { label: "Your Buna", hrefs: ["/dashboard/activity", "/dashboard/referrals", "/dashboard/following", "/dashboard/saved", "/dashboard/notifications"] },
  { label: "Account", hrefs: ["/dashboard/profile", "/dashboard/security", "/dashboard/settings"] },
];

export function DashboardNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const byHref = new Map(items.map((item) => [item.href, item]));
  return (
    <nav aria-label="Dashboard" className="space-y-5 lg:sticky lg:top-24">
      {groups.map((group) => {
        const visible = group.hrefs.map((href) => byHref.get(href)).filter((item): item is NavItem => Boolean(item));
        if (!visible.length) return null;
        return <section key={group.label} className="space-y-1">
          <h2 className="hidden px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted lg:block">{group.label}</h2>
          <div className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
            {visible.map((item) => {
              const active = item.href === "/dashboard" ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/");
              return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined}
                className={cn("whitespace-nowrap rounded-lg px-3 py-2.5 text-sm font-medium no-underline transition-colors",
                  active ? "bg-primary-pale text-primary-deep" : "text-muted hover:bg-surface-secondary hover:text-ink")}>
                {item.label}
              </Link>;
            })}
          </div>
        </section>;
      })}
    </nav>
  );
}

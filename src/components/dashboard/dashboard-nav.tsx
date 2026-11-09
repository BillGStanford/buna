"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { NavItem } from "@/config/site";

export function DashboardNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Dashboard" className="flex gap-1 overflow-x-auto rounded-xl border border-line bg-surface p-2 lg:sticky lg:top-20 lg:flex-col lg:gap-1">
      {items.map((item) => {
        const active = item.href === "/dashboard" ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined}
            className={cn("whitespace-nowrap rounded-lg border-l-2 px-3 py-2.5 text-sm font-medium no-underline transition-colors",
              active ? "border-primary bg-primary-mint text-primary-deep" : "border-transparent text-ink hover:border-line hover:bg-primary-pale")}>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

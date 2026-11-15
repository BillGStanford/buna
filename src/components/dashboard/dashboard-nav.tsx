"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { NavItem } from "@/config/site";

export function DashboardNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Dashboard" className="flex gap-1 overflow-x-auto border-b border-line bg-transparent pb-2 lg:sticky lg:top-20 lg:flex-col lg:gap-1 lg:border-b-0 lg:border-r lg:pr-3 lg:pb-0">
      {items.map((item) => {
        const active = item.href === "/dashboard" ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined}
            className={cn(
              "whitespace-nowrap rounded-md px-3 py-2.5 text-sm font-medium no-underline transition-colors",
              active ? "bg-primary-pale text-primary-deep" : "text-muted hover:bg-surface-subtle hover:text-ink",
            )}>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

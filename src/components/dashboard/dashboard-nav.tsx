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
        const active = item.href === "/dashboard" ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined}
            className={cn(
              "whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium no-underline transition-colors lg:border-b-0 lg:border-l-2",
              active
                ? "border-primary bg-transparent text-primary-deep"
                : "border-transparent text-muted hover:border-line hover:bg-transparent hover:text-ink",
            )}>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

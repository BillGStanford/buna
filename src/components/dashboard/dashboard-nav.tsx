"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { NavItem } from "@/config/site";

export function DashboardNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Dashboard" className="flex gap-1 overflow-x-auto lg:flex-col">
      {items.map((item) => {
        const active = item.href === "/dashboard" ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined}
            className={cn("whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium no-underline",
              active ? "bg-primary-mint text-primary-deep" : "text-ink hover:bg-primary-pale")}>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

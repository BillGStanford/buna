"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { NavItem } from "@/config/site";

const groups = [
  { label: "Discover", links: ["/startups", "/ecosystem", "/launches"] },
  { label: "Network", links: ["/cofounders", "/investor", "/community", "/opportunities", "/founders"] },
  { label: "About", links: ["/about"] },
];

export function PrimaryNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState<string | null>(null);
  const byHref = new Map(items.map((item) => [item.href, item]));
  return (
    <nav aria-label="Primary" className="hidden items-center gap-1 xl:flex">
      {groups.map((group) => {
        const links = group.links.map((href) => byHref.get(href)).filter((item): item is NavItem => Boolean(item));
        if (!links.length) return null;
        const active = links.some((item) => pathname === item.href || pathname.startsWith(item.href + "/"));
        const expanded = open === group.label;
        return (
          <div key={group.label} className="relative">
            <button
              type="button"
              aria-haspopup="true"
              aria-expanded={expanded}
              onClick={() => setOpen(expanded ? null : group.label)}
              onBlur={(event) => {
                if (!event.currentTarget.parentElement?.contains(event.relatedTarget as Node | null)) setOpen(null);
              }}
              onKeyDown={(event) => { if (event.key === "Escape") setOpen(null); }}
              className={`inline-flex items-center gap-1 rounded-md border px-3 py-2 text-[13px] font-medium transition-colors ${active ? "border-line bg-primary-pale text-primary-deep" : "border-transparent text-muted hover:border-line hover:bg-surface-subtle hover:text-ink"}`}
            >
              {group.label}<ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} aria-hidden="true" />
            </button>
            {expanded ? (
              <div className="absolute left-0 top-full z-50 mt-2 min-w-52 rounded-xl border border-line bg-surface p-2 shadow-xl">
                {links.map((item) => {
                  const itemActive = pathname === item.href || pathname.startsWith(item.href + "/");
                  return (
                    <Link key={item.href} href={item.href} onClick={() => setOpen(null)} aria-current={itemActive ? "page" : undefined}
                      className={`block rounded-lg px-3 py-2.5 text-sm no-underline transition-colors ${itemActive ? "bg-primary-pale font-semibold text-primary-deep" : "text-ink hover:bg-surface-subtle"}`}>
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}

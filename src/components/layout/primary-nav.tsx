"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Compass, Rocket, Users, Landmark, MessagesSquare, MoreHorizontal } from "lucide-react";
import type { NavItem } from "@/config/site";

const featured = [
  { href: "/startups", label: "Discover", Icon: Compass },
  { href: "/launches", label: "Launches", Icon: Rocket },
  { href: "/cofounders", label: "Co-founders", Icon: Users },
  { href: "/investor", label: "Investors", Icon: Landmark },
  { href: "/community", label: "Community", Icon: MessagesSquare },
];

export function PrimaryNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = React.useState(false);
  React.useEffect(() => setMoreOpen(false), [pathname]);

  const extras = items.filter((item) => !featured.some((entry) => entry.href === item.href));
  const moreActive = extras.some((item) => pathname === item.href || pathname.startsWith(item.href + "/"));

  return (
    <nav aria-label="Primary" className="hidden items-center gap-1 rounded-2xl border border-line/80 bg-surface-subtle/70 p-1 xl:flex">
      {featured.map(({ href, label, Icon }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`group relative inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[13px] font-semibold no-underline transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${active ? "bg-surface text-primary-deep shadow-sm" : "text-muted hover:bg-surface hover:text-ink"}`}
          >
            <Icon className={`h-4 w-4 transition-transform duration-200 group-hover:-translate-y-0.5 ${active ? "text-primary" : "text-muted"}`} aria-hidden="true" />
            {label}
            {active ? <span className="absolute inset-x-3 -bottom-1 h-0.5 rounded-full bg-primary" /> : null}
          </Link>
        );
      })}
      {extras.length > 0 ? (
        <div className="relative">
          <button
            type="button"
            aria-expanded={moreOpen}
            aria-haspopup="menu"
            onClick={() => setMoreOpen((open) => !open)}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${moreActive || moreOpen ? "bg-surface text-primary-deep shadow-sm" : "text-muted hover:bg-surface hover:text-ink"}`}
          >
            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
            More
            <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${moreOpen ? "rotate-180" : ""}`} aria-hidden="true" />
          </button>
          {moreOpen ? (
            <div role="menu" className="absolute right-0 top-[calc(100%+12px)] z-50 w-52 rounded-2xl border border-line bg-surface p-1.5 shadow-xl shadow-ink/10">
              {extras.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    role="menuitem"
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium no-underline transition-colors ${active ? "bg-primary-pale text-primary-deep" : "text-ink hover:bg-surface-subtle"}`}
                  >
                    {item.label}
                    {active ? <span className="h-1.5 w-1.5 rounded-full bg-primary" /> : null}
                  </Link>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}
    </nav>
  );
}

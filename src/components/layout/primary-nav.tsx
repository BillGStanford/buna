"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { NavItem } from "@/config/site";

const directLinks = ["/startups", "/investor", "/community", "/founders"];

export function PrimaryNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const byHref = new Map(items.map((item) => [item.href, item]));
  const visible = directLinks.map((href) => byHref.get(href)).filter((item): item is NavItem => Boolean(item));
  const more = items.filter((item) => !directLinks.includes(item.href));
  const moreActive = more.some((item) => pathname === item.href || pathname.startsWith(item.href + "/"));

  return (
    <nav aria-label="Primary" className="hidden items-center gap-1 xl:flex">
      {visible.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined}
            className={`rounded-md px-3 py-2 text-[13px] font-medium no-underline transition-colors ${active ? "bg-primary-pale text-primary-deep" : "text-muted hover:bg-surface-subtle hover:text-ink"}`}>
            {item.label}
          </Link>
        );
      })}
      {more.length ? (
        <div className="relative">
          <button type="button" aria-haspopup="true" aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
            onBlur={(event) => {
              if (!event.currentTarget.parentElement?.contains(event.relatedTarget as Node | null)) setOpen(false);
            }}
            onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); }}
            className={`inline-flex items-center gap-1 rounded-md px-3 py-2 text-[13px] font-medium transition-colors ${moreActive ? "bg-primary-pale text-primary-deep" : "text-muted hover:bg-surface-subtle hover:text-ink"}`}>
            More <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
          </button>
          {open ? (
            <div className="absolute right-0 top-full z-50 mt-2 min-w-56 rounded-xl border border-line bg-surface p-2 shadow-xl">
              {more.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                return <Link key={item.href} href={item.href} onClick={() => setOpen(false)} aria-current={active ? "page" : undefined}
                  className={`block rounded-lg px-3 py-2.5 text-sm no-underline transition-colors ${active ? "bg-primary-pale font-semibold text-primary-deep" : "text-ink hover:bg-surface-subtle"}`}>{item.label}</Link>;
              })}
            </div>
          ) : null}
        </div>
      ) : null}
    </nav>
  );
}

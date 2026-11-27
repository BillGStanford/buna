"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { NavItem } from "@/config/site";

const directHrefs = ["/startups", "/ecosystem", "/launches", "/cofounders", "/investor"];
const moreHrefs = ["/community", "/opportunities", "/founders", "/about"];

export function PrimaryNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const byHref = new Map(items.map((item) => [item.href, item]));
  const direct = directHrefs.map((href) => byHref.get(href)).filter((item): item is NavItem => Boolean(item));
  const more = moreHrefs.map((href) => byHref.get(href)).filter((item): item is NavItem => Boolean(item));
  const active = (href: string) => pathname === href || pathname.startsWith(href + "/");
  const moreActive = more.some((item) => active(item.href));

  return (
    <nav aria-label="Primary" className="hidden items-center gap-1 2xl:flex">
      {direct.map((item) => (
        <Link key={item.href} href={item.href} aria-current={active(item.href) ? "page" : undefined}
          className={`rounded-md px-2.5 py-2 text-[13px] font-medium no-underline transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${active(item.href) ? "bg-primary-mint text-primary-deep" : "text-muted hover:bg-surface-subtle hover:text-ink"}`}>
          {item.label}
        </Link>
      ))}
      {more.length ? (
        <div className="relative">
          <button type="button" aria-haspopup="true" aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
            onBlur={(event) => { if (!event.currentTarget.parentElement?.contains(event.relatedTarget as Node | null)) setOpen(false); }}
            onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); }}
            className={`inline-flex items-center gap-1 rounded-md px-2.5 py-2 text-[13px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${moreActive || open ? "bg-primary-mint text-primary-deep" : "text-muted hover:bg-surface-subtle hover:text-ink"}`}>
            More <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
          </button>
          {open ? (
            <div className="absolute right-0 top-full z-50 mt-2 min-w-48 rounded-xl border border-line bg-surface p-2 shadow-lg">
              {more.map((item) => (
                <Link key={item.href} href={item.href} onClick={() => setOpen(false)} aria-current={active(item.href) ? "page" : undefined}
                  className={`block rounded-lg px-3 py-2.5 text-sm no-underline transition-colors ${active(item.href) ? "bg-primary-mint font-semibold text-primary-deep" : "text-ink hover:bg-surface-subtle"}`}>
                  {item.label}
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </nav>
  );
}

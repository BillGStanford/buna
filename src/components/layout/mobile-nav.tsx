"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { Button, buttonStyles } from "@/components/ui/button";
import type { NavItem } from "@/config/site";

export function MobileNav({ items, signedIn }: { items: NavItem[]; signedIn: boolean }) {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();
  const panelId = React.useId();

  React.useEffect(() => { setOpen(false); }, [pathname]);
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="md:hidden">
      <Button variant="ghost" size="sm" aria-expanded={open} aria-controls={panelId}
        aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpen((o) => !o)} className="px-2">
        {open ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
      </Button>
      {open ? (
        <div id={panelId} className="absolute inset-x-0 top-full border-b border-line bg-surface shadow-md">
          <nav aria-label="Mobile" className="container-page flex flex-col gap-1 py-3">
            {items.map((item) => (
              <Link key={item.href} href={item.href} className="rounded-md px-3 py-2.5 text-base font-medium text-ink no-underline hover:bg-primary-mint">
                {item.label}
              </Link>
            ))}
            {!signedIn ? (
              <div className="mt-2 grid grid-cols-2 gap-2 border-t border-line pt-3">
                <Link href="/login" className={buttonStyles("secondary", "md")}>Sign in</Link>
                <Link href="/signup" className={buttonStyles("primary", "md")}>Get started</Link>
              </div>
            ) : null}
          </nav>
        </div>
      ) : null}
    </div>
  );
}

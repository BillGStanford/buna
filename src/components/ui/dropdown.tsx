"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/** Disclosure-style menu: button + panel. Closes on Escape and outside click, returns focus to the button. */
export function Dropdown({ label, trigger, children, align = "right" }: {
  label: string; trigger: React.ReactNode; children: React.ReactNode; align?: "left" | "right";
}) {
  const [open, setOpen] = React.useState(false);
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const panelId = React.useId();

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setOpen(false); buttonRef.current?.focus(); }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button ref={buttonRef} type="button" aria-label={label} aria-expanded={open} aria-controls={panelId}
        onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 rounded-full p-0.5 hover:bg-primary-mint">
        {trigger}
      </button>
      {open ? (
        <div id={panelId} onClick={(e) => { if ((e.target as HTMLElement).closest("a")) setOpen(false); }}
          className={cn("absolute z-50 mt-2 w-60 rounded-lg border border-line bg-surface p-1.5 shadow-md", align === "right" ? "right-0" : "left-0")}>
          {children}
        </div>
      ) : null}
    </div>
  );
}

export const menuItemClass =
  "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-ink no-underline hover:bg-primary-mint";

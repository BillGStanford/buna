"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type TabItem = { id: string; label: string; content: React.ReactNode };

/** Accessible tabs with arrow-key navigation (WAI-ARIA tabs pattern). */
export function Tabs({ items, label }: { items: TabItem[]; label: string }) {
  const [active, setActive] = React.useState(items[0]?.id);
  const base = React.useId();
  const refs = React.useRef<Record<string, HTMLButtonElement | null>>({});

  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    let next = index;
    if (e.key === "ArrowRight") next = (index + 1) % items.length;
    else if (e.key === "ArrowLeft") next = (index - 1 + items.length) % items.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = items.length - 1;
    else return;
    e.preventDefault();
    const target = items[next];
    if (target) { setActive(target.id); refs.current[target.id]?.focus(); }
  };

  return (
    <div>
      <div role="tablist" aria-label={label} className="flex gap-1 overflow-x-auto border-b border-line">
        {items.map((item, i) => (
          <button key={item.id} ref={(el) => { refs.current[item.id] = el; }} role="tab" type="button"
            id={`${base}-tab-${item.id}`} aria-selected={active === item.id} aria-controls={`${base}-panel-${item.id}`}
            tabIndex={active === item.id ? 0 : -1} onClick={() => setActive(item.id)} onKeyDown={(e) => onKeyDown(e, i)}
            className={cn("-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium",
              active === item.id ? "border-primary text-primary-deep" : "border-transparent text-muted hover:text-ink")}>
            {item.label}
          </button>
        ))}
      </div>
      {items.map((item) => (
        <div key={item.id} role="tabpanel" id={`${base}-panel-${item.id}`} aria-labelledby={`${base}-tab-${item.id}`}
          hidden={active !== item.id} className="pt-4">
          {active === item.id ? item.content : null}
        </div>
      ))}
    </div>
  );
}

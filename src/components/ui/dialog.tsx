"use client";

import * as React from "react";
import { X } from "lucide-react";
import { Button } from "./button";

/**
 * Accessible modal built on the native <dialog>: focus is trapped, Escape closes it and
 * focus returns to the trigger. Use for confirmations of destructive actions.
 */
export function Dialog({ open, onClose, title, description, children }: {
  open: boolean; onClose: () => void; title: string; description?: string; children?: React.ReactNode;
}) {
  const ref = React.useRef<HTMLDialogElement>(null);
  const titleId = React.useId();
  const descId = React.useId();

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog ref={ref} onClose={onClose} onCancel={onClose}
      aria-labelledby={titleId} aria-describedby={description ? descId : undefined}
      onClick={(e) => { if (e.target === ref.current) onClose(); }}
      className="w-[calc(100%-2rem)] max-w-md rounded-lg border border-line bg-surface p-0 text-ink shadow-lg backdrop:bg-ink/40">
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-lg font-semibold">{title}</h2>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close dialog" className="-mr-2 -mt-1 px-2">
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
        {description ? <p id={descId} className="mt-1 text-sm text-muted">{description}</p> : null}
        <div className="mt-4">{children}</div>
      </div>
    </dialog>
  );
}

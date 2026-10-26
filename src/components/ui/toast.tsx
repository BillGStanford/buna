"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type Toast = { id: number; message: string; tone: "success" | "error" | "info" };
type Ctx = { toast: (message: string, tone?: Toast["tone"]) => void };

const ToastContext = React.createContext<Ctx | null>(null);

export function useToast(): Ctx {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

/** Non-blocking feedback (e.g. “Saved”). The region is aria-live so screen readers announce it. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const counter = React.useRef(0);

  const toast = React.useCallback((message: string, tone: Toast["tone"] = "success") => {
    const id = ++counter.current;
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === "error" ? 7000 : 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div aria-live="polite" role="status" className="pointer-events-none fixed inset-x-0 bottom-4 z-[90] flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div key={t.id} className={cn("pointer-events-auto max-w-sm rounded-md border px-4 py-2.5 text-sm shadow-md",
            t.tone === "error" ? "border-danger/30 bg-surface text-danger" : "border-primary/20 bg-surface text-ink")}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

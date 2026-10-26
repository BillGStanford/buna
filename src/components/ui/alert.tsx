import * as React from "react";
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "info" | "success" | "warning" | "error";
const tones: Record<Tone, { box: string; icon: React.ElementType }> = {
  info: { box: "border-primary/20 bg-primary-pale text-ink", icon: Info },
  success: { box: "border-success/30 bg-primary-mint text-ink", icon: CheckCircle2 },
  warning: { box: "border-warning/40 bg-warning/10 text-ink", icon: TriangleAlert },
  error: { box: "border-danger/30 bg-danger/10 text-ink", icon: AlertCircle },
};

export function Alert({ tone = "info", title, children, className }: {
  tone?: Tone; title?: string; children?: React.ReactNode; className?: string;
}) {
  const { box, icon: Icon } = tones[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("flex gap-3 rounded-md border p-3 text-sm", box, className)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={title ? "mt-0.5" : undefined}>{children}</div> : null}
      </div>
    </div>
  );
}

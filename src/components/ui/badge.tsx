import * as React from "react";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "green" | "warning" | "danger";
const tones: Record<Tone, string> = {
  neutral: "bg-primary-pale text-muted border-line",
  green: "bg-primary-mint text-primary-deep border-primary/20",
  warning: "bg-warning/10 text-warning-text border-warning/30",
  danger: "bg-danger/10 text-danger border-danger/30",
};

export function Badge({ tone = "neutral", className, ...props }: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span className={cn("inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium", tones[tone], className)} {...props} />
  );
}

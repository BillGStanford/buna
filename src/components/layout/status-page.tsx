import Link from "next/link";
import { buttonStyles } from "@/components/ui/button";

export function StatusPage({ code, title, children, actions }: {
  code?: string; title: string; children?: React.ReactNode;
  actions?: { label: string; href: string; variant?: "primary" | "secondary" }[];
}) {
  return (
    <div className="container-page flex min-h-[55vh] flex-col items-start justify-center gap-4 py-16">
      {code ? <p className="text-sm font-semibold tabular-nums text-primary">{code}</p> : null}
      <h1 className="text-3xl font-bold sm:text-4xl">{title}</h1>
      {children ? <div className="max-w-lg text-base text-muted">{children}</div> : null}
      <div className="mt-2 flex flex-wrap gap-3">
        {(actions ?? [{ label: "Go to the homepage", href: "/" }]).map((a) => (
          <Link key={a.href + a.label} href={a.href} className={buttonStyles(a.variant ?? "primary", "md")}>{a.label}</Link>
        ))}
      </div>
    </div>
  );
}

import { CSS_PALETTE, heroArt, spots, type SpotName } from "@/lib/art";
import { cn } from "@/lib/utils";

/** Decorative artwork rendered inline (so it follows the design tokens). Static, trusted markup from src/lib/art.ts. */
export function Illustration({ name, className }: { name: SpotName; className?: string }) {
  return <div aria-hidden="true" className={cn("w-40 shrink-0 [&>svg]:h-auto [&>svg]:w-full", className)} dangerouslySetInnerHTML={{ __html: spots[name](CSS_PALETTE) }} />;
}

export function HeroIllustration({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("[&>svg]:h-auto [&>svg]:w-full", className)} dangerouslySetInnerHTML={{ __html: heroArt(CSS_PALETTE) }} />;
}

/** Consistent empty state: illustration, a title, what to do next. */
export function EmptyState({ illustration, title, children, action, className }: {
  illustration: SpotName; title: string; children?: React.ReactNode; action?: React.ReactNode; className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-4 rounded-lg border border-dashed border-line bg-primary-pale/40 px-6 py-10 text-center sm:flex-row sm:text-left", className)}>
      <Illustration name={illustration} className="w-36 sm:w-44" />
      <div className="max-w-lg">
        <h2 className="text-lg font-semibold">{title}</h2>
        {children ? <div className="mt-1 text-sm text-muted">{children}</div> : null}
        {action ? <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">{action}</div> : null}
      </div>
    </div>
  );
}

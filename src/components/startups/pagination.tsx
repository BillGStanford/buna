import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { paginationWindow } from "@/lib/startups/params";

const base = "inline-flex h-9 min-w-9 items-center justify-center rounded-md border px-3 text-sm font-medium no-underline";

/** Page links for any list: the caller supplies how to build a URL for a page number. */
export function Pagination({ page, pages, hrefFor }: { page: number; pages: number; hrefFor: (page: number) => string }) {
  if (pages <= 1) return null;
  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-center gap-1.5">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} rel="prev" className={cn(base, "border-line text-ink hover:bg-primary-mint")}>
          <ChevronLeft className="h-4 w-4" aria-hidden="true" /><span className="sr-only sm:not-sr-only sm:ml-1">Previous</span>
        </Link>
      ) : null}
      {paginationWindow(page, pages).map((n, i) =>
        n === "…" ? (
          <span key={`gap-${i}`} aria-hidden="true" className="px-1 text-muted">…</span>
        ) : (
          <Link key={n} href={hrefFor(n)} aria-label={`Page ${n}`} aria-current={n === page ? "page" : undefined}
            className={cn(base, "tabular-nums", n === page ? "border-primary bg-primary text-white" : "border-line text-ink hover:bg-primary-mint")}>
            {n}
          </Link>
        ),
      )}
      {page < pages ? (
        <Link href={hrefFor(page + 1)} rel="next" className={cn(base, "border-line text-ink hover:bg-primary-mint")}>
          <span className="sr-only sm:not-sr-only sm:mr-1">Next</span><ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      ) : null}
    </nav>
  );
}

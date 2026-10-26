import { cn } from "@/lib/utils";

/** Readable long-form text (legal and help pages). */
export function Prose({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("max-w-3xl text-[15px] leading-relaxed text-ink [&_a]:font-medium [&_h2]:mb-3 [&_h2]:mt-10 [&_h2]:text-2xl [&_h2]:font-bold [&_h3]:mb-2 [&_h3]:mt-6 [&_h3]:text-lg [&_h3]:font-semibold [&_li]:mt-1.5 [&_ol]:ml-5 [&_ol]:list-decimal [&_p]:mt-3 [&_strong]:font-semibold [&_table]:mt-4 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-line [&_td]:p-2 [&_td]:align-top [&_th]:border [&_th]:border-line [&_th]:bg-primary-pale [&_th]:p-2 [&_th]:text-left [&_ul]:ml-5 [&_ul]:list-disc", className)}>
      {children}
    </div>
  );
}

export function PageHeader({ title, intro, updated }: { title: string; intro?: string; updated?: string }) {
  return (
    <header className="border-b border-line bg-primary-pale">
      <div className="container-page py-10">
        <h1 className="text-3xl font-bold sm:text-4xl">{title}</h1>
        {intro ? <p className="mt-3 max-w-2xl text-lg text-muted">{intro}</p> : null}
        {updated ? <p className="mt-3 text-sm text-muted">Last updated <time dateTime={updated}>{updated}</time></p> : null}
      </div>
    </header>
  );
}

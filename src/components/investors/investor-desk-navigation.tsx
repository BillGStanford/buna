"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bookmark, ChartNoAxesCombined, Compass, FolderLock, GitBranch, Inbox, LayoutDashboard, Search, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

const primary = [
  { href: "/dashboard/investor", label: "Home", icon: LayoutDashboard, match: (path: string) => path === "/dashboard/investor" },
  { href: "/dashboard/investor/discover", label: "Discover", icon: Compass, match: (path: string) => path.startsWith("/dashboard/investor/discover") || path.startsWith("/dashboard/investor/compare") },
  { href: "/dashboard/investor/startups", label: "Watchlist", icon: Bookmark, match: (path: string) => path.startsWith("/dashboard/investor/startups") },
  { href: "/dashboard/investor/pipeline", label: "Pipeline", icon: GitBranch, match: (path: string) => path.startsWith("/dashboard/investor/pipeline") },
  { href: "/dashboard/investor/inbox", label: "Inbox", icon: Inbox, match: (path: string) => path.startsWith("/dashboard/investor/inbox") || path.startsWith("/dashboard/investor/conversations") },
];

const secondary = [
  { href: "/dashboard/investor/searches", label: "Saved searches", icon: Search, description: "Saved filters and matching alerts" },
  { href: "/dashboard/investor/data-rooms", label: "Data rooms", icon: FolderLock, description: "Documents founders have approved you to view" },
  { href: "/dashboard/investor/profile", label: "Investor profile", icon: UserRound, description: "Your public investor information" },
];

const guidance: Array<{ match: (path: string) => boolean; title: string; description: string; how: string }> = [
  { match: (p) => p === "/dashboard/investor", title: "Your investment workspace", description: "Discover promising African startups, keep track of companies, and manage conversations with founders.", how: "Start in Discover. Save companies you want to revisit, add serious prospects to your private pipeline, and use Inbox when founders contact you." },
  { match: (p) => p.startsWith("/dashboard/investor/discover"), title: "Discover startups", description: "Find companies by sector, geography, stage, business model, and fundraising status.", how: "Filters narrow the published startup directory. Saving a search stores your criteria and can enable alerts; it does not contact any founder." },
  { match: (p) => p.startsWith("/dashboard/investor/startups"), title: "Your watchlist", description: "A private shortlist of companies you want to follow or research further.", how: "Saving a company does not notify its founders and does not mean you intend to invest. Move a company into your pipeline when you want to track a decision." },
  { match: (p) => p.startsWith("/dashboard/investor/pipeline"), title: "Your private pipeline", description: "Track a company's progress from discovery to contact, review, meeting, or a pass decision.", how: "Pipeline stages and notes are for your own workflow. They are not visible to founders and do not represent a funding commitment." },
  { match: (p) => p.startsWith("/dashboard/investor/inbox") || p.startsWith("/dashboard/investor/conversations"), title: "Founder inbox", description: "Review pitches and introduction requests, then manage conversations with founders.", how: "A founder submission is a request to start a conversation, not an investment offer or obligation. Review the information before responding." },
  { match: (p) => p.startsWith("/dashboard/investor/searches"), title: "Saved searches and alerts", description: "Keep useful search criteria so you can return to them without rebuilding your filters.", how: "Alerts help surface matching companies. Always review the startup's latest profile and fundraising information before making a decision." },
  { match: (p) => p.startsWith("/dashboard/investor/data-rooms"), title: "Startup data rooms", description: "Review confidential documents that a startup has explicitly approved you to access.", how: "Request access from a startup profile. Documents appear here only after approval. Access does not imply an agreement to invest." },
  { match: (p) => p.startsWith("/dashboard/investor/profile"), title: "Your investor profile", description: "Keep your investment focus and contact information clear so founders can understand whether to approach you.", how: "Only publish information you are comfortable sharing with founders and the Buna community. Keep your thesis, regions, stages, and contact details current." },
  { match: (p) => p.startsWith("/dashboard/investor/compare"), title: "Compare startups", description: "Review selected companies side by side using the information available in their profiles.", how: "Thesis alignment is a simple indication of how listed startup details compare with your saved preferences. It is not an investment recommendation, valuation, or due-diligence result." },
];

export function InvestorDeskNavigation() {
  const pathname = usePathname();
  const current = guidance.find((item) => item.match(pathname)) ?? guidance[0];
  return (
    <div className="mb-6 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-primary-deep">Buna · Capital network</p>
          <p className="mt-0.5 text-sm font-semibold">Investor Desk</p>
        </div>
        <Link href="/dashboard/investor-portal" className="text-xs font-medium text-muted underline underline-offset-4 hover:text-ink">Investor Portal & application</Link>
      </div>
      <nav aria-label="Investor Desk" className="flex flex-wrap gap-1 rounded-xl border border-line bg-surface p-2">
        {primary.map(({ href, label, icon: Icon, match }) => {
          const active = match(pathname);
          return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={cn("inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium no-underline transition-colors", active ? "border-primary/20 bg-primary-mint text-primary-deep" : "border-transparent text-muted hover:border-line hover:bg-primary-pale hover:text-ink")}>
            <Icon aria-hidden="true" className="h-4 w-4" />{label}
          </Link>;
        })}
        <details className="relative ml-auto">
          <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted hover:bg-primary-pale hover:text-ink"><ChartNoAxesCombined className="h-4 w-4" /> More tools</summary>
          <div className="absolute right-0 z-20 mt-2 w-72 rounded-xl border border-line bg-surface p-2 shadow-lg">
            {secondary.map(({ href, label, icon: Icon, description }) => <Link key={href} href={href} className="flex gap-3 rounded-lg p-3 no-underline hover:bg-primary-pale">
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary-deep" />
              <span><span className="block text-sm font-medium text-ink">{label}</span><span className="mt-0.5 block text-xs text-muted">{description}</span></span>
            </Link>)}
          </div>
        </details>
      </nav>
      <section className="rounded-xl border border-line bg-surface px-4 py-3" aria-labelledby="investor-page-heading">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-primary-deep">Page guide · {current.title}</p>
            <p className="mt-1 max-w-3xl text-sm text-muted">{current.description}</p>
          </div>
          <details className="max-w-full shrink-0">
            <summary className="cursor-pointer rounded-md border border-line px-3 py-1.5 text-xs font-semibold text-primary-deep hover:bg-primary-pale">How does this work?</summary>
            <p className="mt-2 max-w-xl rounded-lg border border-line bg-primary-pale/50 p-3 text-sm leading-6 text-ink">{current.how}</p>
          </details>
        </div>
      </section>
    </div>
  );
}

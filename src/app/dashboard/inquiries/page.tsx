import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/illustrations";
import { Pagination } from "@/components/startups/pagination";
import { requireProfile } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { INQUIRY_PAGE_SIZE, listInquiries } from "@/lib/inquiries/queries";

export const metadata: Metadata = { title: "Inquiries" };
const FILTERS = [["", "All"], ["new", "New"], ["read", "Read"], ["replied", "Replied"], ["archived", "Archived"], ["spam", "Spam"]] as const;

export default async function InquiriesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireProfile("/dashboard/inquiries");
  const sp = await searchParams;
  const status = FILTERS.some(([v]) => v === sp.status) ? (sp.status ?? "") : "";
  const parsed = Number.parseInt(sp.page ?? "1", 10);
  const page = Number.isFinite(parsed) && parsed >= 1 ? Math.min(parsed, 1000) : 1;
  const { items, total } = await listInquiries(status, page);
  const pages = Math.max(1, Math.ceil(total / INQUIRY_PAGE_SIZE));
  const href = (s: string, p = 1) => { const qs = new URLSearchParams(); if (s) qs.set("status", s); if (p > 1) qs.set("page", String(p)); return qs.toString() ? `/dashboard/inquiries?${qs}` : "/dashboard/inquiries"; };
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Inquiries</h1><p className="mt-1 text-sm text-muted">Messages sent to your startups through their public pages. Reply by email to the sender.</p></div>
      <nav aria-label="Inquiry status" className="flex gap-1 overflow-x-auto border-b border-line">
        {FILTERS.map(([v, label]) => <Link key={v} href={href(v)} aria-current={status === v ? "page" : undefined} className={cn("-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium no-underline", status === v ? "border-primary text-primary-deep" : "border-transparent text-muted hover:text-ink")}>{label}</Link>)}
      </nav>
      {items.length === 0 ? (
        <EmptyState illustration="inbox" title={status ? "No inquiries with that status" : "No inquiries yet"}>{status ? <Link href="/dashboard/inquiries" className="font-medium">Show all inquiries</Link> : "When someone contacts one of your startups, it appears here and you’re notified."}</EmptyState>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line">
          {items.map((i) => (
            <li key={i.id} className={cn("p-4", !i.read_at && "bg-primary-pale")}>
              <div className="flex flex-wrap items-center gap-2">
                {!i.read_at ? <span aria-hidden="true" className="h-2 w-2 rounded-full bg-primary" /> : null}
                <Link href={`/dashboard/inquiries/${i.id}`} className={cn("no-underline hover:underline", i.read_at ? "text-ink" : "font-semibold text-ink")}>{i.subject}</Link>
                {!i.read_at ? <span className="sr-only">(unread)</span> : null}
                <Badge tone={i.status === "new" ? "green" : i.status === "spam" ? "danger" : "neutral"}>{i.status}</Badge>
              </div>
              <p className="mt-1 text-sm text-muted">From {i.sender_name} · to {i.startup?.name ?? "your startup"} · <time dateTime={i.created_at}>{formatDateTime(i.created_at)}</time></p>
              <p className="mt-1 line-clamp-2 text-sm">{i.message}</p>
            </li>
          ))}
        </ul>
      )}
      <Pagination page={page} pages={pages} hrefFor={(n) => href(status, n)} />
    </div>
  );
}

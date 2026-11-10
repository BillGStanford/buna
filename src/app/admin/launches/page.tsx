import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, Settings2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PendingControls, PublishedControls } from "@/components/launches/manage/moderation-controls";
import { StartupLogo } from "@/components/startups/startup-logo";
import { formatDateTime } from "@/lib/format";
import { listForModeration } from "@/lib/launches/queries";

export const metadata: Metadata = { title: "Launch moderation" };

const safe = (url: string) => { try { const u = new URL(url); return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null; } catch { return null; } };

export default async function AdminLaunchesPage() {
  const [pending, published] = await Promise.all([listForModeration("pending_review", 50), listForModeration("published", 20)]);
  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm"><Link href="/admin" className="font-medium">Admin</Link></p>
        <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-bold">Launch moderation</h1><Link href="/admin/launches/settings" className="inline-flex items-center gap-2 rounded-md border border-line px-3 py-2 text-sm font-medium no-underline hover:bg-primary-pale"><Settings2 className="h-4 w-4" aria-hidden="true" />Competition settings</Link></div>
        <p className="mt-1 text-sm text-muted">Every decision is recorded in the audit log and the maker is notified.</p>
      </div>

      <section aria-labelledby="pending-heading" className="space-y-3">
        <h2 id="pending-heading" className="text-lg font-semibold">Waiting for review <span className="tabular-nums text-muted">({pending.length})</span></h2>
        {pending.length === 0 ? <p className="rounded-lg border border-dashed border-line p-6 text-sm text-muted">Nothing is waiting. 🎉</p> : (
          <ul className="space-y-4">
            {pending.map((l) => {
              const url = safe(l.product_url);
              return (
                <li key={l.id}>
                  <Card>
                    <CardHeader className="flex flex-wrap items-start gap-4">
                      <StartupLogo name={l.name} src={l.logo_url} size={48} />
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold">{l.name}</h3>
                        <p className="text-sm text-muted">{l.tagline}</p>
                        <p className="mt-1 text-xs text-muted">
                          {l.category ? <>{l.category.name} · </> : null}by {l.maker ? <Link href={`/users/${l.maker.username}`}>@{l.maker.username}</Link> : "unknown"} · submitted <time dateTime={l.created_at}>{formatDateTime(l.created_at)}</time>
                          {l.launch_date ? <> · launch date {l.launch_date}</> : null}
                        </p>
                      </div>
                      <div className="flex gap-3 text-sm">
                        <Link href={`/launches/${l.slug}`}>Preview</Link>
                        {url ? <a href={url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1">Product<ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /><span className="sr-only"> (opens in a new tab)</span></a> : null}
                      </div>
                    </CardHeader>
                    <CardBody className="space-y-3">
                      <p className="whitespace-pre-line text-sm">{l.description || "No description."}</p>
                      <PendingControls launchId={l.id} name={l.name} />
                    </CardBody>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="live-heading" className="space-y-3">
        <h2 id="live-heading" className="text-lg font-semibold">Recently live</h2>
        {published.length === 0 ? <p className="text-sm text-muted">No live launches yet.</p> : (
          <ul className="space-y-3">
            {published.map((l) => (
              <li key={l.id}>
                <Card>
                  <CardBody className="space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <StartupLogo name={l.name} src={l.logo_url} size={40} />
                      <div className="min-w-0 flex-1"><Link href={`/launches/${l.slug}`} className="font-medium text-ink no-underline hover:underline">{l.name}</Link>{l.is_featured ? <Badge tone="green" className="ml-2">Featured</Badge> : null}<p className="truncate text-sm text-muted">{l.tagline}</p></div>
                      <span className="text-xs text-muted tabular-nums">{l.vote_count} votes · {l.comment_count} comments</span>
                    </div>
                    <PublishedControls launchId={l.id} name={l.name} featured={l.is_featured} />
                  </CardBody>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

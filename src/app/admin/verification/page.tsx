import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { EmptyState } from "@/components/illustrations";
import { NoteActionForm } from "@/components/admin/note-action-form";
import { requireAdmin } from "@/lib/auth/session";
import { listPendingVerifications, listVerifiedStartups } from "@/lib/admin/queries";
import { formatDate, formatDateTime } from "@/lib/format";
import { countryName } from "@/lib/geo";
import { revokeVerificationAction, reviewVerificationAction } from "../actions";

export const metadata: Metadata = { title: "Verification (admin)" };

export default async function AdminVerificationPage() {
  await requireAdmin();
  const [pending, verified] = await Promise.all([listPendingVerifications(), listVerifiedStartups()]);
  return (
    <div className="space-y-8">
      <div><h1 className="text-2xl font-bold">Verification</h1><p className="mt-1 max-w-2xl text-sm text-muted">A badge means you reviewed evidence and found it consistent — it is not an endorsement. Documents are private: links below expire after five minutes. Don’t verify a startup just because it uploaded a logo or has an account.</p></div>
      <section aria-labelledby="pending-v" className="space-y-3">
        <h2 id="pending-v" className="text-lg font-semibold">Pending requests <span className="tabular-nums text-muted">({pending.length})</span></h2>
        {pending.length === 0 ? <EmptyState illustration="saved" title="No requests waiting" /> : (
          <ul className="space-y-4">
            {pending.map((v) => (
              <li key={v.id} className="rounded-lg border border-line p-4">
                <div className="flex flex-wrap items-baseline gap-x-3"><h3 className="font-semibold">{v.startup ? <Link href={`/startups/${v.startup.slug}`}>{v.startup.name}</Link> : "Startup"}</h3><span className="text-xs text-muted">requested <time dateTime={v.created_at}>{formatDateTime(v.created_at)}</time></span></div>
                {v.startup?.country ? <p className="text-sm text-muted">{countryName(v.startup.country)}</p> : null}
                {v.startup?.website_url ? <p className="text-sm"><a href={v.startup.website_url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1">Website<ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /><span className="sr-only"> (opens in a new tab)</span></a></p> : null}
                <p className="mt-2 whitespace-pre-wrap text-sm">{v.notes ?? "No notes."}</p>
                <div className="mt-2">{v.links.length === 0 ? <p className="text-sm text-muted">No documents attached.</p> : <ul className="flex flex-wrap gap-3 text-sm">{v.links.map((l) => <li key={l.url}><a href={l.url} target="_blank" rel="noopener noreferrer">{l.name}<span className="sr-only"> (opens in a new tab)</span></a></li>)}</ul>}</div>
                <div className="mt-3 grid gap-4 border-t border-line pt-3 sm:grid-cols-2">
                  <NoteActionForm action={reviewVerificationAction} fields={{ requestId: v.id, decision: "approve" }} button="Approve and verify" variant="primary" noteLabel="What you checked (shown to the team)" />
                  <NoteActionForm action={reviewVerificationAction} fields={{ requestId: v.id, decision: "reject" }} button="Reject" variant="danger" noteLabel="Why not (required — the team sees this)" required />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby="verified-v" className="space-y-3">
        <h2 id="verified-v" className="text-lg font-semibold">Verified startups <span className="tabular-nums text-muted">({verified.length})</span></h2>
        <ul className="space-y-3">
          {verified.map((s) => (
            <li key={s.id} className="rounded-lg border border-line p-4">
              <p><Link href={`/startups/${s.slug}`} className="font-medium">{s.name}</Link> <span className="text-sm text-muted">verified {s.verified_at ? formatDate(s.verified_at) : ""}</span></p>
              <details className="mt-2"><summary className="cursor-pointer text-sm font-medium text-danger">Withdraw verification…</summary><div className="mt-2 max-w-md"><NoteActionForm action={revokeVerificationAction} fields={{ startupId: s.id }} button="Withdraw verification" variant="danger" noteLabel="Reason (the team sees this)" required /></div></details>
            </li>
          ))}
          {verified.length === 0 ? <li className="text-sm text-muted">None yet.</li> : null}
        </ul>
      </section>
    </div>
  );
}

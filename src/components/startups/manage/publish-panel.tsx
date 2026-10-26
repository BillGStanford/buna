import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ConfirmActionForm } from "@/components/forms/confirm-action-form";
import { setPublicationAction } from "@/app/dashboard/startup/actions";
import { STATUS_LABELS } from "@/lib/startups/constants";
import { publishReadiness } from "@/lib/startups/readiness";
import type { ManagedStartup } from "@/lib/startups/queries";

export function PublishPanel({ startup, canPublish, emailVerified }: { startup: ManagedStartup["startup"]; canPublish: boolean; emailVerified: boolean }) {
  const status = STATUS_LABELS[startup.status] ?? { label: startup.status, tone: "neutral" as const };
  const { ready, missing } = publishReadiness(startup);
  const live = startup.status === "published" || startup.status === "pending_review";
  const blocked = startup.status === "removed" || startup.status === "rejected";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-muted">Status</span>
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>

      {blocked ? (
        <p className="text-sm text-muted">This startup was {startup.status} by the Buna team and can’t be republished. Contact support if you believe this is a mistake.</p>
      ) : (
        <>
          {!live ? (
            <ul className="space-y-2" aria-label="Publishing checklist">
              {[
                ...missing.map((m) => ({ label: m.label, done: false })),
                ...(missing.length === 0 ? [{ label: "Your profile has everything it needs", done: true }] : []),
                { label: "Your email address is confirmed", done: emailVerified },
              ].map((item) => (
                <li key={item.label} className="flex items-center gap-2 text-sm">
                  {item.done ? <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" /> : <Circle className="h-4 w-4 text-muted" aria-hidden="true" />}
                  <span>{item.label}</span><span className="sr-only">{item.done ? "(done)" : "(to do)"}</span>
                </li>
              ))}
            </ul>
          ) : null}

          {missing.length > 0 && !live ? <p className="text-sm text-muted"><Link href={`/dashboard/startup/${startup.id}`} className="font-medium">Complete your profile</Link> to unlock publishing.</p> : null}

          {canPublish ? (
            <div className="flex flex-wrap gap-2 pt-1">
              {live ? (
                <ConfirmActionForm action={setPublicationAction} fields={{ startupId: startup.id, publish: "false" }} trigger="Unpublish"
                  triggerVariant="secondary" size="md" title="Unpublish this startup?"
                  description="Your profile disappears from the directory and search, and its link stops working for visitors. You can publish again at any time."
                  confirmLabel="Unpublish" />
              ) : (
                <ConfirmActionForm action={setPublicationAction} fields={{ startupId: startup.id, publish: "true" }} trigger="Publish startup"
                  triggerVariant="primary" size="md" variant="primary" title="Publish this startup?"
                  description="Your profile becomes visible to everyone and can appear in search engines. Check the preview first if you haven’t."
                  confirmLabel="Publish" />
              )}
              {!ready && !live ? <p className="self-center text-xs text-muted">Publishing will be refused until the checklist is complete.</p> : null}
            </div>
          ) : <p className="text-sm text-muted">Only an owner or admin of this startup can publish or unpublish it.</p>}
        </>
      )}
    </div>
  );
}

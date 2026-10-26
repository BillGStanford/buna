"use client";

import * as React from "react";
import { useActionState } from "react";
import { moderateLaunchAction } from "@/app/admin/launches/actions";
import { TextAreaField } from "@/components/ui/fields";
import { ConfirmActionForm } from "@/components/forms/confirm-action-form";
import { FormMessage, firstError } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { idleState } from "@/lib/types";

function NoteForm({ launchId, action, label, button, required, variant }: { launchId: string; action: "reject" | "remove"; label: string; button: string; required: boolean; variant: "danger" | "secondary" }) {
  const [state, run] = useActionState(moderateLaunchAction, idleState);
  return (
    <form action={run} className="space-y-2" noValidate>
      <input type="hidden" name="launchId" value={launchId} />
      <input type="hidden" name="action" value={action} />
      <FormMessage state={state} />
      <TextAreaField label={label} name="note" rows={2} maxLength={500} required={required} error={firstError(state, "note")} />
      <SubmitButton size="sm" variant={variant} pendingLabel="Saving…">{button}</SubmitButton>
    </form>
  );
}

export function PendingControls({ launchId, name }: { launchId: string; name: string }) {
  return (
    <div className="grid gap-4 border-t border-line pt-4 sm:grid-cols-2">
      <div>
        <ConfirmActionForm action={moderateLaunchAction} fields={{ launchId, action: "approve", note: "" }} trigger={`Approve ${name}`} triggerVariant="primary" variant="primary" size="md"
          title={`Approve ${name}?`} description="It goes live (or is scheduled for its launch date) and the maker is notified." confirmLabel="Approve" />
      </div>
      <NoteForm launchId={launchId} action="reject" label="Ask for changes (the maker sees this note)" button="Send back with note" required variant="danger" />
    </div>
  );
}

export function PublishedControls({ launchId, name, featured }: { launchId: string; name: string; featured: boolean }) {
  return (
    <div className="flex flex-wrap items-start gap-3 border-t border-line pt-4">
      <ConfirmActionForm action={moderateLaunchAction} fields={{ launchId, action: featured ? "unfeature" : "feature", note: "" }} trigger={featured ? "Remove from featured" : "Feature"}
        triggerVariant="secondary" size="sm" variant="primary" title={featured ? `Unfeature ${name}?` : `Feature ${name}?`}
        description={featured ? "It will leave the Featured list." : "It will appear in the Featured list."} confirmLabel={featured ? "Unfeature" : "Feature"} />
      <details className="min-w-0 flex-1">
        <summary className="cursor-pointer text-sm font-medium text-danger">Remove from Buna…</summary>
        <div className="mt-2"><NoteForm launchId={launchId} action="remove" label="Reason (optional, stored in the audit log)" button="Remove launch" required={false} variant="danger" /></div>
      </details>
    </div>
  );
}

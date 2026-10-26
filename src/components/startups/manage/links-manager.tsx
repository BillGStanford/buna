"use client";

import { useActionState } from "react";
import { addLinkAction, deleteLinkAction } from "@/app/dashboard/startup/actions";
import { SelectField, TextField } from "@/components/ui/fields";
import { SubmitButton } from "@/components/forms/submit-button";
import { ConfirmActionForm } from "@/components/forms/confirm-action-form";
import { FormMessage, firstError, valueOf } from "@/components/forms/form-message";
import { LIMITS, LINK_KINDS, linkKindLabel } from "@/lib/startups/constants";
import { idleState } from "@/lib/types";

type Link = { id: string; kind: string; url: string; label: string | null };

export function LinksManager({ startupId, links }: { startupId: string; links: Link[] }) {
  const [state, action] = useActionState(addLinkAction, idleState);
  const cleared = state.status === "success";
  const pick = (k: string) => (state.status === "error" ? valueOf(state, k) : "");
  return (
    <div className="space-y-6">
      {links.length > 0 ? (
        <ul className="divide-y divide-line rounded-lg border border-line">
          {links.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{l.label || linkKindLabel(l.kind)}</p>
                <p className="truncate text-xs text-muted">{l.url}</p>
              </div>
              <ConfirmActionForm action={deleteLinkAction} fields={{ startupId, linkId: l.id }} trigger="Remove"
                title="Remove this link?" description="It will disappear from your public profile." confirmLabel="Remove link" />
            </li>
          ))}
        </ul>
      ) : <p className="text-sm text-muted">No links yet.</p>}

      {links.length >= LIMITS.links ? (
        <p className="text-sm text-muted">You’ve reached the limit of <span className="tabular-nums">{LIMITS.links}</span> links.</p>
      ) : (
        <form key={cleared ? `done-${state.message}` : "form"} action={action} className="space-y-3 rounded-lg border border-line bg-primary-pale p-4" noValidate>
          <h3 className="font-semibold">Add a link</h3>
          <input type="hidden" name="startupId" value={startupId} />
          <FormMessage state={state} />
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectField label="Type" name="kind" defaultValue={pick("kind") || "website"} error={firstError(state, "kind")}>
              {LINK_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
            </SelectField>
            <TextField label="Label (optional)" name="label" maxLength={40} defaultValue={pick("label")} error={firstError(state, "label")} />
          </div>
          <TextField label="Link" name="url" type="url" inputMode="url" placeholder="https://" required defaultValue={pick("url")} error={firstError(state, "url")} />
          <SubmitButton variant="secondary" size="sm" pendingLabel="Adding…">Add link</SubmitButton>
        </form>
      )}
    </div>
  );
}

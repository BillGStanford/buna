"use client";

import * as React from "react";
import { useActionState } from "react";
import { TextAreaField, TextField } from "@/components/ui/fields";
import { FormMessage, firstError } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { useToast } from "@/components/ui/toast";
import { idleState, type ActionState } from "@/lib/types";

/** One admin decision: hidden ids, an optional (or required) note, a button. Success toasts; errors show inline. */
export function NoteActionForm({ action, fields, button, variant = "secondary", size = "sm", noteLabel, noteName = "note", required = false, rows = 2 }: {
  action: (p: ActionState, fd: FormData) => Promise<ActionState>; fields: Record<string, string>; button: string;
  variant?: "primary" | "secondary" | "danger" | "ghost"; size?: "sm" | "md"; noteLabel?: string; noteName?: string; required?: boolean; rows?: number;
}) {
  const [state, run] = useActionState(action, idleState);
  const { toast } = useToast();
  React.useEffect(() => { if (state.status === "success" && state.message) toast(state.message); }, [state, toast]);
  return (
    <form action={run} className="space-y-2" noValidate>
      {Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      {state.status === "error" ? <FormMessage state={state} /> : null}
      {noteLabel ? (rows > 1 ? <TextAreaField label={noteLabel} name={noteName} rows={rows} maxLength={500} required={required} error={firstError(state, noteName)} /> : <TextField label={noteLabel} name={noteName} maxLength={500} required={required} error={firstError(state, noteName)} />) : null}
      <SubmitButton size={size} variant={variant} pendingLabel="Working…">{button}</SubmitButton>
    </form>
  );
}

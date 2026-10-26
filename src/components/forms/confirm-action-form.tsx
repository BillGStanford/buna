"use client";

import * as React from "react";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { SubmitButton } from "@/components/forms/submit-button";
import { FormMessage } from "@/components/forms/form-message";
import { useToast } from "@/components/ui/toast";
import { idleState, type ActionState } from "@/lib/types";

/**
 * A button that opens a confirmation dialog and then runs a server action with hidden fields.
 * Used for every destructive or public-facing change (delete, unpublish, publish).
 */
export function ConfirmActionForm({
  action, fields, trigger, title, description, confirmLabel, variant = "danger", triggerVariant = "ghost", size = "sm",
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  fields: Record<string, string>;
  trigger: React.ReactNode;
  title: string;
  description: string;
  confirmLabel: string;
  variant?: "danger" | "primary";
  triggerVariant?: "ghost" | "secondary" | "primary" | "danger";
  size?: "sm" | "md";
}) {
  const [open, setOpen] = React.useState(false);
  const [state, run] = useActionState(action, idleState);
  const { toast } = useToast();

  React.useEffect(() => {
    if (state.status === "success") {
      setOpen(false);
      if (state.message) toast(state.message);
    }
  }, [state, toast]);

  return (
    <>
      <Button variant={triggerVariant} size={size} onClick={() => setOpen(true)}>{trigger}</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={title} description={description}>
        <form action={run} className="space-y-4">
          {Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
          {state.status === "error" ? <FormMessage state={state} /> : null}
          <div className="flex gap-2">
            <SubmitButton variant={variant} pendingLabel="Working…">{confirmLabel}</SubmitButton>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

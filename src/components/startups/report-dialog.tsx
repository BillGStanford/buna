"use client";

import * as React from "react";
import Link from "next/link";
import { useActionState } from "react";
import { Flag } from "lucide-react";
import { reportContentAction } from "@/app/actions/reports";
import { Button, buttonStyles } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { SelectField, TextAreaField } from "@/components/ui/fields";
import { SubmitButton } from "@/components/forms/submit-button";
import { FormMessage, firstError } from "@/components/forms/form-message";
import { REPORT_REASONS } from "@/lib/startups/constants";
import { idleState } from "@/lib/types";

export function ReportDialog({ targetType, targetId, targetName, signedIn, loginHref, compact = false }: {
  targetType: "startup" | "launch" | "comment" | "user" | "opportunity" | "investor"; targetId: string; targetName: string; signedIn: boolean; loginHref: string; compact?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [state, action] = useActionState(reportContentAction, idleState);

  if (!signedIn) {
    return <Link href={loginHref} className={buttonStyles("ghost", "sm")}><Flag className="h-4 w-4" aria-hidden="true" />{compact ? "Report" : "Sign in to report"}</Link>;
  }
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}><Flag className="h-4 w-4" aria-hidden="true" />Report<span className="sr-only"> {targetName}</span></Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={`Report ${targetName}`}
        description="Tell us what’s wrong. Reports go to the Buna team; the startup isn’t told who reported it.">
        {state.status === "success" ? (
          <div className="space-y-4">
            <FormMessage state={state} />
            <Button variant="secondary" onClick={() => setOpen(false)}>Close</Button>
          </div>
        ) : (
          <form action={action} className="space-y-4" noValidate>
            <input type="hidden" name="targetType" value={targetType} />
            <input type="hidden" name="targetId" value={targetId} />
            <FormMessage state={state} />
            <SelectField label="Reason" name="reason" required defaultValue="" error={firstError(state, "reason")}>
              <option value="" disabled>Choose a reason</option>
              {REPORT_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </SelectField>
            <TextAreaField label="Details (optional)" name="details" rows={3} maxLength={1000} error={firstError(state, "details")} />
            <div className="flex gap-2">
              <SubmitButton variant="danger" pendingLabel="Sending…">Send report</SubmitButton>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            </div>
          </form>
        )}
      </Dialog>
    </>
  );
}

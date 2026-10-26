"use client";

import * as React from "react";
import { useActionState } from "react";
import { retryInquiryEmailAction, setInquiryStatusAction } from "@/app/dashboard/inquiries/actions";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/forms/submit-button";
import { useToast } from "@/components/ui/toast";
import { idleState } from "@/lib/types";

function StatusButton({ inquiryId, status, label, current }: { inquiryId: string; status: string; label: string; current: string }) {
  const [state, action] = useActionState(setInquiryStatusAction, idleState);
  const { toast } = useToast();
  React.useEffect(() => { if (state.status !== "idle" && state.message) toast(state.message, state.status === "error" ? "error" : "success"); }, [state, toast]);
  return (
    <form action={action}>
      <input type="hidden" name="inquiryId" value={inquiryId} /><input type="hidden" name="status" value={status} />
      <SubmitButton size="sm" variant={current === status ? "primary" : "secondary"} aria-pressed={current === status}>{label}</SubmitButton>
    </form>
  );
}

export function InquiryActions({ inquiryId, status, canRetry }: { inquiryId: string; status: string; canRetry: boolean }) {
  const [retry, retryAction] = useActionState(retryInquiryEmailAction, idleState);
  const { toast } = useToast();
  React.useEffect(() => { if (retry.status !== "idle" && retry.message) toast(retry.message, retry.status === "error" ? "error" : "success"); }, [retry, toast]);
  return (
    <div className="space-y-4">
      <div role="group" aria-label="Set status" className="flex flex-wrap gap-2">
        {[["read", "Mark read"], ["replied", "Mark replied"], ["archived", "Archive"], ["spam", "Mark as spam"], ["new", "Mark unread"]].map(([v, l]) => <StatusButton key={v} inquiryId={inquiryId} status={v as string} label={l as string} current={status} />)}
      </div>
      {canRetry ? (
        <form action={retryAction} className="flex items-center gap-3">
          <input type="hidden" name="inquiryId" value={inquiryId} />
          <SubmitButton size="sm" variant="secondary" pendingLabel="Sending…">Retry notification email</SubmitButton>
        </form>
      ) : null}
      {status === "spam" ? <Button variant="ghost" size="sm" disabled>Spam is hidden from your default view</Button> : null}
    </div>
  );
}

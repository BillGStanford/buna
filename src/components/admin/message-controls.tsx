"use client";

import * as React from "react";
import { useActionState } from "react";
import { setMessageStatusAction } from "@/app/admin/messages/actions";
import { SubmitButton } from "@/components/forms/submit-button";
import { useToast } from "@/components/ui/toast";
import { idleState } from "@/lib/types";

export function MessageControls({ messageId, status }: { messageId: string; status: string }) {
  return <div role="group" aria-label="Set status" className="flex flex-wrap gap-2">{["handled", "spam", "new"].filter((s) => s !== status).map((s) => <One key={s} messageId={messageId} status={s} />)}</div>;
}
function One({ messageId, status }: { messageId: string; status: string }) {
  const [state, action] = useActionState(setMessageStatusAction, idleState);
  const { toast } = useToast();
  React.useEffect(() => { if (state.status !== "idle" && state.message) toast(state.message, state.status === "error" ? "error" : "success"); }, [state, toast]);
  return <form action={action}><input type="hidden" name="messageId" value={messageId} /><input type="hidden" name="status" value={status} /><SubmitButton size="sm" variant="secondary">{status === "new" ? "Mark unread" : status === "handled" ? "Mark handled" : "Mark spam"}</SubmitButton></form>;
}

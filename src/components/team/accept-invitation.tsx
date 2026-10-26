"use client";

import { useActionState } from "react";
import { acceptInvitationAction } from "@/app/invite/[token]/actions";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { idleState } from "@/lib/types";

export function AcceptInvitation({ token }: { token: string }) {
  const [state, action] = useActionState(acceptInvitationAction, idleState);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="token" value={token} />
      <FormMessage state={state} />
      <SubmitButton size="lg" pendingLabel="Joining…">Accept invitation</SubmitButton>
    </form>
  );
}

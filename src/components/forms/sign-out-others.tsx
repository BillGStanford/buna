"use client";

import { useActionState } from "react";
import { signOutOtherSessionsAction } from "@/app/dashboard/security/actions";
import { SubmitButton } from "@/components/forms/submit-button";
import { FormMessage } from "@/components/forms/form-message";
import { idleState } from "@/lib/types";

export function SignOutOthers() {
  const [state, action] = useActionState(signOutOtherSessionsAction, idleState);
  return (
    <form action={action} className="space-y-3">
      <FormMessage state={state} />
      <SubmitButton variant="secondary" pendingLabel="Signing out…">Sign out other devices</SubmitButton>
    </form>
  );
}

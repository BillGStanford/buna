"use client";

import * as React from "react";
import { useActionState } from "react";
import { Ban, ShieldCheck } from "lucide-react";
import { toggleMemberBlockAction } from "@/app/actions/blocks";
import { SubmitButton } from "@/components/forms/submit-button";
import { useToast } from "@/components/ui/toast";
import { idleState } from "@/lib/types";

export function BlockButton({ targetId, targetName, blocked }: { targetId: string; targetName: string; blocked: boolean }) {
  const [state, action] = useActionState(toggleMemberBlockAction, idleState);
  const [isBlocked, setIsBlocked] = React.useState(blocked);
  const { toast } = useToast();
  const last = React.useRef<string | undefined>(undefined);
  React.useEffect(() => { setIsBlocked(blocked); }, [blocked]);
  React.useEffect(() => {
    if (state.status === "success" && state.message && state.message !== last.current) {
      last.current = state.message;
      setIsBlocked((value) => !value);
      toast(state.message, "success");
    }
    if (state.status === "error" && state.message && state.message !== last.current) {
      last.current = state.message;
      toast(state.message, "error");
    }
  }, [state, toast]);

  return (
    <form action={action} className="inline-flex">
      <input type="hidden" name="targetId" value={targetId} />
      <input type="hidden" name="intent" value={isBlocked ? "unblock" : "block"} />
      <SubmitButton variant="ghost" size="sm" pendingLabel="Saving…" aria-label={isBlocked ? `Unblock ${targetName}` : `Block ${targetName}`}>
        {isBlocked ? <ShieldCheck className="h-4 w-4" aria-hidden="true" /> : <Ban className="h-4 w-4" aria-hidden="true" />}
        {isBlocked ? "Unblock" : "Block"}
      </SubmitButton>
    </form>
  );
}

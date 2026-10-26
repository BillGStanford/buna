"use client";

import * as React from "react";
import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { ChevronUp } from "lucide-react";
import { voteAction } from "@/app/launches/actions";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { idleState } from "@/lib/types";

const box = "flex h-16 w-14 shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg border text-sm font-semibold tabular-nums transition-colors";

/** Votes are final: once cast the button stays "voted". Counts come from the server after the vote is stored. */
export function VoteButton({ launchId, name, count, voted, signedIn, loginHref, disabledReason }: {
  launchId: string; name: string; count: number; voted: boolean; signedIn: boolean; loginHref: string; disabledReason?: string;
}) {
  const [state, action] = useActionState(voteAction, idleState);
  const { toast } = useToast();
  const lastMessage = React.useRef<string | undefined>(undefined);

  React.useEffect(() => {
    if (state.status !== "idle" && state.message && state.message !== lastMessage.current) {
      lastMessage.current = state.message;
      toast(state.message, state.status === "error" ? "error" : "success");
    }
  }, [state, toast]);

  const isVoted = voted || state.status === "success";

  if (disabledReason) {
    return (
      <div title={disabledReason} className={cn(box, "border-line bg-primary-pale text-muted")}>
        <ChevronUp className="h-4 w-4" aria-hidden="true" /><span>{count}</span><span className="sr-only">{disabledReason}</span>
      </div>
    );
  }
  if (!signedIn) {
    return (
      <Link href={loginHref} aria-label={`Sign in to vote for ${name}. ${count} votes`}
        className={cn(box, "border-line bg-surface text-ink no-underline hover:border-primary hover:bg-primary-mint")}>
        <ChevronUp className="h-4 w-4 text-primary" aria-hidden="true" /><span>{count}</span>
      </Link>
    );
  }
  return (
    <form action={action}>
      <input type="hidden" name="launchId" value={launchId} />
      <VoteSubmit name={name} count={count} voted={isVoted} />
    </form>
  );
}

function VoteSubmit({ name, count, voted }: { name: string; count: number; voted: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={voted || pending} aria-pressed={voted}
      aria-label={voted ? `You voted for ${name}. ${count} votes` : `Vote for ${name}. ${count} votes`}
      className={cn(box, voted ? "border-primary bg-primary text-white" : "border-line bg-surface text-ink hover:border-primary hover:bg-primary-mint", pending && "opacity-60")}>
      <ChevronUp className={cn("h-4 w-4", voted ? "text-white" : "text-primary")} aria-hidden="true" />
      <span>{count}</span>
    </button>
  );
}

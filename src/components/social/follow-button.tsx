"use client";

import * as React from "react";
import Link from "next/link";
import { useActionState } from "react";
import { Check, UserPlus } from "lucide-react";
import { toggleFollowAction } from "@/app/actions/follow";
import { buttonStyles } from "@/components/ui/button";
import { SubmitButton } from "@/components/forms/submit-button";
import { useToast } from "@/components/ui/toast";
import { idleState } from "@/lib/types";

export function FollowButton({ targetType, targetId, name, following, count, signedIn, loginHref, returnTo }: {
  targetType: "startup" | "user"; targetId: string; name: string; following: boolean; count: number; signedIn: boolean; loginHref: string; returnTo: string;
}) {
  const [state, action] = useActionState(toggleFollowAction, idleState);
  const { toast } = useToast();
  const last = React.useRef<string | undefined>(undefined);
  React.useEffect(() => {
    if (state.status === "error" && state.message && state.message !== last.current) { last.current = state.message; toast(state.message, "error"); }
  }, [state, toast]);

  const label = `${count} ${count === 1 ? "follower" : "followers"}`;
  if (!signedIn) {
    return (
      <span className="inline-flex items-center gap-2">
        <Link href={loginHref} className={buttonStyles("secondary", "sm")}><UserPlus className="h-4 w-4" aria-hidden="true" />Follow<span className="sr-only"> {name}</span></Link>
        <span className="text-sm text-muted tabular-nums">{label}</span>
      </span>
    );
  }
  return (
    <form action={action} className="inline-flex items-center gap-2">
      <input type="hidden" name="targetType" value={targetType} />
      <input type="hidden" name="targetId" value={targetId} />
      <input type="hidden" name="intent" value={following ? "unfollow" : "follow"} />
      <input type="hidden" name="returnTo" value={returnTo} />
      {following ? (
        <SubmitButton variant="secondary" size="sm" aria-label={`Unfollow ${name}`}><Check className="h-4 w-4" aria-hidden="true" />Following</SubmitButton>
      ) : (
        <SubmitButton variant="secondary" size="sm" aria-label={`Follow ${name}`}><UserPlus className="h-4 w-4" aria-hidden="true" />Follow</SubmitButton>
      )}
      <span className="text-sm text-muted tabular-nums" aria-live="polite">{label}</span>
    </form>
  );
}


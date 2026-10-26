"use client";

import * as React from "react";
import Link from "next/link";
import { useActionState } from "react";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { toggleSaveOpportunityAction } from "@/app/opportunities/actions";
import { buttonStyles } from "@/components/ui/button";
import { SubmitButton } from "@/components/forms/submit-button";
import { useToast } from "@/components/ui/toast";
import { idleState } from "@/lib/types";

export function SaveOpportunityButton({ opportunityId, title, saved, signedIn, loginHref, returnTo, size = "sm" }: {
  opportunityId: string; title: string; saved: boolean; signedIn: boolean; loginHref: string; returnTo: string; size?: "sm" | "md";
}) {
  const [state, action] = useActionState(toggleSaveOpportunityAction, idleState);
  const { toast } = useToast();
  const last = React.useRef<string | undefined>(undefined);
  React.useEffect(() => {
    if (state.status !== "idle" && state.message && state.message !== last.current) { last.current = state.message; toast(state.message, state.status === "error" ? "error" : "success"); }
  }, [state, toast]);
  if (!signedIn) return <Link href={loginHref} className={buttonStyles("secondary", size)}><Bookmark className="h-4 w-4" aria-hidden="true" />Save<span className="sr-only"> {title}</span></Link>;
  return (
    <form action={action}>
      <input type="hidden" name="opportunityId" value={opportunityId} />
      <input type="hidden" name="intent" value={saved ? "unsave" : "save"} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <SubmitButton variant="secondary" size={size} aria-pressed={saved} aria-label={saved ? `Remove ${title} from saved` : `Save ${title}`}>
        {saved ? <BookmarkCheck className="h-4 w-4 text-primary" aria-hidden="true" /> : <Bookmark className="h-4 w-4" aria-hidden="true" />}{saved ? "Saved" : "Save"}
      </SubmitButton>
    </form>
  );
}

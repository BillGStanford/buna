"use client";

import * as React from "react";
import { useActionState } from "react";
import { markCheckedAction, setOpportunityStatusAction } from "@/app/admin/opportunities/actions";
import { SubmitButton } from "@/components/forms/submit-button";
import { useToast } from "@/components/ui/toast";
import { idleState } from "@/lib/types";

function Mini({ action, fields, label }: { action: typeof setOpportunityStatusAction; fields: Record<string, string>; label: string }) {
  const [state, run] = useActionState(action, idleState);
  const { toast } = useToast();
  React.useEffect(() => { if (state.status !== "idle" && state.message) toast(state.message, state.status === "error" ? "error" : "success"); }, [state, toast]);
  return <form action={run}>{Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}<SubmitButton size="sm" variant="ghost">{label}</SubmitButton></form>;
}

export function OpportunityRowActions({ opportunityId, status }: { opportunityId: string; status: string }) {
  return (
    <div className="flex flex-wrap gap-1">
      <Mini action={markCheckedAction} fields={{ opportunityId }} label="Checked today" />
      {status !== "published" ? <Mini action={setOpportunityStatusAction} fields={{ opportunityId, status: "published" }} label="Publish" /> : null}
      {status === "published" ? <Mini action={setOpportunityStatusAction} fields={{ opportunityId, status: "expired" }} label="Mark expired" /> : null}
      {status !== "archived" ? <Mini action={setOpportunityStatusAction} fields={{ opportunityId, status: "archived" }} label="Archive" /> : null}
    </div>
  );
}

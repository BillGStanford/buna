"use client";

import { useActionState } from "react";
import { savePreferencesAction } from "@/app/dashboard/notifications/actions";
import { CheckboxField } from "@/components/ui/fields";
import { SubmitButton } from "@/components/forms/submit-button";
import { FormMessage } from "@/components/forms/form-message";
import { idleState } from "@/lib/types";
import type { NotificationPrefs } from "@/lib/notifications/queries";

export function PreferencesForm({ prefs, emailConfigured }: { prefs: NotificationPrefs; emailConfigured: boolean }) {
  const [state, action] = useActionState(savePreferencesAction, idleState);
  return (
    <form action={action} className="space-y-4">
      <FormMessage state={state} />
      {!emailConfigured ? <p className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">Email delivery isn’t set up on this site yet, so these only control what is queued. You’ll still see everything here.</p> : null}
      <CheckboxField name="emailComments" label="Comments on my launches" defaultChecked={prefs.email_comments} />
      <CheckboxField name="emailReplies" label="Replies to my comments" defaultChecked={prefs.email_replies} />
      <CheckboxField name="emailModeration" label="Decisions on my launches" hint="When a moderator approves a launch or asks for changes." defaultChecked={prefs.email_moderation} />
      <CheckboxField name="emailReferrals" label="Referral signups and reward milestones" defaultChecked={prefs.email_referrals} />
      <p className="text-xs text-muted">Notifications always appear in the app. Security alerts (like a password change) are in-app only.</p>
      <SubmitButton variant="secondary" pendingLabel="Saving…">Save preferences</SubmitButton>
    </form>
  );
}

"use client";

import { useActionState } from "react";
import { sendInquiryAction } from "@/app/actions/inquiry";
import { SelectField, TextAreaField, TextField } from "@/components/ui/fields";
import { FormMessage, firstError, valueOf } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { INQUIRY_CATEGORIES } from "@/lib/validation/network";
import { idleState } from "@/lib/types";

export function InquiryForm({ startupId, startupName, defaultName, defaultEmail }: { startupId: string; startupName: string; defaultName?: string; defaultEmail?: string }) {
  const [state, action] = useActionState(sendInquiryAction, idleState);
  if (state.status === "success") return <div className="space-y-2"><FormMessage state={state} /><p className="text-sm text-muted">The team usually replies by email. You can close this and keep browsing.</p></div>;
  const err = state.status === "error";
  const pick = (k: string, fallback: string) => (err ? valueOf(state, k, fallback) : fallback);
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="startupId" value={startupId} />
      {/* honeypot: hidden from people and assistive technology; bots tend to fill every field */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden"><label>Website<input type="text" name="website" tabIndex={-1} autoComplete="off" /></label></div>
      <FormMessage state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Your name" name="name" required autoComplete="name" defaultValue={pick("name", defaultName ?? "")} error={firstError(state, "name")} />
        <TextField label="Your email" name="email" type="email" required autoComplete="email" hint={`${startupName} will reply to this address.`} defaultValue={pick("email", defaultEmail ?? "")} error={firstError(state, "email")} />
      </div>
      <SelectField label="Topic" name="category" defaultValue={pick("category", "general")} error={firstError(state, "category")}>{INQUIRY_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</SelectField>
      <TextField label="Subject" name="subject" required maxLength={150} defaultValue={pick("subject", "")} error={firstError(state, "subject")} />
      <TextAreaField label="Message" name="message" required rows={5} maxLength={4000} defaultValue={pick("message", "")} error={firstError(state, "message")} />
      <p className="text-xs text-muted">Your message and email address go to the startup’s team. Buna doesn’t share them with anyone else.</p>
      <SubmitButton pendingLabel="Sending…">Send message</SubmitButton>
    </form>
  );
}

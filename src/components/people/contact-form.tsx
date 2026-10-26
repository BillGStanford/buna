"use client";

import { useActionState } from "react";
import { sendContactMessageAction } from "@/app/contact/actions";
import { SelectField, TextAreaField, TextField } from "@/components/ui/fields";
import { FormMessage, firstError, valueOf } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { CONTACT_TOPICS } from "@/lib/validation/network";
import { idleState } from "@/lib/types";

export function ContactForm({ defaultName, defaultEmail }: { defaultName?: string; defaultEmail?: string }) {
  const [state, action] = useActionState(sendContactMessageAction, idleState);
  if (state.status === "success") return <FormMessage state={state} />;
  const err = state.status === "error";
  const pick = (k: string, fallback: string) => (err ? valueOf(state, k, fallback) : fallback);
  return (
    <form action={action} className="space-y-4" noValidate>
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden"><label>Website<input type="text" name="website" tabIndex={-1} autoComplete="off" /></label></div>
      <FormMessage state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Your name" name="name" required autoComplete="name" defaultValue={pick("name", defaultName ?? "")} error={firstError(state, "name")} />
        <TextField label="Your email" name="email" type="email" required autoComplete="email" defaultValue={pick("email", defaultEmail ?? "")} error={firstError(state, "email")} />
      </div>
      <SelectField label="Topic" name="topic" defaultValue={pick("topic", "general")} error={firstError(state, "topic")}>{CONTACT_TOPICS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</SelectField>
      <TextAreaField label="Message" name="message" required rows={6} maxLength={4000} defaultValue={pick("message", "")} error={firstError(state, "message")} />
      <SubmitButton pendingLabel="Sending…">Send message</SubmitButton>
    </form>
  );
}

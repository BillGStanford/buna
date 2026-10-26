"use client";

import * as React from "react";
import Link from "next/link";
import { useActionState } from "react";
import { signInAction } from "@/app/(auth)/actions";
import { TextField } from "@/components/ui/fields";
import { SubmitButton } from "@/components/forms/submit-button";
import { FormMessage, firstError, valueOf } from "@/components/forms/form-message";
import { idleState } from "@/lib/types";
import { ResendVerification } from "./resend-verification";

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState(signInAction, idleState);
  return (
    <div className="space-y-5">
      <form action={action} className="space-y-4" noValidate>
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <FormMessage state={state} />
        <TextField label="Email" name="email" type="email" autoComplete="email" required
          defaultValue={valueOf(state, "email")} error={firstError(state, "email")} />
        <TextField label="Password" name="password" type="password" autoComplete="current-password" required
          error={firstError(state, "password")} />
        <div className="flex justify-end">
          <Link href="/forgot-password" className="text-sm font-medium">Forgot your password?</Link>
        </div>
        <SubmitButton className="w-full" pendingLabel="Signing in…">Sign in</SubmitButton>
      </form>
      {state.hint === "needs_verification" ? <ResendVerification email={valueOf(state, "email")} /> : null}
    </div>
  );
}

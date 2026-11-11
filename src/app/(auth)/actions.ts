"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSiteUrl, isSupabaseConfigured } from "@/lib/env";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { createLogger } from "@/lib/logger";
import { safeRedirectPath } from "@/lib/utils";
import { TERMS_VERSION } from "@/config/site";
import { flattenErrors, formDataToObject } from "@/lib/validation/common";
import { forgotPasswordSchema, resetPasswordSchema, signInSchema, signUpSchema } from "@/lib/validation/auth";
import type { ActionState } from "@/lib/types";

const log = createLogger("auth");

const NOT_CONFIGURED: ActionState = {
  status: "error",
  message: "Accounts aren’t available yet because this site isn’t connected to its database. If you run this site, follow the setup steps in the README.",
};
const TOO_MANY: ActionState = { status: "error", message: "Too many attempts. Please wait a few minutes and try again." };
const GENERIC: ActionState = { status: "error", message: "Something went wrong on our side. Please try again." };

function isRateLimitError(err: { status?: number; code?: string }) {
  return err.status === 429 || err.code === "over_email_send_rate_limit" || err.code === "over_request_rate_limit";
}

export async function signUpAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const raw = formDataToObject(formData);
  const values = {
    displayName: String(raw.displayName ?? ""), email: String(raw.email ?? ""),
    country: String(raw.country ?? ""), founderStatus: String(raw.founderStatus ?? ""),
    startupIntent: String(raw.startupIntent ?? ""), referralCode: String(raw.referralCode ?? "").trim().toUpperCase(),
  };
  const parsed = signUpSchema.safeParse(raw);
  if (!parsed.success) return { status: "error", fieldErrors: flattenErrors(parsed.error), values };
  if (!isSupabaseConfigured()) return { ...NOT_CONFIGURED, values };

  const { displayName, email, password, country, founderStatus, startupIntent, referralCode } = parsed.data;
  const ip = await clientIp();
  if (!(await rateLimit(`signup:ip:${ip}`, 8, 3600)) || !(await rateLimit(`signup:email:${email}`, 3, 3600))) {
    return { ...TOO_MANY, values };
  }

  const supabase = await createClient();
  if (referralCode) {
    const { data: codeExists, error: referralLookupError } = await supabase.rpc("referral_code_exists", { p_code: referralCode });
    if (referralLookupError) {
      log.error("referral code validation failed", referralLookupError);
      return { ...GENERIC, values };
    }
    if (!codeExists) return { status: "error", fieldErrors: { referralCode: ["That referral code is not valid. Check the link or code and try again."] }, values };
  }
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: displayName,
        country,
        founder_status: founderStatus,
        startup_intent: startupIntent,
        terms_version: TERMS_VERSION,
        ...(referralCode ? { referral_code: referralCode } : {}),
      },
      emailRedirectTo: `${getSiteUrl()}/auth/confirm?next=/onboarding`,
    },
  });

  if (error) {
    if (error.message?.toLowerCase().includes("invalid_referral_code")) {
      return { status: "error", fieldErrors: { referralCode: ["That referral code is not valid. Check the link or code and try again."] }, values };
    }
    if (error.code === "weak_password") {
      return { status: "error", fieldErrors: { password: ["Choose a stronger password — avoid common words and patterns."] }, values };
    }
    if (isRateLimitError(error)) return { ...TOO_MANY, values };
    log.error("signUp failed", error, { code: error.code });
    return { ...GENERIC, values };
  }

  // With email confirmation enabled, Supabase returns no session until the member follows the
  // confirmation link. If confirmation is disabled, a session is returned and the dashboard
  // continues the member's onboarding flow.
  if (data.session) redirect("/dashboard");
  // For an already-registered email Supabase returns an obfuscated user; we show the same page so
  // the form can't be used to discover which emails have accounts.
  redirect(`/verify-email?email=${encodeURIComponent(email)}`);
}

export async function signInAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const raw = formDataToObject(formData);
  const values = { email: String(raw.email ?? "") };
  const next = safeRedirectPath(String(raw.next ?? ""), "/dashboard");
  const parsed = signInSchema.safeParse(raw);
  if (!parsed.success) return { status: "error", fieldErrors: flattenErrors(parsed.error), values };
  if (!isSupabaseConfigured()) return { ...NOT_CONFIGURED, values };

  const { email, password } = parsed.data;
  const ip = await clientIp();
  if (!(await rateLimit(`signin:ip:${ip}`, 30, 900)) || !(await rateLimit(`signin:email:${email}`, 8, 900))) {
    return { ...TOO_MANY, values };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (error.code === "email_not_confirmed") {
      return { status: "error", message: "Confirm your email address first — check your inbox for the link we sent.", hint: "needs_verification", values };
    }
    if (isRateLimitError(error)) return { ...TOO_MANY, values };
    if (error.code === "invalid_credentials" || error.status === 400) {
      return { status: "error", message: "That email and password don’t match. Check them and try again.", values };
    }
    log.error("signIn failed", error, { code: error.code });
    return { ...GENERIC, values };
  }
  redirect(next);
}

export async function signOutAction(): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/");
}

export async function forgotPasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const raw = formDataToObject(formData);
  const values = { email: String(raw.email ?? "") };
  const parsed = forgotPasswordSchema.safeParse(raw);
  if (!parsed.success) return { status: "error", fieldErrors: flattenErrors(parsed.error), values };
  if (!isSupabaseConfigured()) return { ...NOT_CONFIGURED, values };

  const { email } = parsed.data;
  const ip = await clientIp();
  if (!(await rateLimit(`reset:ip:${ip}`, 10, 3600)) || !(await rateLimit(`reset:email:${email}`, 3, 3600))) {
    return { ...TOO_MANY, values };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${getSiteUrl()}/auth/confirm?next=/reset-password`,
  });
  if (error && isRateLimitError(error)) return { ...TOO_MANY, values };
  if (error) log.error("resetPasswordForEmail failed", error, { code: error.code });

  // Same answer whether or not the address has an account (prevents account enumeration).
  return { status: "success", message: "If an account exists for that email, a reset link is on its way. It expires after an hour.", values: {} };
}

export async function resetPasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = resetPasswordSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return { status: "error", fieldErrors: flattenErrors(parsed.error) };
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    return { status: "error", message: "This reset link has expired or was already used. Request a new one." };
  }
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === "same_password") return { status: "error", fieldErrors: { password: ["Choose a password you haven’t used before."] } };
    if (error.code === "weak_password") return { status: "error", fieldErrors: { password: ["Choose a stronger password — avoid common words and patterns."] } };
    log.error("updateUser(password) failed", error, { code: error.code });
    return GENERIC;
  }
  redirect("/dashboard?notice=password_updated");
}

export async function resendVerificationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = forgotPasswordSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { status: "error", message: "Enter the email address you signed up with." };
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;

  const { email } = parsed.data;
  const ip = await clientIp();
  if (!(await rateLimit(`resend:ip:${ip}`, 10, 3600)) || !(await rateLimit(`resend:email:${email}`, 3, 3600))) return TOO_MANY;

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: `${getSiteUrl()}/auth/confirm?next=/onboarding` },
  });
  if (error && isRateLimitError(error)) return TOO_MANY;
  if (error) log.error("resend verification failed", error, { code: error.code });
  return { status: "success", message: "If that address is waiting for confirmation, we’ve sent a new link." };
}

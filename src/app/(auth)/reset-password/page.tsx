import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { Alert } from "@/components/ui/alert";
import { getUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage() {
  // The recovery link signs the user in (via /auth/confirm); without that session there is nothing to reset.
  const user = await getUser();
  if (!user) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">This link has expired</h1>
        <Alert tone="warning">Reset links work once and expire after an hour.</Alert>
        <Link href="/forgot-password" className="inline-block text-sm font-medium">Request a new reset link</Link>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Choose a new password</h1>
        <p className="mt-1 text-sm text-muted">Pick something you don’t use anywhere else.</p>
      </div>
      <ResetPasswordForm />
    </div>
  );
}

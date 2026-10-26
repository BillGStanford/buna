import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Reset your password</h1>
        <p className="mt-1 text-sm text-muted">Enter your email and we’ll send you a link to choose a new one.</p>
      </div>
      <ForgotPasswordForm />
      <p className="text-center text-sm text-muted"><Link href="/login" className="font-medium">Back to sign in</Link></p>
    </div>
  );
}

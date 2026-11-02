import type { Metadata } from "next";
import Link from "next/link";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = { title: "Create your account" };

export default function SignupPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Create your Buna account</h1>
        <p className="mt-1 text-sm text-muted">Create your account, answer two quick questions so we can make Buna relevant to you, and confirm your email.</p>
      </div>
      <SignupForm />
      <p className="text-center text-sm text-muted">
        Already have an account? <Link href="/login" className="font-medium">Sign in</Link>
      </p>
    </div>
  );
}

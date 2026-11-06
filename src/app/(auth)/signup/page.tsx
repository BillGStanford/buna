import type { Metadata } from "next";
import Link from "next/link";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = { title: "Create your account" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const referralCode = (params.ref ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Create your Buna account</h1>
        <p className="mt-1 text-sm text-muted">Create your account. Then we’ll guide you through two quick steps to personalize Buna.</p>
      </div>
      <SignupForm referralCode={referralCode} />
      <p className="text-center text-sm text-muted">
        Already have an account? <Link href="/login" className="font-medium">Sign in</Link>
      </p>
    </div>
  );
}

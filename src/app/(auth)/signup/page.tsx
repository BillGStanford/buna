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
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Your place in the ecosystem starts here</p>
        <h1 className="mt-2 text-2xl font-bold">Join the people building Africa’s next chapter.</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">Create your account, verify your email and step into a guided setup for founders, businesses and investors. Your progress is saved as you go.</p>
      </div>
      <SignupForm referralCode={referralCode} />
      <p className="text-center text-sm text-muted">
        Already have an account? <Link href="/login" className="font-medium">Sign in</Link>
      </p>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { ResendVerification } from "@/components/auth/resend-verification";

export const metadata: Metadata = { title: "Confirm your email" };

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { email } = await searchParams;
  const shown = email && email.length <= 254 ? email : null;
  return (
    <div className="space-y-6">
      <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-primary-mint text-primary-deep">
        <MailCheck className="h-5 w-5" aria-hidden="true" />
      </span>
      <div>
        <h1 className="text-2xl font-bold">Check your email</h1>
        <p className="mt-2 text-sm text-muted">
          {shown ? <>We sent a confirmation link to <strong className="text-ink">{shown}</strong>. </> : "We sent you a confirmation link. "}
          Open it to activate your account — you’ll land straight in setup.
        </p>
      </div>
      {shown ? <ResendVerification email={shown} /> : null}
      <p className="text-sm text-muted">
        Wrong address? <Link href="/signup" className="font-medium">Start again</Link>
      </p>
    </div>
  );
}

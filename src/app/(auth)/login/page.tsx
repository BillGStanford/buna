import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";
import { Alert } from "@/components/ui/alert";
import { safeRedirectPath } from "@/lib/utils";

export const metadata: Metadata = { title: "Sign in" };

const NOTICES: Record<string, { tone: "info" | "error" | "warning"; text: string }> = {
  not_configured: { tone: "warning", text: "This site isn’t connected to its database yet, so sign-in is unavailable." },
  link_expired: { tone: "error", text: "That link has expired or was already used. Request a new one and try again." },
  invalid_link: { tone: "error", text: "That link isn’t valid. Request a new one and try again." },
  profile_missing: { tone: "error", text: "We couldn’t load your account. Sign in again, and contact support if it keeps happening." },
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const next = sp.next ? safeRedirectPath(sp.next, "") : "";
  const notice = sp.error ? NOTICES[sp.error] : null;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Sign in to Buna</h1>
        <p className="mt-1 text-sm text-muted">{next ? "Sign in to continue." : "Welcome back."}</p>
      </div>
      {notice ? <Alert tone={notice.tone}>{notice.text}</Alert> : null}
      <LoginForm next={next || undefined} />
      <p className="text-center text-sm text-muted">
        New to Buna? <Link href="/signup" className="font-medium">Create an account</Link>
      </p>
    </div>
  );
}

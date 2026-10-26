import type { Metadata } from "next";
import Link from "next/link";
import { Users } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { buttonStyles } from "@/components/ui/button";
import { AcceptInvitation } from "@/components/team/accept-invitation";
import { getProfile, getUser } from "@/lib/auth/session";
import { sha256Hex } from "@/lib/crypto";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { inviteTokenSchema } from "@/lib/validation/network";

export const metadata: Metadata = { title: "Team invitation", robots: { index: false, follow: false } };
type Preview = { startup_name: string; role: string; status: string; expired: boolean; email_hint: string };
const ROLE: Record<string, string> = { admin: "an admin", editor: "an editor", viewer: "a viewer" };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const valid = inviteTokenSchema.safeParse(token).success;
  let preview: Preview | null = null;
  if (valid && isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data } = await supabase.rpc("get_invitation_preview", { p_token_hash: sha256Hex(token) });
    preview = ((data ?? []) as Preview[])[0] ?? null;
  }
  const user = await getUser();
  const profile = user ? await getProfile() : null;
  const here = `/invite/${token}`;

  return (
    <div className="container-page flex min-h-[55vh] max-w-xl flex-col justify-center gap-5 py-12">
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary-mint text-primary-deep"><Users className="h-6 w-6" aria-hidden="true" /></span>
      {!preview ? (
        <>
          <h1 className="text-3xl font-bold">This invitation isn’t valid</h1>
          <p className="text-muted">The link may have a typo or may have been withdrawn. Ask the person who invited you to send a new one.</p>
        </>
      ) : preview.status !== "pending" || preview.expired ? (
        <>
          <h1 className="text-3xl font-bold">{preview.status === "accepted" ? "This invitation was already used" : preview.status === "revoked" ? "This invitation was withdrawn" : "This invitation has expired"}</h1>
          <p className="text-muted">Ask the {preview.startup_name} team to send you a new invitation.</p>
        </>
      ) : (
        <>
          <h1 className="text-3xl font-bold">Join {preview.startup_name} on Buna</h1>
          <p className="text-muted">You’ve been invited as {ROLE[preview.role] ?? preview.role}. This invitation was sent to <strong className="text-ink">{preview.email_hint}</strong> — you need to sign in with that email address to accept it.</p>
          {user && profile ? (
            <>
              <Alert tone="info">Signed in as <strong>{user.email}</strong>. If that isn’t the invited address, sign out and use the right one.</Alert>
              <AcceptInvitation token={token} />
            </>
          ) : (
            <div className="flex flex-wrap gap-3">
              <Link href={`/login?next=${encodeURIComponent(here)}`} className={buttonStyles("primary", "lg")}>Sign in to accept</Link>
              <Link href="/signup" className={buttonStyles("secondary", "lg")}>Create an account</Link>
            </div>
          )}
          {!user ? <p className="text-sm text-muted">New here? Create your account with the invited email address, confirm it, then come back to this link.</p> : null}
        </>
      )}
    </div>
  );
}

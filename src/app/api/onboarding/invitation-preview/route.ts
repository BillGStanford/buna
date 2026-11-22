import { NextRequest, NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth/session";
import { sha256Hex } from "@/lib/crypto";
import { isSupabaseConfigured } from "@/lib/env";
import { inviteTokenSchema } from "@/lib/validation/network";
import { createClient } from "@/lib/supabase/server";

type InvitationPreview = {
  startup_id?: string;
  startup_name?: string;
  status?: string;
  expired?: boolean;
};

export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) return NextResponse.json({ valid: false, message: "Invitation lookup is unavailable right now." }, { status: 503 });
  await requireProfile("/onboarding");
  const raw = (request.nextUrl.searchParams.get("token") ?? "").trim();
  const token = raw.match(/(?:\/invite\/)?([A-Za-z0-9_-]{43})/)?.[1] ?? raw;
  if (!inviteTokenSchema.safeParse(token).success) return NextResponse.json({ valid: false, message: "Paste a complete invitation link or token." }, { status: 400 });

  const supabase = await createClient();
  // The public landing-page preview intentionally omits IDs. Onboarding needs the
  // startup ID for its selector, so use the authenticated-only RPC for this lookup.
  const { data, error } = await supabase.rpc("get_invitation_onboarding_preview", { p_token_hash: sha256Hex(token) });
  if (error) return NextResponse.json({ valid: false, message: "We couldn’t look up this invitation. Try again." }, { status: 503 });
  const preview = ((data ?? []) as InvitationPreview[])[0];
  if (!preview || preview.status !== "pending" || preview.expired) {
    return NextResponse.json({ valid: false, message: "This invitation is invalid, expired or already used." }, { status: 404 });
  }
  if (!preview.startup_id || !preview.startup_name) {
    return NextResponse.json({ valid: false, message: "The invitation is valid, but its company details could not be loaded." }, { status: 503 });
  }
  return NextResponse.json({ valid: true, startup: { id: preview.startup_id, name: preview.startup_name } });
}

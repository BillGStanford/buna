import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { requireStaff } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { reviewReferralRewardAction } from "@/app/dashboard/referrals/actions";

export const metadata: Metadata = { title: "Referral reward requests", robots: { index: false } };

export default async function ReferralRewardsAdminPage() {
  await requireStaff();
  const admin = createAdminClient();
  const { data, error } = await admin.from("referral_reward_requests")
    .select("id, reward_key, status, member_note, staff_note, created_at, profile:profiles!referral_reward_requests_user_id_fkey(username, display_name, referral_code)")
    .order("created_at", { ascending: false }).limit(100);
  if (error) throw new Error("Could not load referral reward requests.");

  return <div className="space-y-5">
    <div><h1 className="text-3xl font-semibold tracking-tight">Referral reward requests</h1><p className="mt-1 text-sm text-muted">Review Founder Circle early-access and Community Builder roundtable requests.</p></div>
    {(data ?? []).length === 0 ? <Card><CardBody><p className="text-sm text-muted">No reward requests yet.</p></CardBody></Card> : (data ?? []).map((request) => {
      const member = Array.isArray(request.profile) ? request.profile[0] : request.profile;
      const title = request.reward_key === "founder_circle" ? "Founder Circle early access" : "Community Builder roundtable";
      return <Card key={request.id}>
        <CardHeader><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">{title}</h2><Badge tone={request.status === "approved" ? "green" : request.status === "declined" ? "warning" : "warning"}>{request.status}</Badge></div></CardHeader>
        <CardBody className="space-y-3">
          <p className="text-sm">{member?.display_name || member?.username || "Member"} · @{member?.username || "unknown"} · code {member?.referral_code || "—"}</p>
          <p className="text-xs text-muted">Requested {new Date(request.created_at).toLocaleString()}</p>
          {request.staff_note ? <p className="text-sm text-muted">Staff note: {request.staff_note}</p> : null}
          {request.status === "requested" ? <form action={reviewReferralRewardAction} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="requestId" value={request.id} />
            <label className="min-w-48 flex-1 text-sm">Staff note<input name="staffNote" maxLength={1000} className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2" /></label>
            <button name="decision" value="approved" className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-white">Approve</button>
            <button name="decision" value="declined" className="rounded-md border border-line px-3 py-2 text-sm font-medium">Decline</button>
          </form> : null}
        </CardBody>
      </Card>;
    })}
  </div>;
}

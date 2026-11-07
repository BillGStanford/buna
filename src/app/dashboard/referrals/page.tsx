import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { CopyReferralLink } from "@/components/referrals/copy-referral-link";
import { requireProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/env";
import { requestReferralRewardAction } from "./actions";

export const metadata: Metadata = { title: "Referrals & rewards" };

const rewards = [
  { count: 3, name: "Founding Supporter", detail: "Permanent profile badge and eligibility for a Buna founder spotlight." },
  { count: 5, name: "Founder Circle", detail: "Request early access to selected Buna features and priority consideration for founder features." },
  { count: 10, name: "Community Builder", detail: "Request an invitation to a private Buna founder roundtable." },
];

export default async function ReferralsPage() {
  const profile = await requireProfile("/dashboard/referrals");
  const supabase = await createClient();
  const { count, error } = await supabase.from("referral_attributions")
    .select("referred_user_id", { count: "exact", head: true })
    .eq("referrer_id", profile.id);
  if (error) throw new Error("Could not load referral totals.");
  const successful = count ?? 0;
  const { data: requests, error: requestError } = await supabase.from("referral_reward_requests").select("reward_key, status, staff_note").eq("user_id", profile.id);
  if (requestError) throw new Error("Could not load your reward requests.");
  const points = successful * 100;
  const referralCode = profile.referral_code;
  const referralUrl = referralCode ? `${getSiteUrl()}/signup?ref=${encodeURIComponent(referralCode)}` : null;
  const nextReward = rewards.find((reward) => successful < reward.count);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Referrals & rewards</h1>
        <p className="mt-1 text-sm text-muted">Bring founders, builders and supporters into the Buna ecosystem. You earn credit when a new member successfully creates an account.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardBody><p className="text-sm text-muted">Successful referrals</p><p className="mt-1 text-3xl font-bold tabular-nums">{successful}</p></CardBody></Card>
        <Card><CardBody><p className="text-sm text-muted">Referral points</p><p className="mt-1 text-3xl font-bold tabular-nums">{points.toLocaleString()}</p><p className="text-xs text-muted">100 points per successful signup</p></CardBody></Card>
        <Card><CardBody><p className="text-sm text-muted">Your referral code</p><p className="mt-1 text-2xl font-bold tracking-wider">{referralCode ?? "Generating…"}</p></CardBody></Card>
      </div>

      <Card>
        <CardHeader><h2 className="font-semibold">Your invitation link</h2></CardHeader>
        <CardBody className="space-y-3">
          <p className="text-sm text-muted">Share this link anywhere. When someone signs up through it, their account is attributed to you. Each person can only be attributed once.</p>
          {referralUrl ? <><div className="break-all rounded-md border border-line bg-primary-pale px-3 py-2 font-mono text-sm">{referralUrl}</div><CopyReferralLink url={referralUrl} /></> : <p className="text-sm text-muted">Your code is being prepared. Refresh this page shortly.</p>}
        </CardBody>
      </Card>

      <Card>
        <CardHeader><h2 className="font-semibold">Rewards</h2></CardHeader>
        <CardBody className="space-y-4">
          {rewards.map((reward) => {
            const unlocked = successful >= reward.count;
            return <div key={reward.count} className="flex flex-col gap-2 border-b border-line pb-4 last:border-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between">
              <div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{reward.name}</h3><Badge tone={unlocked ? "green" : "neutral"}>{unlocked ? "Unlocked" : `${reward.count} referrals`}</Badge></div><p className="mt-1 text-sm text-muted">{reward.detail}</p></div>
              <p className="shrink-0 text-sm tabular-nums text-muted">{Math.min(successful, reward.count)} / {reward.count}</p>
            </div>;
          })}
          {nextReward ? <p className="text-sm text-muted">Next milestone: {nextReward.count - successful} more successful {nextReward.count - successful === 1 ? "referral" : "referrals"} to unlock {nextReward.name}.</p> : <p className="text-sm font-medium text-primary-deep">You have unlocked every current referral milestone. Thank you for building Buna.</p>}
        </CardBody>
      </Card>

      <p className="text-xs text-muted">A successful referral means a new account was created with your code. Self-referrals, repeat accounts and uncompleted signup attempts do not earn points. Points are recognition credits, not cash and cannot be redeemed for money.</p>
    </div>
  );
}

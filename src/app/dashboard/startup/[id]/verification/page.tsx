import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BadgeCheck } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { RequestVerificationForm, WithdrawRequest } from "@/components/startups/manage/verification-forms";
import { requireProfile } from "@/lib/auth/session";
import { formatDate } from "@/lib/format";
import { canPublishStartup } from "@/lib/permissions";
import { VERIFICATION_LABELS } from "@/lib/startups/constants";
import { getManagedStartup } from "@/lib/startups/queries";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Verification" };
type Req = { id: string; status: string; notes: string | null; decision_note: string | null; created_at: string; reviewed_at: string | null };

export default async function VerificationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireProfile(`/dashboard/startup/${id}/verification`);
  const managed = await getManagedStartup(id, profile.id);
  if (!managed) notFound();
  const s = managed.startup;
  const canRequest = canPublishStartup(managed.role);
  const supabase = await createClient();
  const { data } = canRequest ? await supabase.from("verification_requests").select("id, status, notes, decision_note, created_at, reviewed_at").eq("startup_id", id).order("created_at", { ascending: false }).limit(5) : { data: [] };
  const requests = (data ?? []) as Req[];
  const pending = requests.find((r) => r.status === "pending");
  const last = requests.find((r) => r.status !== "pending");
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-wrap items-center gap-3"><h2 className="font-semibold">Status</h2>{s.verification_status === "verified" ? <Badge tone="green"><BadgeCheck className="mr-1 h-3.5 w-3.5" aria-hidden="true" />Verified</Badge> : <Badge>{VERIFICATION_LABELS[s.verification_status] ?? s.verification_status}</Badge>}</CardHeader>
        <CardBody className="space-y-3 text-sm">
          <p>A <strong>Verified</strong> badge tells visitors the Buna team reviewed evidence about this startup and found it consistent. It isn’t an endorsement and says nothing about finances or future success. Profiles without a badge are fully listed — verification is optional and you don’t need a registered company.</p>
          {s.verification_status === "revoked" ? <Alert tone="warning" title="Verification was withdrawn">{last?.decision_note ?? "Contact the team if you think this is a mistake."}</Alert> : null}
          {s.verification_status === "rejected" && last?.decision_note ? <Alert tone="warning" title="The last request wasn’t approved">{last.decision_note}</Alert> : null}
        </CardBody>
      </Card>
      {!canRequest ? <p className="text-sm text-muted">Only an owner or admin of this startup can request verification.</p>
        : pending ? (
          <Card><CardHeader><h2 className="font-semibold">Request in review</h2></CardHeader><CardBody className="space-y-3"><p className="text-sm">Sent <time dateTime={pending.created_at}>{formatDate(pending.created_at)}</time>. We’ll notify you of the decision.</p><WithdrawRequest startupId={id} requestId={pending.id} /></CardBody></Card>
        ) : s.verification_status === "verified" ? null : (
          <Card><CardHeader><h2 className="font-semibold">Request verification</h2></CardHeader><CardBody className="py-6"><RequestVerificationForm startupId={id} /></CardBody></Card>
        )}
    </div>
  );
}

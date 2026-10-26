import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Circle } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmActionForm } from "@/components/forms/confirm-action-form";
import { LaunchForm } from "@/components/launches/manage/launch-form";
import { LaunchLogoForm, LaunchScreenshots } from "@/components/launches/manage/launch-images";
import { requireProfile } from "@/lib/auth/session";
import { LAUNCH_STATUS_LABELS } from "@/lib/launches/constants";
import { getManagedLaunch } from "@/lib/launches/queries";
import { canEditStartup } from "@/lib/permissions";
import { listCategories, listMyStartups } from "@/lib/startups/queries";
import { uuidField } from "@/lib/validation/startup";
import { submitLaunchAction } from "../actions";

export const metadata: Metadata = { title: "Manage launch" };

export default async function ManageLaunchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuidField.safeParse(id).success) notFound();
  const profile = await requireProfile(`/dashboard/launches/${id}`);
  const launch = await getManagedLaunch(id, profile.id);
  if (!launch) notFound();
  const [categories, mine] = await Promise.all([listCategories(), listMyStartups(profile.id)]);
  const startups = mine.filter((s) => canEditStartup(s.role) && s.status !== "removed").map((s) => ({ id: s.id, name: s.name }));
  const st = LAUNCH_STATUS_LABELS[launch.status] ?? { label: launch.status, tone: "neutral" as const, help: "" };
  const canSubmit = launch.status === "draft" || launch.status === "rejected";
  const checklist = [
    { label: "Add a description", done: Boolean(launch.description?.trim()) },
    { label: "Choose a sector", done: Boolean(launch.category_id) },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm"><Link href="/dashboard/launches" className="font-medium">My launches</Link></p>
          <div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-bold">{launch.name}</h1><Badge tone={st.tone}>{st.label}</Badge></div>
        </div>
        <Link href={`/launches/${launch.slug}`} className={buttonStyles("secondary", "md")}>{launch.status === "published" ? "View public page" : "Preview"}</Link>
      </div>

      <Card>
        <CardHeader><h2 className="font-semibold">Review status</h2></CardHeader>
        <CardBody className="space-y-4">
          <p className="text-sm">{st.help}</p>
          {launch.status === "rejected" && launch.moderation_note ? <Alert tone="error" title="Moderator note">{launch.moderation_note}</Alert> : null}
          {canSubmit ? (
            <>
              <ul className="space-y-2" aria-label="Submission checklist">
                {checklist.map((c) => (
                  <li key={c.label} className="flex items-center gap-2 text-sm">
                    {c.done ? <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" /> : <Circle className="h-4 w-4 text-muted" aria-hidden="true" />}
                    <span>{c.label}</span><span className="sr-only">{c.done ? "(done)" : "(to do)"}</span>
                  </li>
                ))}
              </ul>
              <ConfirmActionForm action={submitLaunchAction} fields={{ launchId: launch.id }} trigger={launch.status === "rejected" ? "Resubmit for review" : "Submit for review"}
                triggerVariant="primary" variant="primary" size="md" title="Submit this launch for review?"
                description="A moderator will review it. You can keep editing, and you’ll be notified when it’s decided." confirmLabel="Submit" />
            </>
          ) : null}
        </CardBody>
      </Card>

      <Card><CardHeader><h2 className="font-semibold">Product image</h2></CardHeader><CardBody><LaunchLogoForm launchId={launch.id} name={launch.name} logoUrl={launch.logo_url} /></CardBody></Card>
      <Card><CardHeader><h2 className="font-semibold">Details</h2></CardHeader><CardBody className="py-6"><LaunchForm mode="edit" launch={launch} startups={startups} categories={categories} /></CardBody></Card>
      <Card><CardHeader><h2 className="font-semibold">Screenshots</h2></CardHeader><CardBody><LaunchScreenshots launchId={launch.id} media={launch.media.map(({ id: mid, url, alt_text }) => ({ id: mid, url, alt_text }))} /></CardBody></Card>
    </div>
  );
}

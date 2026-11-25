import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Users, Banknote } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmActionForm } from "@/components/forms/confirm-action-form";
import { PublishPanel } from "@/components/startups/manage/publish-panel";
import { SlugForm } from "@/components/startups/manage/slug-form";
import { deleteDraftStartupAction } from "../../actions";
import { getUser, requireProfile } from "@/lib/auth/session";
import { canManageTeam, canPublishStartup } from "@/lib/permissions";
import { getManagedStartup } from "@/lib/startups/queries";

export const metadata: Metadata = { title: "Publishing" };

export default async function SettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireProfile(`/dashboard/startup/${id}/settings`);
  const managed = await getManagedStartup(id, profile.id);
  if (!managed) notFound();
  const user = await getUser();
  const s = managed.startup;
  return (
    <div className="space-y-6">
      <Card><CardHeader><h2 className="font-semibold">Company management</h2><p className="text-sm text-muted">Team permissions, ownership, fundraising and verification are managed in their own dedicated sections.</p></CardHeader><CardBody className="flex flex-wrap gap-4"><Link href={`/dashboard/startup/${id}/management`} className="inline-flex items-center gap-2 text-sm font-semibold text-primary-deep"><Users className="h-4 w-4"/>Management overview <ArrowRight className="h-4 w-4"/></Link><Link href={`/dashboard/startup/${id}/fundraising`} className="inline-flex items-center gap-2 text-sm font-semibold text-primary-deep"><Banknote className="h-4 w-4"/>Fundraising and data room <ArrowRight className="h-4 w-4"/></Link></CardBody></Card>
      <Card><CardHeader><h2 className="font-semibold">Publication</h2></CardHeader>
        <CardBody><PublishPanel startup={s} canPublish={canPublishStartup(managed.role)} emailVerified={Boolean(user?.email_confirmed_at)} /></CardBody></Card>
      <Card><CardHeader><h2 className="font-semibold">Public address</h2></CardHeader>
        <CardBody><SlugForm startupId={s.id} slug={s.slug} canChange={canManageTeam(managed.role)} /></CardBody></Card>
      {managed.role === "owner" && s.status === "draft" ? (
        <Card><CardHeader><h2 className="font-semibold text-danger">Delete startup</h2></CardHeader>
          <CardBody className="space-y-3">
            <p className="text-sm text-muted">This startup has never been published, so you can delete it permanently along with its products, links and screenshots.</p>
            <ConfirmActionForm action={deleteDraftStartupAction} fields={{ startupId: s.id }} trigger="Delete startup" triggerVariant="danger" size="md"
              title="Delete this startup?" description="This permanently deletes the draft and everything attached to it. It can’t be undone." confirmLabel="Delete permanently" />
          </CardBody></Card>
      ) : null}
    </div>
  );
}

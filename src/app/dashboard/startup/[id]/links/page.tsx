import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card, CardBody } from "@/components/ui/card";
import { LinksManager } from "@/components/startups/manage/links-manager";
import { requireProfile } from "@/lib/auth/session";
import { getManagedChildren, getManagedStartup } from "@/lib/startups/queries";

export const metadata: Metadata = { title: "Links" };

export default async function LinksPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireProfile(`/dashboard/startup/${id}/links`);
  if (!(await getManagedStartup(id, profile.id))) notFound();
  const { links } = await getManagedChildren(id);
  return (
    <Card><CardBody className="space-y-4 py-6">
      <div><h2 className="text-lg font-semibold">Links</h2><p className="text-sm text-muted">Social profiles and other places people can find you. Only web links (https://) are accepted.</p></div>
      <LinksManager startupId={id} links={links} />
    </CardBody></Card>
  );
}

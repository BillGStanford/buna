import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card, CardBody } from "@/components/ui/card";
import { GalleryManager } from "@/components/startups/manage/gallery-manager";
import { requireProfile } from "@/lib/auth/session";
import { getManagedChildren, getManagedStartup } from "@/lib/startups/queries";

export const metadata: Metadata = { title: "Screenshots" };

export default async function ImagesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireProfile(`/dashboard/startup/${id}/images`);
  if (!(await getManagedStartup(id, profile.id))) notFound();
  const { media } = await getManagedChildren(id);
  return (
    <Card><CardBody className="space-y-4 py-6">
      <div><h2 className="text-lg font-semibold">Screenshots</h2><p className="text-sm text-muted">Show your product. Every image needs a short description for accessibility.</p></div>
      <GalleryManager startupId={id} media={media.map(({ id: mid, url, alt_text }) => ({ id: mid, url, alt_text }))} />
    </CardBody></Card>
  );
}

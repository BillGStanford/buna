import type { Metadata } from "next";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { LogoForm } from "@/components/startups/manage/logo-form";
import { StartupProfileForm } from "@/components/startups/manage/startup-profile-form";
import { requireProfile } from "@/lib/auth/session";
import { getManagedStartup, listCategories } from "@/lib/startups/queries";
import { notFound } from "next/navigation";

export const metadata: Metadata = { title: "Edit startup" };

export default async function StartupProfileEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireProfile(`/dashboard/startup/${id}`);
  const managed = await getManagedStartup(id, profile.id);
  if (!managed) notFound();
  const categories = await listCategories();
  const s = managed.startup;
  return (
    <div className="space-y-6">
      <Card><CardHeader><h2 className="font-semibold">Logo</h2></CardHeader><CardBody><LogoForm startupId={s.id} name={s.name} logoUrl={s.logo_url} /></CardBody></Card>
      <Card><CardHeader><h2 className="font-semibold">Profile</h2></CardHeader><CardBody className="py-6"><StartupProfileForm startup={s} categories={categories} /></CardBody></Card>
    </div>
  );
}

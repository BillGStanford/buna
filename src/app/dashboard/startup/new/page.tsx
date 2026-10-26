import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card, CardBody } from "@/components/ui/card";
import { CreateStartupForm } from "@/components/startups/manage/create-startup-form";
import { requireProfile } from "@/lib/auth/session";
import { listCategories } from "@/lib/startups/queries";

export const metadata: Metadata = { title: "Add a startup" };

export default async function NewStartupPage() {
  const profile = await requireProfile("/dashboard/startup/new");
  if (profile.is_suspended) redirect("/forbidden?reason=suspended");
  const categories = await listCategories();
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Add your startup</h1>
        <p className="mt-1 text-sm text-muted">Start with the basics. You can add the rest, preview it, and publish when you’re ready.</p>
      </div>
      <Card><CardBody className="py-6"><CreateStartupForm categories={categories} /></CardBody></Card>
    </div>
  );
}

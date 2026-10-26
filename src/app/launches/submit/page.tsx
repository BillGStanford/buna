import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card, CardBody } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { LaunchForm } from "@/components/launches/manage/launch-form";
import { requireProfile } from "@/lib/auth/session";
import { canEditStartup } from "@/lib/permissions";
import { listCategories, listMyStartups } from "@/lib/startups/queries";

export const metadata: Metadata = { title: "Submit a launch", robots: { index: false, follow: false } };

export default async function SubmitLaunchPage() {
  const profile = await requireProfile("/launches/submit");
  if (profile.is_suspended) redirect("/forbidden?reason=suspended");
  const [categories, mine] = await Promise.all([listCategories(), listMyStartups(profile.id)]);
  const startups = mine.filter((s) => canEditStartup(s.role) && s.status !== "removed").map((s) => ({ id: s.id, name: s.name }));
  return (
    <div className="container-page max-w-2xl space-y-6 py-10">
      <div>
        <h1 className="text-3xl font-bold">Submit a launch</h1>
        <p className="mt-2 text-muted">Start with the essentials. We’ll save it as a private draft so you can add images, preview it and submit it for review.</p>
      </div>
      <Alert tone="info">Every launch is reviewed by the Buna team before it goes live, and you’ll be notified of the decision.</Alert>
      <Card><CardBody className="py-6"><LaunchForm mode="create" startups={startups} categories={categories} /></CardBody></Card>
    </div>
  );
}

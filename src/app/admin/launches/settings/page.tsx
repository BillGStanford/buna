import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { saveLaunchPlatformSettingsAction } from "../actions";
import { Card, CardBody } from "@/components/ui/card";

export const metadata: Metadata = { title: "Launch competition settings" };

export default async function LaunchCompetitionSettingsPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.from("launch_platform_config").select("publishing_mode, competition_duration_hours, schedule_min_lead_hours").eq("id", true).single();
  if (error || !data) throw new Error("Launch settings are unavailable. Apply migration 0024 before configuring the competition.");
  const params = await searchParams;
  return (
    <div className="max-w-3xl space-y-6">
      <div><p className="text-sm"><Link href="/admin/launches" className="font-medium">Launch moderation</Link></p><h1 className="text-2xl font-bold">Daily competition settings</h1><p className="mt-1 text-sm text-muted">Control how products enter the competition and how long they remain on the active board. Completed launches remain permanently published.</p></div>
      {params.saved === "1" ? <p role="status" className="rounded-md border border-primary/30 bg-primary-pale p-3 text-sm">Settings saved.</p> : null}
      <Card><CardBody><form action={saveLaunchPlatformSettingsAction} className="space-y-5">
        <div className="space-y-2"><label htmlFor="publishingMode" className="text-sm font-medium">Publishing mode</label><select id="publishingMode" name="publishingMode" defaultValue={data.publishing_mode} className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm"><option value="instant">Instant publishing</option><option value="review">Moderator review</option></select><p className="text-xs text-muted">Instant means a complete, eligible submission goes live immediately. Moderators can still remove or feature any launch.</p></div>
        <div className="space-y-2"><label htmlFor="competitionHours" className="text-sm font-medium">Active competition duration (hours)</label><input id="competitionHours" name="competitionHours" type="number" min="1" max="72" required defaultValue={data.competition_duration_hours} className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm"/><p className="text-xs text-muted">Default: 24 hours. When this period ends, the launch leaves the active board but its product page stays public.</p></div>
        <div className="space-y-2"><label htmlFor="scheduleLeadHours" className="text-sm font-medium">Minimum scheduling notice (hours)</label><input id="scheduleLeadHours" name="scheduleLeadHours" type="number" min="0" max="720" required defaultValue={data.schedule_min_lead_hours} className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm"/><p className="text-xs text-muted">Future launch dates must respect this minimum notice. The submission form currently schedules by calendar date.</p></div>
        <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90">Save competition settings</button>
      </form></CardBody></Card>
      <p className="text-xs text-muted">Administrator-only controls. Database constraints validate values and each save synchronizes the legacy launch-review setting.</p>
    </div>
  );
}

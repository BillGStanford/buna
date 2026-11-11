import type { Metadata } from "next";
import { Card, CardBody } from "@/components/ui/card";
import { NoteActionForm } from "@/components/admin/note-action-form";
import { requireAdmin } from "@/lib/auth/session";
import { getSettings } from "@/lib/admin/queries";
import { setSettingAction } from "../actions";

export const metadata: Metadata = { title: "Settings (admin)" };

const SETTINGS = [
  { key: "startups_require_review", title: "Review new startups before they go live", on: "Owners’ Publish sends a startup to the review queue; it appears publicly only after a moderator approves it.", off: "Owners with a verified email and a complete profile go live immediately when they press Publish." },
];

export default async function AdminSettingsPage() {
  await requireAdmin();
  const settings = await getSettings();
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Platform settings</h1><p className="mt-1 text-sm text-muted">Changes apply immediately to new submissions and are recorded in the audit log.</p></div>
      <ul className="space-y-4">
        {SETTINGS.map((s) => {
          const on = settings[s.key] === true;
          return (
            <li key={s.key}><Card><CardBody className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">{s.title}</h2><span className={on ? "font-semibold text-primary-deep" : "font-semibold text-muted"}>{on ? "On" : "Off"}</span></div>
              <p className="text-sm text-muted">{on ? s.on : s.off}</p>
              <NoteActionForm action={setSettingAction} fields={{ key: s.key, value: on ? "false" : "true" }} button={on ? "Turn off" : "Turn on"} variant={on ? "secondary" : "primary"} />
            </CardBody></Card></li>
          );
        })}
      </ul>
      <Card><CardBody className="space-y-2">
        <h2 className="font-semibold">Review launches before they go live</h2>
        <p className="text-sm text-muted">Every public product launch is reviewed by Buna staff before publication. This safeguard is mandatory in V1 and is not an optional platform switch.</p>
      </CardBody></Card>
    </div>
  );
}

"use client";

import { useFormStatus } from "react-dom";
import { Bell, BellRing } from "lucide-react";
import { toggleLaunchReminderAction } from "@/app/launches/reminder-actions";
import { buttonStyles } from "@/components/ui/button";

function Submit({ following }: { following: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonStyles(following ? "secondary" : "primary", "sm")}>
      {following ? <BellRing className="h-4 w-4" aria-hidden="true" /> : <Bell className="h-4 w-4" aria-hidden="true" />}
      {pending ? "Saving…" : following ? "Reminder set" : "Notify me"}
    </button>
  );
}

export function LaunchReminderButton({ launchId, following, signedIn, loginHref }: {
  launchId: string; following: boolean; signedIn: boolean; loginHref: string;
}) {
  if (!signedIn) {
    return <a href={loginHref} className={buttonStyles("secondary", "sm")}><Bell className="h-4 w-4" aria-hidden="true" />Notify me</a>;
  }
  return (
    <form action={toggleLaunchReminderAction}>
      <input type="hidden" name="launchId" value={launchId} />
      <input type="hidden" name="intent" value={following ? "unfollow" : "follow"} />
      <Submit following={following} />
    </form>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { ChevronsUpDown } from "lucide-react";
import type { MyStartup } from "@/lib/startups/queries";

export function StartupWorkspaceSwitcher({ startups, activeStartupId, returnTo = "overview" }: {
  startups: MyStartup[];
  activeStartupId: string;
  returnTo?: "overview" | "startup";
}) {
  const router = useRouter();
  if (startups.length < 2) return null;
  return (
    <label className="flex min-w-0 items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2">
      <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted" aria-hidden="true"/>
      <span className="sr-only">Switch company workspace</span>
      <select aria-label="Switch company workspace" value={activeStartupId}
        onChange={(event) => {
          const id = event.currentTarget.value;
          if (!id) return;
          router.push(returnTo === "overview" ? `/dashboard?company=${encodeURIComponent(id)}` : `/dashboard/startup/${encodeURIComponent(id)}`);
        }}
        className="min-w-0 max-w-full flex-1 appearance-none bg-transparent text-sm font-semibold text-ink outline-none">
        {startups.map((startup) => <option key={startup.id} value={startup.id}>{startup.name}</option>)}
      </select>
    </label>
  );
}

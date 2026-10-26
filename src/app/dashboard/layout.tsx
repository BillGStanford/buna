import type { Metadata } from "next";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { Alert } from "@/components/ui/alert";
import { availableNav, dashboardNav } from "@/config/site";
import { requireProfile } from "@/lib/auth/session";

// Private area: never indexed.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile("/dashboard");
  return (
    <div className="container-page grid gap-6 py-8 lg:grid-cols-[13rem_1fr] lg:gap-10">
      <aside><DashboardNav items={availableNav(dashboardNav)} /></aside>
      <div className="min-w-0 space-y-6">
        {profile.is_suspended ? (
          <Alert tone="error" title="Your account is suspended">
            You can sign in and view your information, but you can’t create or change public content.
          </Alert>
        ) : null}
        {children}
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { Alert } from "@/components/ui/alert";
import { availableNav, dashboardNav } from "@/config/site";
import { requireProfile } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile("/dashboard");
  if (!profile.professional_role) redirect("/onboarding");

  const needsInterests = (profile.interests?.length ?? 0) === 0;
  return (
    <div className="container-page grid gap-6 py-6 sm:py-8 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-8">
      <aside><DashboardNav items={availableNav(dashboardNav)} /></aside>
      <div className="min-w-0 space-y-7">
        {profile.is_suspended ? (
          <Alert tone="error" title="Your account is suspended">
            You can sign in and view your information, but you can’t create or change public content.
          </Alert>
        ) : null}
        {needsInterests ? (
          <Alert tone="warning" title="Personalized discovery is waiting for you">
            Choose at least one sector to unlock startup and founder recommendations matched to your interests. You can still browse Buna normally.
            {" "}<Link href="/onboarding?step=2" className="font-semibold underline">Choose your interests</Link>
          </Alert>
        ) : null}
        {children}
      </div>
    </div>
  );
}

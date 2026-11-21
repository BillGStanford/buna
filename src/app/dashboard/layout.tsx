import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { Alert } from "@/components/ui/alert";
import { availableNav, dashboardNavFor } from "@/config/site";
import { requireProfile } from "@/lib/auth/session";
import { getInvestorPortal } from "@/lib/investors/queries";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile("/dashboard");
  if (!profile.professional_role) redirect("/onboarding");
  if (!profile.onboarding_completed_at && (profile.interests?.length ?? 0) === 0) redirect("/onboarding?step=interests");

  const investorPortal = profile.professional_role === "Investor"
    ? await getInvestorPortal(profile.id)
    : null;
  const navItems = availableNav(dashboardNavFor(
    profile.professional_role,
    Boolean(investorPortal?.investor),
  ));
  const needsInterests = (profile.interests?.length ?? 0) === 0;

  return (
    <div className="container-page grid gap-6 py-6 sm:py-8 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-8">
      <aside>
        <p className="mb-2 hidden px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted lg:block">
          {profile.professional_role === "Investor" ? "Investor workspace" :
            profile.professional_role === "Founder / Co-founder" || profile.professional_role === "Entrepreneur / Aspiring founder" ? "Founder workspace" : "Your Buna"}
        </p>
        <DashboardNav items={navItems} />
        <p className="mt-3 hidden px-3 text-xs text-muted lg:block">
          Your menu reflects your account role and approved access.{" "}
          <Link href="/dashboard/settings" className="underline">Manage account</Link>.
        </p>
      </aside>
      <div className="min-w-0 space-y-7">
        {profile.is_suspended ? (
          <Alert tone="error" title="Your account is suspended">
            You can sign in and view your information, but you can’t create or change public content.
          </Alert>
        ) : null}
        {needsInterests ? (
          <Alert tone="warning" title="Personalized discovery is waiting for you">
            Choose at least one sector to unlock startup and founder recommendations matched to your interests. You can still browse Buna normally.
            {" "}<Link href="/onboarding?step=interests" className="font-semibold underline">Choose your interests</Link>
          </Alert>
        ) : null}
        {children}
      </div>
    </div>
  );
}

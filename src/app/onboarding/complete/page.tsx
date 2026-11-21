import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, Rocket, Compass, BriefcaseBusiness } from "lucide-react";
import { requireProfile } from "@/lib/auth/session";
import { getInvestorPortal } from "@/lib/investors/queries";
import { buttonStyles } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Welcome to Buna", robots: { index: false, follow: false } };

export default async function OnboardingCompletePage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const profile = await requireProfile("/onboarding/complete");
  if (!profile.onboarding_completed_at) redirect("/onboarding");
  const { next } = await searchParams;
  const isInvestor = profile.professional_role === "Investor";
  const investorPortal = isInvestor ? await getInvestorPortal(profile.id) : null;
  const approved = Boolean(investorPortal?.investor);
  const pending = investorPortal?.application?.status === "pending";
  const primaryHref = isInvestor ? (approved ? "/dashboard/investor" : "/dashboard/investor-portal") : next === "startup" ? "/dashboard/startup/new?welcome=1" : "/dashboard";
  const primaryLabel = isInvestor ? (approved ? "Enter Investor Mode" : "View your application") : next === "startup" ? "Create your startup profile" : "Explore your dashboard";

  return (
    <main className="min-h-[calc(100vh-8rem)] bg-primary-pale/50 py-12">
      <div className="container-page max-w-2xl">
        <section className="rounded-2xl border border-line bg-surface p-6 text-center shadow-sm sm:p-10">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary-mint text-primary-deep"><CheckCircle2 className="h-7 w-7" /></span>
          <p className="mt-6 text-xs font-bold uppercase tracking-[0.16em] text-primary">You’re part of the ecosystem</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Welcome to Buna, {profile.display_name.split(" ")[0]}.</h1>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-muted">Your profile and discovery preferences are saved. You can now meet founders, explore companies and find your place in the African startup ecosystem.</p>
          {isInvestor ? (
            <div className="mx-auto mt-6 max-w-lg rounded-xl border border-line bg-canvas p-4 text-left">
              <div className="flex items-center justify-between gap-3"><p className="font-semibold">Investor Mode application</p><Badge tone={approved ? "green" : pending ? "warning" : "neutral"}>{approved ? "Approved" : pending ? "Under review" : "Not approved yet"}</Badge></div>
              <p className="mt-2 text-sm text-muted">{approved ? "Your investor access is active. Your private discovery tools and deal pipeline are ready." : pending ? "Your application has been submitted. Buna staff will review it before investor-only deal-flow tools unlock. You can still browse public startups and the investor directory." : "Your investor application status is available in the Investor Portal. Restricted tools remain locked until approval."}</p>
            </div>
          ) : (
            <div className="mx-auto mt-6 grid max-w-lg gap-3 text-left sm:grid-cols-2">
              <div className="rounded-xl border border-line p-4"><Rocket className="h-5 w-5 text-primary" /><p className="mt-2 font-semibold">Build your company</p><p className="mt-1 text-sm text-muted">Create a startup profile and introduce your work.</p></div>
              <div className="rounded-xl border border-line p-4"><Compass className="h-5 w-5 text-primary" /><p className="mt-2 font-semibold">Explore the ecosystem</p><p className="mt-1 text-sm text-muted">Find founders, launches and opportunities.</p></div>
            </div>
          )}
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href={primaryHref} className={buttonStyles("primary","lg")}>{primaryLabel}</Link>
            <Link href="/startups" className={buttonStyles("secondary","lg")}><Compass className="h-4 w-4" />Browse startups</Link>
          </div>
          {!isInvestor ? <p className="mt-5 text-xs text-muted">You can complete or update your public profile any time from your dashboard.</p> : <p className="mt-5 text-xs text-muted">Investor Mode remains restricted until staff approval. Your application status is always available in the Investor Portal.</p>}
        </section>
      </div>
    </main>
  );
}

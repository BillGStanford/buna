import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth/session";
import { getInvestorPortal } from "@/lib/investors/queries";
import { InvestorProfileForm } from "@/components/investors/investor-forms";
import { Alert } from "@/components/ui/alert";

export const metadata: Metadata = { title: "Manage investor profile", robots: { index: false } };

export default async function InvestorProfilePage() {
  const profile = await requireProfile("/dashboard/investor/profile");
  const { investor } = await getInvestorPortal(profile.id);
  if (!investor) redirect("/dashboard/investor");
  return <div className="max-w-3xl space-y-5">
    <p className="text-sm"><Link href="/dashboard/investor">← Investor workspace</Link></p>
    <div><h1 className="text-2xl font-bold">Manage investor profile</h1><p className="mt-1 text-sm text-muted">Public details help founders assess whether your investment focus fits their company. Private contact information is visible only to you and authorised Buna staff.</p></div>
    {["owner","partner","investment_manager"].includes(investor.membership_role ?? "")
      ? <InvestorProfileForm investor={investor} />
      : <Alert tone="info" title="Profile editing is restricted">Your role can view the investor workspace, but only an owner, partner, or investment manager can edit the public investor profile.</Alert> }
  </div>;
}

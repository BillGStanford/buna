import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth/session";
import { getInvestorPortal, listInvestorTeam } from "@/lib/investors/queries";
import { AddInvestorMemberForm, InvestorTeamList } from "@/components/investors/investor-team";
import { Alert } from "@/components/ui/alert";

export const metadata: Metadata = { title: "Investor team", robots: { index: false, follow: false } };

export default async function InvestorTeamPage() {
  const profile = await requireProfile("/dashboard/investor/team");
  const { investor } = await getInvestorPortal(profile.id);
  if (!investor) redirect("/dashboard/investor-portal");
  const members = await listInvestorTeam(investor.id, true);
  const memberRoles = investor.membership_roles ?? [investor.membership_role ?? "member"];\n  const canManage = memberRoles.includes("owner") || memberRoles.includes("partner");
  return <div className="max-w-4xl space-y-5">
    <header className="border-b border-line pb-4">
      <p className="text-sm"><Link href="/dashboard/investor">← Investor Desk</Link></p>
      <h1 className="mt-2 text-2xl font-bold">Investor team</h1>
      <p className="mt-1 text-sm text-muted">Manage the Buna accounts that represent {investor.name}. Each member has an individual login and a defined role.</p>
    </header>
    <Alert tone="info" title="Roles and permissions">
      Owners and partners manage membership. Investment managers can manage the investor profile and deal flow. Analysts, associates and members can work in deal flow. Observers can view but not change deal-flow records.
    </Alert>
    <section className="space-y-3">
      <div className="border-b border-line pb-2"><h2 className="text-lg font-semibold">Current members</h2><p className="text-sm text-muted">{members.length} active {members.length === 1 ? "member" : "members"}</p></div>
      <InvestorTeamList members={members} canManage={canManage} />
    </section>
    <AddInvestorMemberForm canManage={canManage} />
    {!canManage ? <p className="text-sm text-muted">Only an owner or partner can add, remove, or change team roles. Contact your organization’s owner if you need a change.</p> : null}
  </div>;
}

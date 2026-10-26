import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TeamManager } from "@/components/team/team-manager";
import { requireProfile } from "@/lib/auth/session";
import { getManagedStartup } from "@/lib/startups/queries";
import { getTeam } from "@/lib/team/queries";

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireProfile(`/dashboard/startup/${id}/team`);
  const managed = await getManagedStartup(id, profile.id);
  if (!managed) notFound();
  const { members, invitations } = await getTeam(id);
  return <TeamManager startupId={id} viewerId={profile.id} viewerRole={managed.role} members={members} invitations={invitations} />;
}

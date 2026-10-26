import type { Metadata } from "next";
import Link from "next/link";
import { buttonStyles } from "@/components/ui/button";
import { EmptyState } from "@/components/illustrations";
import { OpportunityList } from "@/components/opportunities/opportunity-card";
import { requireProfile } from "@/lib/auth/session";
import { listSavedOpportunities } from "@/lib/opportunities/queries";

export const metadata: Metadata = { title: "Saved" };

export default async function SavedPage() {
  const profile = await requireProfile("/dashboard/saved");
  const saved = await listSavedOpportunities(profile.id);
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Saved</h1><p className="mt-1 text-sm text-muted">Opportunities you’ve saved. You’ll get a reminder in the last three days before a deadline. <Link href="/dashboard/following" className="font-medium">Startups you follow</Link> are on their own page.</p></div>
      {saved.length === 0 ? (
        <EmptyState illustration="saved" title="Nothing saved yet" action={<Link href="/opportunities" className={buttonStyles("primary", "md")}>Browse opportunities</Link>}>Save an opportunity to keep it here and get a heads-up before it closes.</EmptyState>
      ) : <OpportunityList items={saved} signedIn returnTo="/dashboard/saved" />}
    </div>
  );
}

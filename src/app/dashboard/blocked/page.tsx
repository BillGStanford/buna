import type { Metadata } from "next";
import Link from "next/link";
import { Ban } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardBody } from "@/components/ui/card";
import { BlockButton } from "@/components/social/block-button";
import { requireProfile } from "@/lib/auth/session";
import { getBlockedMembers } from "@/lib/social/queries";

export const metadata: Metadata = { title: "Blocked members" };

export default async function BlockedMembersPage() {
  await requireProfile("/dashboard/blocked");
  const members = await getBlockedMembers();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Blocked members</h1>
        <p className="mt-1 text-sm text-muted">Only you can see this list. Blocked members aren’t notified.</p>
      </div>
      <Card><CardBody>
        {members.length === 0 ? (
          <div className="space-y-2 py-3 text-center">
            <Ban className="mx-auto h-7 w-7 text-muted" aria-hidden="true" />
            <p className="font-medium">No blocked members</p>
            <p className="text-sm text-muted">If you block someone, you can manage that decision here.</p>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {members.map((member) => (
              <li key={member.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
                <Avatar name={member.display_name} src={member.avatar_url} size={44} />
                <div className="min-w-0 flex-1">
                  <Link href={`/users/${member.username}`} className="font-medium text-ink no-underline hover:underline">{member.display_name || `@${member.username}`}</Link>
                  <p className="text-sm text-muted">@{member.username}</p>
                </div>
                <BlockButton targetId={member.id} targetName={member.display_name || member.username} blocked />
              </li>
            ))}
          </ul>
        )}
      </CardBody></Card>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardBody } from "@/components/ui/card";
import { FollowButton } from "@/components/social/follow-button";
import { getUser } from "@/lib/auth/session";
import { getPublicProfileNetwork, getPublicUser, isFollowing } from "@/lib/social/queries";

type Props = { params: Promise<{ username: string; list: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username, list } = await params;
  if (list !== "followers" && list !== "following") return { title: "Not found", robots: { index: false } };
  return { title: `${list === "followers" ? "Followers" : "Following"} · @${username}`, robots: { index: false, follow: false } };
}

export default async function ProfileNetworkPage({ params }: Props) {
  const { username, list } = await params;
  if (list !== "followers" && list !== "following") notFound();
  const profile = await getPublicUser(username.toLowerCase());
  if (!profile) notFound();
  const viewer = await getUser();
  const isMe = viewer?.id === profile.id;
  if (!isMe && (!profile.is_public_profile || !profile.show_network)) notFound();

  const members = await getPublicProfileNetwork(profile.id, list);
  const title = list === "followers" ? "Followers" : "Following";
  const returnTo = `/users/${profile.username}/${list}`;
  const states = await Promise.all(members.map((member) => isFollowing(viewer?.id ?? null, "user", member.id)));
  return (
    <div className="container-page max-w-3xl space-y-5 py-8">
      <div>
        <p className="text-sm text-muted"><Link href={`/users/${profile.username}`} className="hover:underline">@{profile.username}</Link></p>
        <h1 className="mt-1 text-2xl font-bold">{title}</h1>
        <p className="mt-1 text-sm text-muted">People in {profile.display_name || `@${profile.username}`}’s Buna network.</p>
      </div>
      <Card><CardBody>
        {members.length === 0 ? <p className="text-sm text-muted">No {list} to show yet.</p> : (
          <ul className="divide-y divide-line">
            {members.map((member, index) => (
              <li key={member.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
                <Avatar name={member.display_name} src={member.avatar_url} size={44} />
                <div className="min-w-0 flex-1">
                  <Link href={`/users/${member.username}`} className="font-medium text-ink no-underline hover:underline">{member.display_name || `@${member.username}`}</Link>
                  <p className="text-sm text-muted">@{member.username}{member.headline ? ` · ${member.headline}` : ""}</p>
                </div>
                {viewer?.id !== member.id ? <FollowButton targetType="user" targetId={member.id} name={member.display_name || member.username} following={states[index]} signedIn={Boolean(viewer)} loginHref={`/login?next=${encodeURIComponent(returnTo)}`} returnTo={returnTo} /> : null}
              </li>
            ))}
          </ul>
        )}
      </CardBody></Card>
    </div>
  );
}

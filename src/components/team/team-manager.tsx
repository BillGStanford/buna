"use client";

import { useActionState } from "react";
import Link from "next/link";
import { changeMemberRoleAction, inviteMemberAction, removeMemberAction, revokeInvitationAction, updateMyVisibilityAction } from "@/app/dashboard/startup/team-actions";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { CheckboxField, SelectField, TextField } from "@/components/ui/fields";
import { ConfirmActionForm } from "@/components/forms/confirm-action-form";
import { FormMessage, firstError, valueOf } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { formatDate } from "@/lib/format";
import { assignableMemberRoles, type MemberRole } from "@/lib/permissions";
import { idleState } from "@/lib/types";
import type { PendingInvite, TeamMember } from "@/lib/team/queries";

const ROLE_LABEL: Record<string, string> = { owner: "Owner", admin: "Admin", editor: "Editor", viewer: "Viewer" };
const ROLE_HELP = "Owners and admins manage the team; editors edit the profile, products and launches; viewers can read private details only.";

function RoleForm({ startupId, member, options }: { startupId: string; member: TeamMember; options: MemberRole[] }) {
  const [state, action] = useActionState(changeMemberRoleAction, idleState);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="startupId" value={startupId} /><input type="hidden" name="userId" value={member.user_id} />
      <label htmlFor={`role-${member.user_id}`} className="sr-only">Role for {member.display_name || member.username}</label>
      <select id={`role-${member.user_id}`} name="role" defaultValue={member.role} className="h-9 rounded-md border border-line bg-surface px-2 text-sm">
        {options.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
      </select>
      <SubmitButton size="sm" variant="secondary" pendingLabel="Saving…">Update role</SubmitButton>
      {state.status === "error" ? <span role="alert" className="w-full text-xs font-medium text-danger">{state.message}</span> : null}
    </form>
  );
}

export function TeamManager({ startupId, viewerId, viewerRole, members, invitations }: {
  startupId: string; viewerId: string; viewerRole: MemberRole; members: TeamMember[]; invitations: PendingInvite[];
}) {
  const [invite, inviteAction] = useActionState(inviteMemberAction, idleState);
  const [revoke] = [revokeInvitationAction];
  const [vis, visAction] = useActionState(updateMyVisibilityAction, idleState);
  const assignable = assignableMemberRoles(viewerRole);
  const canManage = viewerRole === "owner" || viewerRole === "admin";
  const me = members.find((m) => m.user_id === viewerId);
  const rolesFor = (m: TeamMember): MemberRole[] | null => {
    if (m.user_id === viewerId) return null;
    if (viewerRole === "owner") return ["owner", "admin", "editor", "viewer"];
    if (viewerRole === "admin" && (m.role === "editor" || m.role === "viewer")) return ["editor", "viewer"];
    return null;
  };
  const canRemove = (m: TeamMember) => m.user_id === viewerId || viewerRole === "owner" || (viewerRole === "admin" && (m.role === "editor" || m.role === "viewer"));

  return (
    <div className="space-y-8">
      <section aria-labelledby="members-heading" className="space-y-3">
        <h2 id="members-heading" className="text-lg font-semibold">Members <span className="tabular-nums text-muted">({members.length})</span></h2>
        <p className="text-sm text-muted">{ROLE_HELP}</p>
        <ul className="divide-y divide-line rounded-lg border border-line">
          {members.map((m) => {
            const options = rolesFor(m);
            return (
              <li key={m.user_id} className="flex flex-wrap items-center gap-3 p-4">
                <Avatar name={m.display_name} src={m.avatar_url} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium"><Link href={`/users/${m.username}`} className="text-ink no-underline hover:underline">{m.display_name || `@${m.username}`}</Link>{m.user_id === viewerId ? <span className="text-muted"> (you)</span> : null}</p>
                  <p className="text-xs text-muted"><Link href={`/users/${m.username}`} className="no-underline hover:underline">@{m.username}</Link> · joined <time dateTime={m.created_at}>{formatDate(m.created_at)}</time>{m.is_public ? " · shown on the public team" : ""}</p>
                </div>
                {options ? <RoleForm startupId={startupId} member={m} options={options} /> : <Badge tone={m.role === "owner" ? "green" : "neutral"}>{ROLE_LABEL[m.role]}</Badge>}
                {canRemove(m) ? (
                  <ConfirmActionForm action={removeMemberAction} fields={{ startupId, userId: m.user_id }} trigger={m.user_id === viewerId ? "Leave team" : "Remove"}
                    title={m.user_id === viewerId ? "Leave this team?" : `Remove ${m.display_name || m.username}?`}
                    description={m.user_id === viewerId ? "You’ll lose access to this startup’s private details." : "They’ll lose access to this startup’s private details immediately."}
                    confirmLabel={m.user_id === viewerId ? "Leave team" : "Remove member"} />
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      {me ? (
        <section aria-labelledby="visibility-heading" className="space-y-3">
          <h2 id="visibility-heading" className="text-lg font-semibold">Your visibility</h2>
          <form action={visAction} className="max-w-lg space-y-3 rounded-lg border border-line bg-primary-pale p-4">
            <input type="hidden" name="startupId" value={startupId} />
            <FormMessage state={vis} />
            <CheckboxField name="isPublic" label="Show me on this startup’s public team" defaultChecked={me.is_public} hint="Your name, photo and title appear on the public profile." />
            <TextField label="Your title" name="publicTitle" maxLength={80} placeholder="Co-founder & CTO" defaultValue={vis.status === "error" ? valueOf(vis, "publicTitle") : (me.public_title ?? "")} error={firstError(vis, "publicTitle")} />
            <SubmitButton size="sm" variant="secondary" pendingLabel="Saving…">Save</SubmitButton>
          </form>
        </section>
      ) : null}

      {canManage ? (
        <>
          <section aria-labelledby="invite-heading" className="space-y-3">
            <h2 id="invite-heading" className="text-lg font-semibold">Invite someone</h2>
            <form action={inviteAction} className="max-w-xl space-y-3 rounded-lg border border-line bg-primary-pale p-4" noValidate>
              <input type="hidden" name="startupId" value={startupId} />
              <FormMessage state={invite} />
              <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
                <TextField label="Email address" name="email" type="email" required key={invite.status === "success" ? invite.message : "f"} defaultValue={invite.status === "error" ? valueOf(invite, "email") : ""} error={firstError(invite, "email")} hint="They must sign in with this address to accept." />
                <SelectField label="Role" name="role" defaultValue={invite.status === "error" ? valueOf(invite, "role", "editor") : "editor"} error={firstError(invite, "role")}>
                  {assignable.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                </SelectField>
              </div>
              <SubmitButton size="sm" pendingLabel="Inviting…">Send invitation</SubmitButton>
            </form>
          </section>

          <section aria-labelledby="pending-heading" className="space-y-3">
            <h2 id="pending-heading" className="text-lg font-semibold">Pending invitations <span className="tabular-nums text-muted">({invitations.length})</span></h2>
            {invitations.length === 0 ? <p className="text-sm text-muted">No pending invitations.</p> : (
              <ul className="divide-y divide-line rounded-lg border border-line">
                {invitations.map((i) => (
                  <li key={i.id} className="flex flex-wrap items-center gap-3 p-4">
                    <div className="min-w-0 flex-1"><p className="truncate font-medium">{i.email}</p><p className="text-xs text-muted">{ROLE_LABEL[i.role]} · expires <time dateTime={i.expires_at}>{formatDate(i.expires_at)}</time></p></div>
                    <ConfirmActionForm action={revoke} fields={{ startupId, invitationId: i.id }} trigger="Revoke" title="Revoke this invitation?" description="The link stops working immediately." confirmLabel="Revoke invitation" />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}

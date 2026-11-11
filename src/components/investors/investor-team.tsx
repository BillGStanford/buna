"use client";

import { useActionState } from "react";
import Link from "next/link";
import { manageInvestorTeamAction } from "@/app/dashboard/investor/team-actions";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { TextField } from "@/components/ui/fields";
import { Button } from "@/components/ui/button";
import { idleState } from "@/lib/types";

const ROLES = [
  ["partner","Partner"],
  ["investment_manager","Investment manager"],
  ["analyst","Analyst"],
  ["associate","Associate"],
  ["member","Member"],
  ["observer","Observer"],
] as const;

function MemberRoleForm({ userId, roles, canManage }: { userId: string; roles: string[]; canManage: boolean }) {
  const [state, action] = useActionState(manageInvestorTeamAction, idleState);
  if (!canManage || roles.includes("owner")) return <span className="text-sm text-muted">{roles.map((role) => role.replace(/_/g," ")).join(" · ")}</span>;
  return <form action={action} className="flex flex-wrap items-end gap-2">
    <input type="hidden" name="action" value="set_roles" />
    <input type="hidden" name="userId" value={userId} />
    <fieldset className="min-w-52 rounded border border-line p-3"><legend className="px-1 text-xs font-semibold text-muted">Team roles</legend><div className="grid grid-cols-2 gap-2">{ROLES.map(([v,l])=><label key={v} className="flex items-center gap-2 text-xs"><input type="checkbox" name="roles" value={v} defaultChecked={roles.includes(v)} className="accent-[rgb(var(--primary))]" />{l}</label>)}</div></fieldset>
    <SubmitButton pendingLabel="Saving…">Save role</SubmitButton>
    <FormMessage state={state} />
  </form>;
}

function RemoveMemberForm({ userId, canManage }: { userId: string; canManage: boolean }) {
  const [state, action] = useActionState(manageInvestorTeamAction, idleState);
  if (!canManage) return null;
  return <form action={action} className="space-y-1">
    <input type="hidden" name="action" value="remove" />
    <input type="hidden" name="userId" value={userId} />
    <Button type="submit" variant="secondary" size="sm">Remove</Button>
    <FormMessage state={state} />
  </form>;
}

export function AddInvestorMemberForm({ canManage }: { canManage: boolean }) {
  const [state, action] = useActionState(manageInvestorTeamAction, idleState);
  if (!canManage) return null;
  return <form action={action} className="space-y-3 border border-line bg-surface p-4">
    <input type="hidden" name="action" value="add" />
    <div><h3 className="font-semibold">Add an existing Buna member</h3><p className="mt-1 text-sm text-muted">Each person joins with their own Buna account. Add their username; never share passwords or sign-in credentials.</p></div>
    <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <TextField label="Buna username" name="username" required placeholder="@username" />
      <fieldset className="rounded border border-line p-3"><legend className="px-1 text-xs font-semibold text-muted">Team roles</legend><div className="grid grid-cols-2 gap-2">{ROLES.map(([v,l])=><label key={v} className="flex items-center gap-2 text-xs"><input type="checkbox" name="roles" value={v} defaultChecked={v === "member"} className="accent-[rgb(var(--primary))]" />{l}</label>)}</div></fieldset>
      <SubmitButton pendingLabel="Adding…">Add member</SubmitButton>
    </div>
    <FormMessage state={state} />
  </form>;
}

export function InvestorTeamList({ members, canManage }: { members: { id: string; user_id: string; role: string; roles?: string[]; person: { username: string; display_name: string; avatar_url?: string | null; headline?: string | null } | null }[]; canManage: boolean }) {
  return <div className="space-y-3">
    {members.length ? <ul className="divide-y divide-line border border-line">
      {members.map((member) => <li key={member.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
        <div className="min-w-0">
          <p className="font-semibold">{member.person?.username ? <Link href={"/users/" + member.person.username}>{member.person?.display_name || member.person.username}</Link> : (member.person?.display_name || "Buna member")}</p>
          {member.person?.username ? <p className="text-sm text-muted">@{member.person.username}</p> : null}
          {member.person?.headline ? <p className="mt-1 text-sm text-muted">{member.person.headline}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <MemberRoleForm userId={member.user_id} roles={member.roles ?? [member.role]} canManage={canManage} />
          {!(member.roles ?? [member.role]).includes("owner") ? <RemoveMemberForm userId={member.user_id} canManage={canManage} /> : null}
        </div>
      </li>)}
    </ul> : <p className="border border-line p-4 text-sm text-muted">No team members are listed yet.</p>}
  </div>;
}

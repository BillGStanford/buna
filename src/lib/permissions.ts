/**
 * Role model. This file is the readable source of truth and is unit-tested; the same rules are
 * enforced for real by Postgres RLS and the SECURITY DEFINER functions in supabase/migrations.
 * UI checks that use these helpers are a convenience only — never the security boundary.
 */

export type PlatformRole = "user" | "moderator" | "admin";
export type MemberRole = "owner" | "admin" | "editor" | "viewer";

export const PLATFORM_ROLES: PlatformRole[] = ["user", "moderator", "admin"];

export function isStaff(role: PlatformRole | null | undefined): boolean {
  return role === "moderator" || role === "admin";
}

export function isAdmin(role: PlatformRole | null | undefined): boolean {
  return role === "admin";
}

/** Moderators handle reports and content; only admins manage users, categories and settings. */
export function canAccessAdminArea(role: PlatformRole | null | undefined): boolean {
  return isStaff(role);
}

/**
 * Platform role changes: admins only, never on yourself (prevents lock-out and silent
 * self-promotion), and never via a client-controlled field.
 */
export function canChangePlatformRole(input: {
  actorRole: PlatformRole;
  actorId: string;
  targetId: string;
}): boolean {
  return input.actorRole === "admin" && input.actorId !== input.targetId;
}

export function canEditStartup(role: MemberRole | null | undefined): boolean {
  return role === "owner" || role === "admin" || role === "editor";
}

export function canPublishStartup(role: MemberRole | null | undefined): boolean {
  return role === "owner" || role === "admin";
}

export function canManageTeam(role: MemberRole | null | undefined): boolean {
  return role === "owner" || role === "admin";
}

export function canViewInquiries(role: MemberRole | null | undefined): boolean {
  return canEditStartup(role);
}

/** Which team roles an actor may grant. "owner" can never be granted through invitations. */
export function assignableMemberRoles(actor: MemberRole | null | undefined): MemberRole[] {
  if (actor === "owner") return ["admin", "editor", "viewer"];
  if (actor === "admin") return ["editor", "viewer"];
  return [];
}

export function canAssignMemberRole(actor: MemberRole | null | undefined, target: MemberRole): boolean {
  return assignableMemberRoles(actor).includes(target);
}

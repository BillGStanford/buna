import { describe, expect, it } from "vitest";
import {
  assignableMemberRoles, canAccessAdminArea, canAssignMemberRole, canChangePlatformRole, canEditStartup,
  canManageTeam, canPublishStartup, canViewInquiries, isAdmin, isStaff,
} from "./permissions";

describe("platform roles", () => {
  it("treats moderators and admins as staff, users and anonymous as not", () => {
    expect(isStaff("moderator")).toBe(true);
    expect(isStaff("admin")).toBe(true);
    expect(isStaff("user")).toBe(false);
    expect(isStaff(null)).toBe(false);
    expect(isStaff(undefined)).toBe(false);
  });
  it("only admins are admins", () => {
    expect(isAdmin("admin")).toBe(true);
    expect(isAdmin("moderator")).toBe(false);
  });
  it("admin area is for staff only", () => {
    expect(canAccessAdminArea("user")).toBe(false);
    expect(canAccessAdminArea("moderator")).toBe(true);
  });
  it("role changes: admin only, never on yourself", () => {
    expect(canChangePlatformRole({ actorRole: "admin", actorId: "a", targetId: "b" })).toBe(true);
    expect(canChangePlatformRole({ actorRole: "admin", actorId: "a", targetId: "a" })).toBe(false);
    expect(canChangePlatformRole({ actorRole: "moderator", actorId: "a", targetId: "b" })).toBe(false);
    expect(canChangePlatformRole({ actorRole: "user", actorId: "a", targetId: "b" })).toBe(false);
  });
});

describe("startup member roles", () => {
  it("editing", () => {
    expect(canEditStartup("owner")).toBe(true);
    expect(canEditStartup("editor")).toBe(true);
    expect(canEditStartup("viewer")).toBe(false);
    expect(canEditStartup(null)).toBe(false);
  });
  it("publishing and team management are owner/admin only", () => {
    for (const fn of [canPublishStartup, canManageTeam]) {
      expect(fn("owner")).toBe(true);
      expect(fn("admin")).toBe(true);
      expect(fn("editor")).toBe(false);
      expect(fn("viewer")).toBe(false);
    }
  });
  it("inquiries visible to editors and above", () => {
    expect(canViewInquiries("editor")).toBe(true);
    expect(canViewInquiries("viewer")).toBe(false);
  });
  it("enforces the complete company capability matrix", () => {
    const roles = ["owner", "admin", "editor", "viewer", null] as const;
    const expected = {
      owner: [true, true, true],
      admin: [true, true, true],
      editor: [true, false, false],
      viewer: [false, false, false],
      null: [false, false, false],
    } as const;
    for (const role of roles) {
      const key = role ?? "null";
      expect([canEditStartup(role), canPublishStartup(role), canManageTeam(role)]).toEqual(expected[key]);
    }
  });
  it("cannot escalate: nobody can grant owner; admins cannot grant admin", () => {
    expect(assignableMemberRoles("owner")).not.toContain("owner");
    expect(assignableMemberRoles("admin")).toEqual(["editor", "viewer"]);
    expect(canAssignMemberRole("admin", "admin")).toBe(false);
    expect(canAssignMemberRole("editor", "viewer")).toBe(false);
    expect(canAssignMemberRole(null, "viewer")).toBe(false);
    expect(canAssignMemberRole("owner", "owner")).toBe(false);
  });
});

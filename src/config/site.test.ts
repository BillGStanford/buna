import { describe, expect, it } from "vitest";
import { dashboardNavFor } from "./site";

describe("dashboard navigation", () => {
  const roles = [
    "Founder / Co-founder",
    "Entrepreneur / Aspiring founder",
    "Investor",
    "Student",
    "Developer",
    "Other",
  ];

  it.each(roles)("shows startup and launch tools to %s accounts", (role) => {
    const hrefs = dashboardNavFor(role).map((item) => item.href);
    expect(hrefs).toContain("/dashboard/startup");
    expect(hrefs).toContain("/dashboard/launches");
  });

  it("keeps founder-only management tools role-specific", () => {
    expect(dashboardNavFor("Student").map((item) => item.href)).not.toContain("/dashboard/inquiries");
    expect(dashboardNavFor("Founder / Co-founder").map((item) => item.href)).toContain("/dashboard/inquiries");
  });

  it("preserves investor-specific navigation", () => {
    const hrefs = dashboardNavFor("Investor").map((item) => item.href);
    expect(hrefs).toContain("/dashboard/investor-portal");
    expect(hrefs).toContain("/startups");
    expect(hrefs).toContain("/opportunities");
  });
});

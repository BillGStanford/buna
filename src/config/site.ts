/** Site-wide configuration and navigation map. */
export const operatorName = process.env.NEXT_PUBLIC_OPERATOR_NAME?.trim() || "the Buna team";
export const siteConfig = {
  name: "Buna",
  tagline: "Discover startups. Meet founders. Build together.",
  description: "Buna connects African startups, founders and investors through startup discovery, company intelligence, launches, community and co-founder connections.",
};
export const TERMS_VERSION = "2026-10-20";
export type NavItem = { label: string; href: string; available: boolean };

export const primaryNav: NavItem[] = [
  { label: "Startups", href: "/startups", available: true },
  { label: "Investors", href: "/investor", available: true },
  { label: "Community", href: "/community", available: true },
  { label: "Founders", href: "/founders", available: true },
  { label: "Ecosystem", href: "/ecosystem", available: true },
  { label: "Launches", href: "/launches", available: true },
  { label: "Co-Founder Discovery", href: "/cofounders", available: true },
  { label: "Opportunities", href: "/opportunities", available: true },
  { label: "About", href: "/about", available: true },
];

const accountNav: NavItem[] = [
  { label: "Activity", href: "/dashboard/activity", available: true },
  { label: "Following", href: "/dashboard/following", available: true },
  { label: "Saved", href: "/dashboard/saved", available: true },
  { label: "Referrals & rewards", href: "/dashboard/referrals", available: true },
  { label: "Notifications", href: "/dashboard/notifications", available: true },
  { label: "Profile", href: "/dashboard/profile", available: true },
  { label: "Security", href: "/dashboard/security", available: true },
  { label: "Settings", href: "/dashboard/settings", available: true },
];

const investorDesk: NavItem = { label: "Investor Desk", href: "/dashboard/investor", available: true };

export function dashboardNavFor(role: string | null, hasInvestorAccess: boolean): NavItem[] {
  const overview: NavItem = { label: "Overview", href: "/dashboard", available: true };
  const investorPortal: NavItem = { label: "Investor Portal", href: "/dashboard/investor-portal", available: true };
  if (role === "Investor") {
    return [overview, investorPortal, { ...investorDesk, available: hasInvestorAccess },
      { label: "Discover startups", href: "/startups", available: true },
      { label: "Opportunities", href: "/opportunities", available: true },
      ...accountNav.filter((item) => item.href !== "/dashboard/referrals")];
  }
  if (role === "Founder / Co-founder" || role === "Entrepreneur / Aspiring founder") {
    return [overview,
      { label: "My startups", href: "/dashboard/startup", available: true },
      { label: "My launches", href: "/dashboard/launches", available: true },
      { label: "Inquiries", href: "/dashboard/inquiries", available: true },
      { label: "Co-Founder Discovery", href: "/cofounders", available: true },
      investorPortal,
      { ...investorDesk, available: hasInvestorAccess },
      { label: "Opportunities", href: "/opportunities", available: true },
      ...accountNav];
  }
  return [overview, investorPortal, { ...investorDesk, available: hasInvestorAccess },
    { label: "Discover startups", href: "/startups", available: true },
    { label: "Opportunities", href: "/opportunities", available: true },
    ...accountNav.filter((item) => item.href !== "/dashboard/referrals")];
}

export const availableNav = (items: NavItem[]) => items.filter((item) => item.available);

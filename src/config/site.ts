/**
 * Site-wide configuration and the navigation map.
 * Each link has an `available` flag: only routes that exist in the current build are shown,
 * so nothing in the UI is ever a dead link. Later phases flip flags as routes ship.
 */
/** Who operates the site, as named in the legal pages. Set NEXT_PUBLIC_OPERATOR_NAME before launch (see README). */
export const operatorName = process.env.NEXT_PUBLIC_OPERATOR_NAME?.trim() || "the Buna team";

export const siteConfig = {
  name: "Buna",
  tagline: "Discover African startups. Build connections. Grow together.",
  description:
    "Buna is a home for African technology startups and founders: showcase products, get discovered by customers, investors and collaborators, and find opportunities.",
};

/** Bump when the Terms or Privacy Policy change in a way people must re-accept. Recorded at signup. */
export const TERMS_VERSION = "2026-10-20";

export type NavItem = { label: string; href: string; available: boolean };

export const primaryNav: NavItem[] = [
  { label: "Discover", href: "/startups", available: true },
  { label: "Launches", href: "/launches", available: true },
  { label: "Community", href: "/community", available: true },
  { label: "Opportunities", href: "/opportunities", available: true }, // phase 4
  { label: "Founders", href: "/founders", available: true },
  { label: "About", href: "/about", available: true },
];

export const dashboardNav: NavItem[] = [
  { label: "Overview", href: "/dashboard", available: true },
  { label: "Activity feed", href: "/dashboard/activity", available: true },
  { label: "Community board", href: "/community", available: true },
  { label: "Investor Mode", href: "/dashboard/investor", available: true },
  { label: "Profile", href: "/dashboard/profile", available: true },
  { label: "Security", href: "/dashboard/security", available: true },
  { label: "Settings", href: "/dashboard/settings", available: true },
  { label: "My startups", href: "/dashboard/startup", available: true },
  { label: "My launches", href: "/dashboard/launches", available: true },
  { label: "Following", href: "/dashboard/following", available: true },
  { label: "Inquiries", href: "/dashboard/inquiries", available: true },
  { label: "Saved", href: "/dashboard/saved", available: true },
  { label: "Notifications", href: "/dashboard/notifications", available: true },
];

export const availableNav = (items: NavItem[]) => items.filter((i) => i.available);

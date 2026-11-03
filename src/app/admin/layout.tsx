import type { Metadata } from "next";
import { SubNav } from "@/components/dashboard/sub-nav";
import { requireStaff } from "@/lib/auth/session";
import { isAdmin } from "@/lib/permissions";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

/** Server-side gate for the whole admin area: staff only (moderator or admin), not suspended. Admin-only pages re-check. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaff();
  const admin = isAdmin(staff.role);
  const items = [
    { label: "Overview", href: "/admin", exact: true }, { label: "Reports", href: "/admin/reports" }, { label: "Startups", href: "/admin/startups" },
    { label: "Launches", href: "/admin/launches" }, { label: "Opportunities", href: "/admin/opportunities" }, { label: "Investors", href: "/admin/investors" }, { label: "Investor applications", href: "/admin/investor-applications" },
    { label: "Users", href: "/admin/users" }, { label: "Messages", href: "/admin/messages" }, { label: "Featured", href: "/admin/featured" },
    ...(admin ? [{ label: "Verification", href: "/admin/verification" }, { label: "Categories", href: "/admin/categories" }, { label: "Audit log", href: "/admin/audit" }, { label: "Settings", href: "/admin/settings" }] : []),
  ];
  return (
    <div className="container-page space-y-6 py-8">
      <SubNav label="Admin sections" items={items} />
      {children}
    </div>
  );
}

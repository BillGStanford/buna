import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

/** Server-side gate for the whole admin area: staff only (moderator or admin), not suspended. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireStaff();
  return <div className="container-page py-8">{children}</div>;
}

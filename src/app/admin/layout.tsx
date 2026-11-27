import type { Metadata } from "next";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { requireStaff } from "@/lib/auth/session";
import { isAdmin } from "@/lib/permissions";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaff();
  const admin = isAdmin(staff.role);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-pale/60">
      <div className="mx-auto w-full max-w-[1920px] px-4 py-5 sm:px-6 lg:px-7 lg:py-7">
        <div className="mb-5 hidden items-end justify-between border-b border-line/80 pb-5 lg:flex">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Buna control room</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink">Administration</h1>
            <p className="mt-1 text-sm text-muted">Manage the platform, review activity and keep the ecosystem healthy.</p>
          </div>
          <div className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-semibold capitalize text-muted">{staff.role} access</div>
        </div>
        <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
          <AdminSidebar role={staff.role} />
          <div className="min-w-0 flex-1 rounded-2xl border border-line/80 bg-surface p-4 shadow-[0_8px_30px_rgba(23,43,36,0.035)] sm:p-6 lg:min-h-[calc(100vh-12rem)] lg:p-8">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

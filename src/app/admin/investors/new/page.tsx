import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardBody } from "@/components/ui/card";
import { InvestorForm } from "@/components/admin/investor-form";
import { requireStaff } from "@/lib/auth/session";
import { isAdmin } from "@/lib/permissions";
import { listCategories } from "@/lib/startups/queries";

export const metadata: Metadata = { title: "New investor" };

export default async function NewInvestorPage() {
  const staff = await requireStaff();
  const categories = await listCategories();
  return (
    <div className="max-w-3xl space-y-6">
      <div><p className="text-sm"><Link href="/admin/investors" className="font-medium">Investors</Link></p><h1 className="text-2xl font-bold">New investor listing</h1><p className="mt-1 text-sm text-muted">Only publicly stated information. Never invent fund sizes, portfolio companies, cheque sizes or track records.</p></div>
      <Card><CardBody className="py-6"><InvestorForm categories={categories} canVerify={isAdmin(staff.role)} /></CardBody></Card>
    </div>
  );
}

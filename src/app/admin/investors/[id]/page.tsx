import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardBody } from "@/components/ui/card";
import { InvestorServerForm } from "@/components/admin/investor-server-form";
import { requireStaff } from "@/lib/auth/session";
import { isAdmin } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { listCategories } from "@/lib/startups/queries";
import type { InvestorData } from "@/lib/people/queries";
import { uuidField } from "@/lib/validation/startup";

export const metadata: Metadata = { title: "Edit investor" };

export default async function EditInvestorPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (!uuidField.safeParse(id).success) notFound();
  const staff = await requireStaff();
  const supabase = await createClient();
  const { data } = await supabase.from("investors").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const categories = await listCategories();
  const i = data as InvestorData;
  return (
    <div className="max-w-3xl space-y-6">
      <div><p className="text-sm"><Link href="/admin/investors" className="font-medium">Investors</Link></p><h1 className="text-2xl font-bold">{i.name}</h1><p className="mt-1 text-sm"><Link href={`/investors/${i.slug}`}>View public page</Link></p></div>
      <Card><CardBody className="py-6"><InvestorServerForm investor={i} categories={categories} canVerify={isAdmin(staff.role)} error={query.error === "1"} /></CardBody></Card>
    </div>
  );
}

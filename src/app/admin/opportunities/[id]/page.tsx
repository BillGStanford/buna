import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardBody } from "@/components/ui/card";
import { OpportunityForm } from "@/components/admin/opportunity-form";
import { getForAdmin } from "@/lib/opportunities/queries";
import { uuidField } from "@/lib/validation/startup";

export const metadata: Metadata = { title: "Edit opportunity" };

export default async function EditOpportunityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuidField.safeParse(id).success) notFound();
  const o = await getForAdmin(id);
  if (!o) notFound();
  return (
    <div className="max-w-3xl space-y-6">
      <div><p className="text-sm"><Link href="/admin/opportunities" className="font-medium">Opportunities</Link></p><h1 className="text-2xl font-bold">{o.title}</h1><p className="mt-1 text-sm"><Link href={`/opportunities/${o.slug}`}>View public page</Link></p></div>
      <Card><CardBody className="py-6"><OpportunityForm opportunity={o} /></CardBody></Card>
    </div>
  );
}

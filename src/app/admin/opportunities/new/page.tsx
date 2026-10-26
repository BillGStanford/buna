import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardBody } from "@/components/ui/card";
import { OpportunityForm } from "@/components/admin/opportunity-form";

export const metadata: Metadata = { title: "New opportunity" };

export default function NewOpportunityPage() {
  return (
    <div className="max-w-3xl space-y-6">
      <div><p className="text-sm"><Link href="/admin/opportunities" className="font-medium">Opportunities</Link></p><h1 className="text-2xl font-bold">New opportunity</h1><p className="mt-1 text-sm text-muted">Only add programmes you can source. Never invent deadlines, amounts or partnerships.</p></div>
      <Card><CardBody className="py-6"><OpportunityForm /></CardBody></Card>
    </div>
  );
}

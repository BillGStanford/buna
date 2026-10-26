import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card, CardBody } from "@/components/ui/card";
import { ProductsManager } from "@/components/startups/manage/products-manager";
import { requireProfile } from "@/lib/auth/session";
import { getManagedChildren, getManagedStartup } from "@/lib/startups/queries";

export const metadata: Metadata = { title: "Products" };

export default async function ProductsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireProfile(`/dashboard/startup/${id}/products`);
  if (!(await getManagedStartup(id, profile.id))) notFound();
  const { products } = await getManagedChildren(id);
  return (
    <Card><CardBody className="space-y-4 py-6">
      <div><h2 className="text-lg font-semibold">Products and services</h2><p className="text-sm text-muted">What you offer. Shown on your public profile.</p></div>
      <ProductsManager startupId={id} products={products} />
    </CardBody></Card>
  );
}

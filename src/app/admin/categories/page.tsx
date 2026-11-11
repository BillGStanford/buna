import type { Metadata } from "next";
import { Card, CardBody } from "@/components/ui/card";
import { CategoryForm } from "@/components/admin/category-form";
import { requireAdmin } from "@/lib/auth/session";
import { listAllCategories } from "@/lib/admin/queries";

export const metadata: Metadata = { title: "Categories (admin)" };

export default async function AdminCategoriesPage() {
  await requireAdmin();
  const cats = await listAllCategories();
  return (
    <div className="space-y-6">
      <div><h1 className="text-3xl font-semibold tracking-tight">Categories</h1><p className="mt-1 max-w-2xl text-sm text-muted">Sectors used across startups, launches and filters. Categories are deactivated, never deleted, so existing startups and launches keep their reference. Changing a slug changes filter links.</p></div>
      <Card><CardBody><h2 className="mb-3 font-semibold">New category</h2><CategoryForm /></CardBody></Card>
      <ul className="space-y-3">{cats.map((c) => <li key={c.id}><Card><CardBody><CategoryForm category={c} /></CardBody></Card></li>)}</ul>
    </div>
  );
}

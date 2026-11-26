import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { PlatformTagForm } from "@/components/admin/platform-tag-form";

export const metadata: Metadata = { title: "Tags (admin)", robots: { index: false } };

type PlatformTag = { id: string; name: string; slug: string; description: string | null; is_active: boolean };

export default async function AdminTagsPage() {
  await requireAdmin();
  const admin = createAdminClient();
  const { data, error } = await admin.from("platform_tags")
    .select("id,name,slug,description,is_active")
    .order("is_active", { ascending: false })
    .order("name");
  if (error) throw new Error("Could not load the platform tag catalogue.");
  const tags = (data ?? []) as PlatformTag[];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Tags</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">Maintain Buna’s shared tag vocabulary. Deactivate tags instead of deleting them so existing references remain meaningful. Every change is recorded in the audit log.</p>
      </header>
      <section className="space-y-3"><h2 className="text-lg font-semibold">Create a tag</h2><PlatformTagForm /></section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Existing tags <span className="text-sm font-normal text-muted">({tags.length})</span></h2>
        {tags.length ? tags.map((tag) => <PlatformTagForm key={tag.id} tag={tag} />) : <p className="rounded-lg border border-dashed border-line p-6 text-sm text-muted">No tags have been created.</p>}
      </section>
    </div>
  );
}

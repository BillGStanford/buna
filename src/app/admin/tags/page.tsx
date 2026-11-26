import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { savePlatformTagAction } from "./actions";

export const metadata: Metadata = { title: "Tags (admin)", robots: { index: false } };

type PlatformTag = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_active: boolean;
};

function TagForm({ tag }: { tag?: PlatformTag }) {
  return (
    <form action={savePlatformTagAction} className="grid gap-3 rounded-lg border border-line p-4 sm:grid-cols-2">
      <input type="hidden" name="tagId" value={tag?.id ?? ""} />
      <label className="text-sm font-medium">Tag name
        <input name="name" required minLength={2} maxLength={48} defaultValue={tag?.name ?? ""} placeholder="Financial inclusion" className="mt-1 h-10 w-full rounded-md border border-line bg-surface px-3" />
      </label>
      <label className="text-sm font-medium">Slug
        <input name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={60} defaultValue={tag?.slug ?? ""} placeholder="financial-inclusion" className="mt-1 h-10 w-full rounded-md border border-line bg-surface px-3" />
      </label>
      <label className="text-sm font-medium sm:col-span-2">Description
        <input name="description" maxLength={240} defaultValue={tag?.description ?? ""} className="mt-1 h-10 w-full rounded-md border border-line bg-surface px-3" />
      </label>
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input type="checkbox" name="isActive" value="true" defaultChecked={tag?.is_active ?? true} />
        Active and available for use
      </label>
      <div className="sm:col-span-2"><button className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white">{tag ? "Save tag" : "Create tag"}</button></div>
    </form>
  );
}

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
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Create a tag</h2>
        <TagForm />
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Existing tags <span className="text-sm font-normal text-muted">({tags.length})</span></h2>
        {tags.length ? tags.map((tag) => <TagForm key={tag.id} tag={tag} />) : <p className="rounded-lg border border-dashed border-line p-6 text-sm text-muted">No tags have been created.</p>}
      </section>
    </div>
  );
}

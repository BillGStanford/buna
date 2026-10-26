import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Investors (admin)" };

export default async function AdminInvestorsPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("investors").select("id, slug, name, verification_status, is_published, is_demo, updated_at").order("updated_at", { ascending: false }).limit(200);
  const rows = (data ?? []) as { id: string; slug: string; name: string; verification_status: string; is_published: boolean; is_demo: boolean }[];
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm"><Link href="/admin" className="font-medium">Admin</Link></p><h1 className="text-2xl font-bold">Investors</h1></div><Link href="/admin/investors/new" className={buttonStyles("primary", "md")}><Plus className="h-4 w-4" aria-hidden="true" />New listing</Link></div>
      <ul className="divide-y divide-line rounded-lg border border-line">
        {rows.map((i) => <li key={i.id} className="flex flex-wrap items-center gap-3 p-4"><Link href={`/admin/investors/${i.id}`} className="min-w-0 flex-1 font-medium">{i.name}</Link>{i.is_demo ? <Badge tone="warning">demo</Badge> : null}<Badge tone={i.is_published ? "green" : "neutral"}>{i.is_published ? "published" : "unpublished"}</Badge><Badge tone={i.verification_status === "verified" ? "green" : "neutral"}>{i.verification_status}</Badge></li>)}
        {rows.length === 0 ? <li className="p-6 text-center text-sm text-muted">No investors yet.</li> : null}
      </ul>
    </div>
  );
}

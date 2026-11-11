import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { MessageControls } from "@/components/admin/message-controls";
import { EmptyState } from "@/components/illustrations";
import { formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Contact inbox" };

export default async function AdminMessagesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const status = ["new", "handled", "spam"].includes(sp.status ?? "") ? sp.status! : "new";
  const supabase = await createClient();
  const { data } = await supabase.from("platform_messages").select("id, sender_name, sender_email, topic, message, status, created_at").eq("status", status).order("created_at", { ascending: false }).limit(100);
  const rows = (data ?? []) as { id: string; sender_name: string; sender_email: string; topic: string; message: string; status: string; created_at: string }[];
  return (
    <div className="space-y-6">
      <div><p className="text-sm"><Link href="/admin" className="font-medium">Admin</Link></p><h1 className="text-3xl font-semibold tracking-tight">Contact inbox</h1><p className="mt-1 text-sm text-muted">Messages sent through the contact page. Reply by email from your own mailbox.</p></div>
      <nav aria-label="Message status" className="flex gap-3 text-sm">{["new", "handled", "spam"].map((s) => <Link key={s} href={`/admin/messages?status=${s}`} aria-current={status === s ? "page" : undefined} className={status === s ? "font-semibold text-ink" : "text-muted"}>{s}</Link>)}</nav>
      {rows.length === 0 ? <EmptyState illustration="inbox" title={`No ${status} messages`} /> : (
        <ul className="space-y-3">{rows.map((m) => (
          <li key={m.id} className="rounded-xl border border-line bg-surface p-5">
            <div className="flex flex-wrap items-center gap-2"><strong>{m.sender_name}</strong><a href={`mailto:${m.sender_email}`} className="text-sm">{m.sender_email}</a><Badge>{m.topic}</Badge><span className="text-xs text-muted"><time dateTime={m.created_at}>{formatDateTime(m.created_at)}</time></span></div>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm">{m.message}</p>
            <div className="mt-3"><MessageControls messageId={m.id} status={m.status} /></div>
          </li>
        ))}</ul>
      )}
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth/session";
import { getInvestorPortal } from "@/lib/investors/queries";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Startup data rooms", robots: { index: false } };
type RoomDocument = { id: string; name: string; document_type: string; storage_path: string; signedUrl: string | null };

export default async function InvestorDataRoomsPage() {
  const profile = await requireProfile("/dashboard/investor/data-rooms");
  const { investor } = await getInvestorPortal(profile.id);
  if (!investor) redirect("/dashboard/investor");
  const supabase = await createClient();
  const { data, error } = await supabase.from("startup_document_access_requests")
    .select("id,startup_id,status,created_at,startup:startups(name,slug)")
    .eq("investor_id", investor.id).order("created_at", { ascending: false });
  if (error) throw error;
  const rows: Array<{ id: string; startup_id: string; status: string; name: string; slug: string; documents: RoomDocument[] }> = [];
  for (const request of data ?? []) {
    const startup = Array.isArray(request.startup) ? request.startup[0] : request.startup;
    if (!startup) continue;
    let documents: RoomDocument[] = [];
    if (request.status === "approved") {
      const { data: docs } = await supabase.from("startup_documents")
        .select("id,name,document_type,storage_path").eq("startup_id", request.startup_id);
      documents = await Promise.all((docs ?? []).map(async (document) => {
        const { data: signed } = await supabase.storage.from("startup-documents").createSignedUrl(document.storage_path, 600);
        return { ...document, signedUrl: signed?.signedUrl ?? null };
      }));
    }
    rows.push({ id: request.id, startup_id: request.startup_id, status: request.status, name: startup.name, slug: startup.slug, documents });
  }
  return (
    <div className="space-y-5">
      <header>
        <p className="text-sm text-muted"><Link href="/dashboard/investor">Investor workspace</Link></p>
        <h1 className="text-2xl font-bold">Startup data rooms</h1>
        <p className="mt-1 text-sm text-muted">Request access from a startup profile. Documents appear here only after the startup approves you; access does not mean you have agreed to invest.</p>
      </header>
      {rows.length ? (
        <ul className="space-y-3">
          {rows.map((room) => (
            <li key={room.id}>
              <Card><CardBody className="space-y-3">
                <div className="flex flex-wrap justify-between gap-2">
                  <h2 className="font-semibold"><Link href={"/startups/" + room.slug}>{room.name}</Link></h2>
                  <Badge tone={room.status === "approved" ? "green" : room.status === "pending" ? "warning" : "neutral"}>{room.status}</Badge>
                </div>
                {room.status === "approved" ? (
                  room.documents.length ? (
                    <ul className="space-y-2">
                      {room.documents.map((document) => <li key={document.id}>
                        {document.signedUrl ? <a className="text-sm font-medium underline" href={document.signedUrl} target="_blank" rel="noopener noreferrer">{document.name}</a> : <span className="text-sm">{document.name} (temporarily unavailable)</span>}
                        <span className="ml-2 text-xs text-muted">{document.document_type.replace(/_/g, " ")}</span>
                      </li>)}
                    </ul>
                  ) : <p className="text-sm text-muted">Access approved. The startup has not uploaded any documents yet.</p>
                ) : <p className="text-sm text-muted">You will be notified when the startup reviews your request.</p>}
              </CardBody></Card>
            </li>
          ))}
        </ul>
      ) : <p className="rounded-lg border border-line p-6 text-sm text-muted">You have not requested access to any startup data rooms yet. Explore startups and request access from their public profile.</p>}
    </div>
  );
}

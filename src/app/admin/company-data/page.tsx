import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { reviewCompanyClaimAction } from "./actions";

export const metadata: Metadata = { title: "Company data review", robots: { index: false } };
export default async function CompanyDataReviewPage() {
 await requireStaff();
 const supabase=await createClient();
 const {data,error}=await supabase.from("startup_data_claims")
  .select("id,startup_id,claim_type,claim_text,source_status,visibility,created_at,startup:startups(name,slug),evidence:startup_claim_evidence(id,evidence_url,description)")
  .in("source_status",["founder_reported","disputed"]).order("created_at",{ascending:true}).limit(100);
 if(error) throw error;
 return <div className="space-y-6"><header><h1 className="text-2xl font-bold">Company data review</h1><p className="mt-1 text-sm text-muted">Review founder-submitted claims and evidence. A company identity verification does not independently verify its financial or operating claims.</p></header>
 {data?.length?<div className="space-y-4">{data.map((claim)=>{const startup=Array.isArray(claim.startup)?claim.startup[0]:claim.startup;return <Card key={claim.id}><CardHeader><div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-semibold">{startup?.name??"Company"} · {claim.claim_type.replace("_"," ")}</h2><p className="text-xs text-muted">{new Date(claim.created_at).toLocaleString()} · {claim.visibility} visibility</p></div><Badge tone="warning">{claim.source_status.replace("_"," ")}</Badge></div></CardHeader><CardBody className="space-y-3"><p className="whitespace-pre-wrap text-sm">{claim.claim_text}</p>{claim.evidence?.length?<ul className="space-y-1 text-sm">{claim.evidence.map((e:any)=><li key={e.id}><a className="underline" href={e.evidence_url} target="_blank" rel="noreferrer">{e.description||e.evidence_url}</a></li>)}</ul>:<p className="text-xs text-muted">No supporting URL supplied.</p>}<form action={reviewCompanyClaimAction} className="flex flex-wrap items-end gap-2"><input type="hidden" name="claimId" value={claim.id}/><label className="text-sm">Review note (optional)<input name="reviewNote" maxLength={1000} className="mt-1 block rounded-md border border-line bg-canvas px-3 py-2"/></label><label className="text-sm">Review result<select name="status" defaultValue="verified" className="mt-1 block rounded-md border border-line bg-canvas px-3 py-2"><option value="verified">Verified</option><option value="publicly_reported">Publicly reported</option><option value="estimated">Estimated</option><option value="disputed">Disputed</option><option value="not_disclosed">Not disclosed</option></select></label><button className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white">Save review</button></form></CardBody></Card>})}</div>:<Card><CardBody className="py-8 text-center text-sm text-muted">No company claims are awaiting review.</CardBody></Card>}
 </div>;
}

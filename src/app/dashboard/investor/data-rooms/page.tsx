import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth/session";
import { getInvestorPortal } from "@/lib/investors/queries";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
export const metadata: Metadata = { title: "Startup data rooms", robots: { index: false } };
export default async function InvestorDataRoomsPage(){
 const profile=await requireProfile("/dashboard/investor/data-rooms"); const {investor}=await getInvestorPortal(profile.id); if(!investor) redirect("/dashboard/investor");
 const supabase=await createClient(); const {data,error}=await supabase.from("startup_document_access_requests").select("id,startup_id,status,created_at,startup:startups(name,slug)").eq("investor_id",investor.id).order("created_at",{ascending:false}); if(error) throw error;
 const rows=[] as Array<{id:string;startup_id:string;status:string;name:string;slug:string;documents:Array<{id:string;name:string;document_type:string;storage_path:string}>}>;
 for(const r of data??[]){const s=Array.isArray(r.startup)?r.startup[0]:r.startup;if(!s)continue;let documents:typeof rows[number]["documents"]=[];if(r.status==="approved"){const {data:docs}=await supabase.from("startup_documents").select("id,name,document_type,storage_path").eq("startup_id",r.startup_id);documents=docs??[];}rows.push({id:r.id,startup_id:r.startup_id,status:r.status,name:s.name,slug:s.slug,documents});}
 return <div className="space-y-5"><header><p className="text-sm text-muted"><Link href="/dashboard/investor">Investor workspace</Link></p><h1 className="text-2xl font-bold">Startup data rooms</h1><p className="mt-1 text-sm text-muted">Confidential materials are available only after the startup team approves your request.</p></header>
 {rows.length?<ul className="space-y-3">{rows.map(r=><li key={r.id}><Card><CardBody className="space-y-3"><div className="flex flex-wrap justify-between gap-2"><h2 className="font-semibold"><Link href={"/startups/"+r.slug}>{r.name}</Link></h2><Badge tone={r.status==="approved"?"green":r.status==="pending"?"warning":"neutral"}>{r.status}</Badge></div>{r.status==="approved"?r.documents.length?<ul className="space-y-2">{await Promise.all(r.documents.map(async d=>{const {data:signed}=await supabase.storage.from("startup-documents").createSignedUrl(d.storage_path,600);return <li key={d.id}><a className="text-sm font-medium underline" href={signed?.signedUrl??"#"} target="_blank" rel="noopener noreferrer">{d.name}</a><span className="ml-2 text-xs text-muted">{d.document_type.replace(/_/g," ")}</span></li>}))}</ul>:<p className="text-sm text-muted">Access approved. The startup has not uploaded any documents yet.</p>:<p className="text-sm text-muted">You will be notified when the startup reviews your request.</p>}</CardBody></Card></li>)}</ul>:<p className="rounded-lg border border-line p-6 text-sm text-muted">You have not requested access to any startup data rooms yet. Explore startups and request access from their public profile.</p>}</div>;
}
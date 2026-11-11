"use client";
import {useState} from "react";
import {createClient} from "@/lib/supabase/client";

export function WorkFileUpload({contractId,fieldName,label,accept="application/pdf,image/jpeg,image/png,image/webp,application/zip,text/plain"}:{
 contractId:string;fieldName:string;label:string;accept?:string;
}){
 const [path,setPath]=useState(""),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 async function upload(file?:File){
  if(!file)return;
  if(file.size>15*1024*1024){setMessage("Files must be 15 MB or smaller.");return;}
  setBusy(true);setMessage("Uploading securely…");setPath("");
  try{
   const supabase=createClient(),{data:{user}}=await supabase.auth.getUser();
   if(!user){setMessage("Sign in again before uploading.");return;}
   const safeName=file.name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g,"_").slice(-90)||"attachment";
   const objectPath=contractId+"/"+user.id+"/"+crypto.randomUUID()+"-"+safeName;
   const {error}=await supabase.storage.from("work-deliverables").upload(objectPath,file,{cacheControl:"3600",upsert:false,contentType:file.type});
   if(error){setMessage("Upload failed. Check the file type and try again.");return;}
   setPath(objectPath);setMessage("Uploaded: "+file.name);
  }catch{setMessage("Upload failed. Please try again.");}
  finally{setBusy(false);}
 }
 return <div className="space-y-1.5"><label className="block text-sm font-medium">{label}<input type="file" accept={accept} disabled={busy} onChange={e=>upload(e.target.files?.[0])} className="mt-1 block w-full rounded-md border border-line bg-surface px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary-pale file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-primary-deep"/></label><input type="hidden" name={fieldName} value={path}/><p aria-live="polite" className="text-xs text-muted">{message||"Private contract attachment · PDF, images, ZIP or text · 15 MB maximum"}</p></div>;
}

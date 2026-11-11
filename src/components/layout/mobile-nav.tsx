"use client";
import * as React from "react";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {Menu,X} from "lucide-react";
import {Button,buttonStyles} from "@/components/ui/button";
import type {NavItem} from "@/config/site";
export function MobileNav({items,signedIn}:{items:NavItem[];signedIn:boolean}){
 const [open,setOpen]=React.useState(false),pathname=usePathname(),panelId=React.useId();
 React.useEffect(()=>{setOpen(false)},[pathname]);
 React.useEffect(()=>{if(!open)return;const onKey=(e:KeyboardEvent)=>{if(e.key==="Escape")setOpen(false)};document.addEventListener("keydown",onKey);return()=>document.removeEventListener("keydown",onKey)},[open]);
 return <div className="xl:hidden">
  <Button variant="ghost" size="sm" aria-expanded={open} aria-controls={panelId} aria-label={open?"Close menu":"Open menu"} onClick={()=>setOpen(o=>!o)} className="px-2">{open?<X className="h-5 w-5" aria-hidden="true"/>:<Menu className="h-5 w-5" aria-hidden="true"/>}</Button>
  {open?<div id={panelId} className="absolute inset-x-0 top-full border-b border-line bg-surface shadow-lg"><nav aria-label="Mobile" className="container-page grid gap-1 py-3 sm:grid-cols-2">
   {items.map(item=>{const active=pathname===item.href||pathname.startsWith(item.href+"/");return <Link key={item.href} href={item.href} aria-current={active?"page":undefined} className={`rounded-md border px-3 py-2.5 text-sm font-medium no-underline ${active?"border-line bg-primary-pale text-primary-deep":"border-transparent text-ink hover:border-line hover:bg-surface-subtle"}`}>{item.label}</Link>})}
   {!signedIn?<div className="col-span-full mt-2 grid grid-cols-2 gap-2 border-t border-line pt-3"><Link href="/login" className={buttonStyles("secondary","md")}>Sign in</Link><Link href="/signup" className={buttonStyles("primary","md")}>Create account</Link></div>:null}
  </nav></div>:null}
 </div>;
}

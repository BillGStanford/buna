"use client";
import Link from "next/link";
import {usePathname} from "next/navigation";
import type {NavItem} from "@/config/site";
export function PrimaryNav({items}:{items:NavItem[]}){
 const pathname=usePathname();
 return <nav aria-label="Primary" className="hidden items-center gap-1 xl:flex">
  {items.map(item=>{const active=pathname===item.href||pathname.startsWith(item.href+"/");return <Link key={item.href} href={item.href} aria-current={active?"page":undefined} className={`rounded-md border px-3 py-2 text-[13px] font-medium no-underline transition-colors ${active?"border-line bg-primary-pale text-primary-deep":"border-transparent text-muted hover:border-line hover:bg-surface-subtle hover:text-ink"}`}>{item.label}</Link>;})}
 </nav>;
}

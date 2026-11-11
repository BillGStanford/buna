"use client";
import Link from "next/link";
import {usePathname} from "next/navigation";
const items=[
 {label:"Overview",href:"/dashboard/work"},
 {label:"My projects",href:"/dashboard/work/projects"},
 {label:"Proposals",href:"/dashboard/work/proposals"},
 {label:"Invitations",href:"/dashboard/work/invitations"},
 {label:"Contracts",href:"/dashboard/work/contracts"},
 {label:"Freelancer profile",href:"/dashboard/work/profile"},
];
export function WorkNavigation(){
 const pathname=usePathname();
 return <nav aria-label="Work workspace" className="mb-6 flex flex-wrap gap-1 border-b border-line pb-2">
  {items.map(item=>{const active=pathname===item.href||(item.href!=="/dashboard/work"&&pathname.startsWith(item.href+"/"));return <Link key={item.href} href={item.href} aria-current={active?"page":undefined} className={"rounded-md px-3 py-2 text-sm font-medium no-underline transition-colors "+(active?"border border-line bg-surface text-ink":"text-muted hover:bg-surface-subtle hover:text-ink")}>{item.label}</Link>;})}
 </nav>;
}

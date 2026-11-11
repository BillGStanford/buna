import Link from "next/link";
import { Card,CardBody } from "@/components/ui/card";

export type WorkProjectSummary={id:string;slug:string;title:string;summary:string;category:string;skills:string[];budget_min:number;budget_max:number;currency:string;experience_level:string;work_location:string;created_at:string};

const money=(n:number,currency="ETB")=>new Intl.NumberFormat("en-ET",{style:"currency",currency,maximumFractionDigits:0}).format(n);
export function WorkProjectCard({project}:{project:WorkProjectSummary}){
 return <Card className="h-full"><CardBody className="flex h-full flex-col gap-3 p-5">
  <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-semibold uppercase tracking-wide text-primary-deep">{project.category}</span><span className="text-xs text-muted">{project.work_location==="remote"?"Remote":project.work_location==="hybrid"?"Hybrid":"On-site"}</span></div>
  <div><h3 className="text-base font-semibold"><Link href={`/work/projects/${project.slug}`} className="text-ink no-underline hover:underline">{project.title}</Link></h3><p className="mt-1 text-sm leading-6 text-muted">{project.summary}</p></div>
  <div className="flex flex-wrap gap-1.5">{project.skills.slice(0,5).map(s=><span key={s} className="rounded-md border border-line px-2 py-1 text-xs text-muted">{s}</span>)}</div>
  <div className="mt-auto flex items-center justify-between border-t border-line pt-3 text-sm"><span className="font-semibold tabular-nums">{money(project.budget_min,project.currency)} – {money(project.budget_max,project.currency)}</span><span className="text-xs text-muted capitalize">{project.experience_level}</span></div>
 </CardBody></Card>;
}

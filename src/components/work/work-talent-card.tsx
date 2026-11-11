import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Card,CardBody } from "@/components/ui/card";

export type WorkTalentSummary={user_id:string;headline:string;bio:string;skills:string[];experience_level:string;hourly_rate:number|null;availability:string;username:string;display_name:string;avatar_url:string|null;country:string|null;city:string|null};
export function WorkTalentCard({person}:{person:WorkTalentSummary}){
 return <Card><CardBody className="flex gap-4 p-5"><Avatar name={person.display_name} src={person.avatar_url} size={52}/><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold"><Link href={`/work/talent/${person.username}`} className="text-ink no-underline hover:underline">{person.display_name}</Link></h3><span className="text-xs capitalize text-primary-deep">{person.availability.replace("_"," ")}</span></div><p className="mt-1 text-sm">{person.headline}</p><p className="mt-1 line-clamp-2 text-sm text-muted">{person.bio}</p><div className="mt-3 flex flex-wrap gap-1.5">{person.skills.slice(0,6).map(s=><span key={s} className="rounded-md border border-line px-2 py-1 text-xs text-muted">{s}</span>)}</div><p className="mt-3 text-xs text-muted">{[person.city,person.country].filter(Boolean).join(", ")}{person.hourly_rate? ` · ETB ${Number(person.hourly_rate).toLocaleString()}/hr`:""}</p></div></CardBody></Card>;
}

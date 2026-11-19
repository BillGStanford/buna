import {NextRequest,NextResponse} from "next/server";
import {z} from "zod";
import {createAdminClient} from "@/lib/supabase/admin";
import {clientIp,rateLimit} from "@/lib/rate-limit";
export const runtime="nodejs"; export const dynamic="force-dynamic";
const schema=z.object({visitorId:z.string().uuid(),sessionId:z.string().uuid(),path:z.string().max(180).startsWith("/").refine(v=>!v.includes("?")&&!v.includes("#")),referrerDomain:z.string().max(180).nullable().optional(),utmSource:z.string().max(80).nullable().optional(),campaign:z.string().max(120).nullable().optional(),deviceType:z.enum(["mobile","desktop","tablet","unknown"]).default("unknown")});
function clean(v?:string|null){if(!v)return null;try{const h=new URL(v.includes("://")?v:`https://${v}`).hostname.toLowerCase().replace(/^www\./,"");return /^[a-z0-9.-]{1,180}$/.test(h)?h:null}catch{return null}}
function source(utm?:string|null,ref?:string|null){const u=(utm||"").toLowerCase().trim();if(u&&/^[a-z0-9_-]{1,80}$/.test(u))return u;if(!ref)return"direct";if(/reddit\./.test(ref))return"reddit";if(/producthunt\./.test(ref))return"producthunt";if(/linkedin\./.test(ref))return"linkedin";if(/facebook\.|instagram\./.test(ref))return"meta";if(/google\./.test(ref))return"google";if(/x\.com|twitter\./.test(ref))return"x";return"referral"}
export async function POST(req:NextRequest){
 const origin=req.headers.get("origin");try{if(!origin||new URL(origin).host!==req.nextUrl.host)return NextResponse.json({ok:false},{status:403})}catch{return NextResponse.json({ok:false},{status:403})}
 const p=schema.safeParse(await req.json().catch(()=>null));if(!p.success)return NextResponse.json({ok:false},{status:400});const e=p.data;
 if(/^\/(admin|dashboard|onboarding|auth|api)(\/|$)/.test(e.path)||/bot|crawler|spider|preview|headless/i.test(req.headers.get("user-agent")||""))return NextResponse.json({ok:true});
 const ip=await clientIp();const [a,b]=await Promise.all([rateLimit(`platform-analytics:visitor:${e.visitorId}`,120,3600),ip==="unknown"?Promise.resolve(true):rateLimit(`platform-analytics:ip:${ip}`,600,3600)]);if(!a||!b)return NextResponse.json({ok:false},{status:429});
 try{
  const db=createAdminClient(),ref=clean(e.referrerDomain),country=(req.headers.get("x-vercel-ip-country")||"").toUpperCase(),cc=/^[A-Z]{2}$/.test(country)?country:"ZZ";
  const {data:old}=await db.from("platform_analytics_visitors").select("first_source,first_campaign,first_referrer_domain").eq("visitor_id",e.visitorId).maybeSingle();
  const {error}=await db.from("platform_analytics_events").insert({event_type:"page_view",visitor_id:e.visitorId,session_id:e.sessionId,path:e.path,source:old?.first_source??source(e.utmSource,ref),campaign:old?.first_campaign??e.campaign?.replace(/[^a-zA-Z0-9 _.-]/g,"").slice(0,120)||null,referrer_domain:old?.first_referrer_domain??ref,country_code:cc,device_type:e.deviceType});
  if(error)throw error;
  if(e.path.startsWith("/launches/")) {
   const launchEvent=await db.from("platform_analytics_events").insert({event_type:"launch_view",visitor_id:e.visitorId,session_id:e.sessionId,path:e.path,source:old?.first_source??source(e.utmSource,ref),campaign:e.campaign?.replace(/[^a-zA-Z0-9 _.-]/g,"").slice(0,120)||null,referrer_domain:ref,country_code:cc,device_type:e.deviceType});
   if(launchEvent.error) throw launchEvent.error;
  }
  const res=NextResponse.json({ok:true},{headers:{"Cache-Control":"no-store"}});
  res.cookies.set("buna_session_id",e.sessionId,{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/",maxAge:86400});
  res.cookies.set("buna_visitor_id",e.visitorId,{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/",maxAge:60*60*24*395});return res;
 }catch{return NextResponse.json({ok:false},{status:503})}
}
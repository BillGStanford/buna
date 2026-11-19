"use client";
import {useEffect} from "react";
import {usePathname} from "next/navigation";
export function PlatformAnalyticsTracker({enabled=true}:{enabled?:boolean}){
 const pathname=usePathname();
 useEffect(()=>{if(!enabled)return;const n=navigator as Navigator&{globalPrivacyControl?:boolean};if(n.doNotTrack==="1"||n.globalPrivacyControl===true||/bot|crawler|spider|preview|headless/i.test(n.userAgent))return;
 let visitorId:string,sessionId:string;try{visitorId=localStorage.getItem("buna_visitor_id")||crypto.randomUUID();localStorage.setItem("buna_visitor_id",visitorId);sessionId=sessionStorage.getItem("buna_session_id")||crypto.randomUUID();sessionStorage.setItem("buna_session_id",sessionId)}catch{return}
 const p=new URLSearchParams(location.search);let referrerDomain:string|null=null;try{referrerDomain=document.referrer?new URL(document.referrer).hostname:null}catch{}
 void fetch("/api/analytics/site-event",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",keepalive:true,body:JSON.stringify({visitorId,sessionId,path:pathname.slice(0,180),referrerDomain,utmSource:p.get("utm_source"),campaign:p.get("utm_campaign"),deviceType:/ipad|tablet/i.test(n.userAgent)?"tablet":/mobile|android|iphone/i.test(n.userAgent)?"mobile":"desktop"})}).catch(()=>undefined);
 },[enabled,pathname]);return null;
}
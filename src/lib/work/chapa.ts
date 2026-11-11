import "server-only";
export type ChapaBank={bank_name:string;bank_slug:string;type:string;min_amount:number;max_amount:number;is_active:boolean;supported_currencies?:Record<string,{default_min?:number;default_max?:number;countries?:Record<string,{is_enabled?:boolean;min_amount?:number;max_amount?:number}>}>};
export async function getChapaPayoutBanks():Promise<ChapaBank[]>{
 const key=process.env.CHAPA_PRIVATE_KEY;if(!key)return[];
 try{
  const response=await fetch("https://api.chapa.global/v2/payouts/banks?country=ET",{headers:{Authorization:"Bearer "+key},next:{revalidate:3600}});
  const payload=await response.json();
  if(!response.ok||payload?.status!=="success"||!Array.isArray(payload.data))return[];
  return (payload.data as ChapaBank[]).filter(b=>b.is_active&&b.supported_currencies?.ETB?.countries?.ET?.is_enabled!==false);
 }catch{return[];}
}

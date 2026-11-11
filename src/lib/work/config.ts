import "server-only";
export function getWorkFeeConfig(){
 const raw=process.env.BUNA_WORK_PLATFORM_FEE_PERCENT;
 const parsed=raw===undefined||raw.trim()===""?10:Number(raw);
 const feePercent=Number.isInteger(parsed)&&parsed>=0&&parsed<=99?parsed:10;
 return {feePercent,freelancerSharePercent:100-feePercent};
}

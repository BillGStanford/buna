import { AFRICAN_COUNTRIES } from "@/lib/geo";
import { STAGES } from "@/lib/startups/constants";
import type { InvestorData } from "@/lib/people/queries";
import type { CategoryOption } from "@/lib/startups/queries";
import { saveInvestorFormAction } from "@/app/admin/investors/actions";

export function InvestorServerForm({ investor, categories, canVerify, error }: {
 investor?: InvestorData;
 categories: CategoryOption[];
 canVerify: boolean;
 error?: boolean;
}) {
 const stages=investor?.stages??[];
 const sectors=investor?.sectors??[];
 return <form action={saveInvestorFormAction} className="space-y-4">
  <input type="hidden" name="investorId" value={investor?.id??""}/>
  {error?<p role="alert" className="rounded-md border border-red-300 p-3 text-sm">We could not save this investor listing. Check the required fields and try again.</p>:null}
  <label className="block text-sm font-medium">Organisation name<input name="name" required maxLength={120} defaultValue={investor?.name??""} className="mt-1 w-full rounded-md border border-line bg-canvas px-3 py-2"/></label>
  <label className="block text-sm font-medium">Public description<textarea name="description" rows={4} maxLength={3000} defaultValue={investor?.description??""} className="mt-1 w-full rounded-md border border-line bg-canvas px-3 py-2"/></label>
  <div className="grid gap-4 sm:grid-cols-2">
   <label className="block text-sm font-medium">Website<input name="websiteUrl" type="url" placeholder="https://" defaultValue={investor?.website_url??""} className="mt-1 w-full rounded-md border border-line bg-canvas px-3 py-2"/></label>
   <label className="block text-sm font-medium">Public application or contact link<input name="contactUrl" type="url" placeholder="https://" defaultValue={investor?.contact_url??""} className="mt-1 w-full rounded-md border border-line bg-canvas px-3 py-2"/></label>
   <label className="block text-sm font-medium">Country<select name="country" defaultValue={investor?.country??""} className="mt-1 w-full rounded-md border border-line bg-canvas px-3 py-2"><option value="">Not specified</option>{AFRICAN_COUNTRIES.map(country=><option key={country.code} value={country.code}>{country.name}</option>)}</select></label>
   <label className="block text-sm font-medium">Regions<input name="regions" placeholder="East Africa, West Africa…" defaultValue={investor?.regions.join(", ")??""} className="mt-1 w-full rounded-md border border-line bg-canvas px-3 py-2"/></label>
  </div>
  <fieldset><legend className="text-sm font-medium">Stages they say they invest in</legend><div className="mt-2 grid gap-2 sm:grid-cols-3">{STAGES.map(stage=><label key={stage.value} className="flex items-center gap-2 text-sm"><input type="checkbox" name="stages" value={stage.value} defaultChecked={stages.includes(stage.value)}/>{stage.label}</label>)}</div></fieldset>
  <fieldset><legend className="text-sm font-medium">Sectors of interest</legend><div className="mt-2 grid gap-2 sm:grid-cols-3">{categories.map(category=><label key={category.slug} className="flex items-center gap-2 text-sm"><input type="checkbox" name="sectors" value={category.slug} defaultChecked={sectors.includes(category.slug)}/>{category.name}</label>)}</div></fieldset>
  <label className="block text-sm font-medium">Publicly stated investment thesis<textarea name="thesis" rows={4} maxLength={3000} defaultValue={investor?.thesis??""} placeholder="Only what the organisation has said publicly." className="mt-1 w-full rounded-md border border-line bg-canvas px-3 py-2"/></label>
  <label className="block text-sm font-medium">Verification<select name="verificationStatus" disabled={!canVerify} defaultValue={investor?.verification_status??"unverified"} className="mt-1 w-full rounded-md border border-line bg-canvas px-3 py-2">{["unverified","pending","verified","rejected","revoked"].map(status=><option key={status} value={status}>{status}</option>)}</select></label>
  {!canVerify?<input type="hidden" name="verificationStatus" value={investor?.verification_status??"unverified"}/>:null}
  <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isPublished" defaultChecked={investor?.is_published??false}/>Publish this listing</label>
  <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white">{investor?"Save changes":"Create listing"}</button>
 </form>;
}

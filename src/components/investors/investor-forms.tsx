"use client";

import { useActionState } from "react";
import { applyInvestorModeAction, submitInvestorPitchAction, updateInvestorSubmissionAction, sendInvestorMessageAction, updateInvestorProfileAction } from "@/app/dashboard/investor/actions";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { SelectField, TextAreaField, TextField } from "@/components/ui/fields";
import { idleState } from "@/lib/types";

const TYPES = [
  ["angel", "Angel investor"], ["independent_investor", "Independent investor"], ["syndicate", "Investor syndicate"], ["venture_capital", "Venture capital firm"], ["accelerator", "Accelerator"],
  ["investment_fund", "Investment fund"], ["corporate", "Corporate investor"], ["family_office", "Family office"],
  ["development_finance", "Development finance institution"], ["other", "Other"],
] as const;
const STAGES = [["idea","Idea"],["prototype","Prototype"],["mvp","MVP"],["early_revenue","Early revenue"],["growth","Growth"],["scale","Scale"]] as const;

export function InvestorApplicationForm({ existingInvestorId = "" }: { existingInvestorId?: string }) {
  const [state, action] = useActionState(applyInvestorModeAction, idleState);
  return <form action={action} className="space-y-4 rounded-xl border border-line bg-surface p-5">
    <input type="hidden" name="existingInvestorId" value={existingInvestorId} />
    <div className="grid gap-4 sm:grid-cols-2">
      <SelectField label="Profile represents" name="entityKind" required defaultValue="organization"><option value="individual">Individual investor (angel / independent)</option><option value="organization">Investment organisation</option></SelectField>
      <TextField label="Investor name (person or organisation)" name="organizationName" required maxLength={120} />
      <SelectField label="Your role" name="requestedRole" required defaultValue="owner">
        <option value="owner">Owner / founder</option>
        {existingInvestorId ? <><option value="partner">Partner</option><option value="investment_manager">Investment manager</option><option value="analyst">Analyst</option><option value="associate">Associate</option><option value="member">Team member</option><option value="observer">Observer</option></> : null}
      </SelectField>
      <SelectField label="Investor type" name="investorType" required><option value="">Choose type</option>{TYPES.map(([v,l])=><option key={v} value={v}>{l}</option>)}</SelectField>
      <TextField label="Professional contact email" name="contactEmail" type="email" required />
    </div>
    <TextAreaField label="Who are you and what do you invest in?" name="background" required minLength={20} maxLength={3000} rows={4} hint="A short professional introduction and the kind of companies you are interested in. At least 20 characters." />
    <details className="rounded-lg border border-line p-4">
      <summary className="cursor-pointer text-sm font-semibold">Add investment preferences and other details (optional)</summary>
      <p className="mt-2 text-xs leading-5 text-muted">These details help founders understand your focus. You can add or update them later in your investor profile after approval.</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <TextField label="Website" name="websiteUrl" type="url" placeholder="https://" />
        <TextField label="Phone / telephone" name="contactPhone" type="tel" placeholder="+251…" />
        <TextField label="WhatsApp number or link" name="contactWhatsapp" placeholder="+251… or https://wa.me/…" />
        <TextField label="Telegram username or link" name="contactTelegram" placeholder="@username or https://t.me/…" />
        <TextField label="Facebook page / profile" name="contactFacebook" placeholder="https://facebook.com/…" />
        <TextField label="Other contact link" name="contactOtherUrl" type="url" placeholder="https://" />
        <TextField label="Investment minimum" name="investmentMin" inputMode="decimal" placeholder="e.g. 25000" />
        <TextField label="Investment maximum" name="investmentMax" inputMode="decimal" placeholder="e.g. 500000" />
        <TextField label="Currency" name="investmentCurrency" defaultValue="USD" maxLength={3} required />
        <TextField label="Markets / regions" name="markets" placeholder="Ethiopia, East Africa, Pan-African" hint="Comma-separated." />
        <TextField label="Sectors of interest" name="sectors" placeholder="fintech, agritech, healthtech" hint="Comma-separated." />
        <TextField label="Investment stages" name="stages" placeholder="idea, prototype, mvp, early_revenue, growth, scale" hint="Comma-separated; use the listed stage names." />
        <TextField label="Portfolio companies" name="portfolio" placeholder="Company A, Company B" />
        <TextField label="Verification evidence URL" name="proofUrl" type="url" placeholder="https:// (website, LinkedIn, fund page)" />
      </div>
    </details>
    <p className="text-xs text-muted">Use your existing Buna account. Individuals can apply as angel or independent investors without representing a firm. Requests to join an existing investor team are reviewed before access is granted. Team members use their own Buna accounts and never share credentials.</p>
    <FormMessage state={state} />
    <SubmitButton pendingLabel="Submitting application…">Submit application</SubmitButton>
  </form>;
}

export function InvestorPitchForm({ investorId, startups }: { investorId: string; startups: { id: string; name: string }[] }) {
  const [state, action] = useActionState(submitInvestorPitchAction, idleState);
  return <form action={action} className="space-y-4 rounded-xl border border-line bg-surface p-5">
    <input type="hidden" name="investorId" value={investorId} />
    <div className="grid gap-4 sm:grid-cols-2">
      <SelectField label="Request type" name="submissionType" required><option value="introduction">Request an introduction</option><option value="pitch">Submit a pitch</option></SelectField>
      <TextField label="Startup name" name="startupName" required maxLength={120} />
      <SelectField label="Development stage" name="stage"><option value="">Not specified</option>{STAGES.map(([v,l])=><option key={v} value={v}>{l}</option>)}</SelectField>
      <TextField label="Funding sought" name="fundingAmount" inputMode="decimal" placeholder="Optional amount" />
      <TextField label="Currency" name="fundingCurrency" defaultValue="USD" maxLength={3} required />
      <SelectField label="Your startup (optional)" name="startupId"><option value="">Not linked to a Buna startup</option>{startups.map((startup)=><option key={startup.id} value={startup.id}>{startup.name}</option>)}</SelectField>
    </div>
    <TextAreaField label="What are you building?" name="summary" required minLength={30} maxLength={3000} rows={5} />
    <TextAreaField label="Why is this investor a good fit?" name="fitReason" required minLength={10} maxLength={1500} rows={3} />
    <TextField label="Pitch deck or supporting document URL" name="pitchDeckUrl" type="url" placeholder="https://" />
    <FormMessage state={state} />
    <SubmitButton pendingLabel="Sending…">Send to investor</SubmitButton>
  </form>;
}

const PIPELINE = [
  ["new","New submission"],["under_review","Under review"],["interested","Interested"],["meeting_requested","Meeting requested"],
  ["in_discussion","In discussion"],["declined","Declined"],["closed","Closed"],
] as const;

export function InvestorPipelineForm({ submissionId, status, response }: { submissionId: string; status: string; response: string | null }) {
  const [state, action] = useActionState(updateInvestorSubmissionAction, idleState);
  return <form action={action} className="space-y-3 rounded-lg border border-line p-4">
    <input type="hidden" name="submissionId" value={submissionId} />
    <SelectField label="Pipeline stage" name="status" defaultValue={status}>{PIPELINE.map(([v,l])=><option key={v} value={v}>{l}</option>)}</SelectField>
    <TextAreaField label="Response to founder" name="investorResponse" rows={3} maxLength={2000} defaultValue={response ?? ""} hint="The founder will receive an in-app notification." />
    <FormMessage state={state} />
    <SubmitButton pendingLabel="Saving…">Update pipeline</SubmitButton>
  </form>;
}

export function InvestorMessageForm({ submissionId }: { submissionId: string }) {
  const [state, action] = useActionState(sendInvestorMessageAction, idleState);
  return <form action={action} className="space-y-3 border-t border-line pt-4">
    <input type="hidden" name="submissionId" value={submissionId} />
    <TextAreaField label="Message" name="body" required maxLength={4000} rows={3} placeholder="Write a message to the founder or investor…" />
    <FormMessage state={state} />
    <SubmitButton pendingLabel="Sending…">Send message</SubmitButton>
  </form>;
}

export function InvestorProfileForm({ investor }: { investor: {
  name: string; description: string | null; website_url: string | null; contact_url: string | null; investor_type: string | null;
  regions: string[]; sectors: string[]; stages: string[]; investment_min: number | null; investment_max: number | null;
  investment_currency: string; portfolio: string | null; thesis: string | null; contact_email: string | null; membership_role: string; contact_phone: string | null; contact_whatsapp: string | null; contact_telegram: string | null; contact_facebook: string | null; contact_other_url: string | null; background: string | null; public_contact_email: string | null; public_contact_phone: string | null; public_contact_whatsapp: string | null; public_contact_telegram: string | null; public_contact_facebook: string | null; public_contact_other_url: string | null;
} }) {
  const [state, action] = useActionState(updateInvestorProfileAction, idleState);
  return <form action={action} className="space-y-4 rounded-xl border border-line bg-surface p-5">
    <input type="hidden" name="membershipRole" value={investor.membership_role} />
    <div className="grid gap-4 sm:grid-cols-2">
      <TextField label="Investor / organisation name" name="name" required maxLength={120} defaultValue={investor.name} />
      <SelectField label="Investor type" name="investorType" defaultValue={investor.investor_type ?? "other"}>{TYPES.map(([v,l])=><option key={v} value={v}>{l}</option>)}</SelectField>
      <TextField label="Website" name="websiteUrl" type="url" defaultValue={investor.website_url ?? ""} placeholder="https://" />
      <TextField label="Public contact / application URL" name="contactUrl" type="url" defaultValue={investor.contact_url ?? ""} placeholder="https://" />
      {investor.membership_role === "owner" ? <>
      <TextField label="Contact email (private)" name="contactEmail" type="email" defaultValue={investor.contact_email ?? ""} />
      <TextField label="Phone / telephone" name="contactPhone" type="tel" defaultValue={investor.contact_phone ?? ""} />
      <TextField label="WhatsApp number or link" name="contactWhatsapp" defaultValue={investor.contact_whatsapp ?? ""} />
      <TextField label="Telegram username or link" name="contactTelegram" defaultValue={investor.contact_telegram ?? ""} />
      <TextField label="Facebook page / profile" name="contactFacebook" defaultValue={investor.contact_facebook ?? ""} />
      <TextField label="Other contact link" name="contactOtherUrl" type="url" defaultValue={investor.contact_other_url ?? ""} />
      </> : null}
      <TextField label="Investment minimum" name="investmentMin" inputMode="decimal" defaultValue={investor.investment_min == null ? "" : String(investor.investment_min)} />
      <TextField label="Investment maximum" name="investmentMax" inputMode="decimal" defaultValue={investor.investment_max == null ? "" : String(investor.investment_max)} />
      <TextField label="Currency" name="investmentCurrency" defaultValue={investor.investment_currency || "USD"} maxLength={3} required />
      <TextField label="Markets / regions" name="regions" defaultValue={investor.regions.join(", ")} hint="Comma-separated." />
      <TextField label="Sectors" name="sectors" defaultValue={investor.sectors.join(", ")} hint="Comma-separated." />
      <TextField label="Investment stages" name="stages" defaultValue={investor.stages.join(", ")} hint="idea, prototype, mvp, early_revenue, growth, scale." />
      <TextField label="Portfolio companies" name="portfolio" defaultValue={investor.portfolio ?? ""} />
    </div>
    <section className="space-y-3 rounded-lg border border-line p-4">
      <div><h3 className="font-semibold">Public founder contact channels</h3><p className="mt-1 text-xs text-muted">Only enter details you want every visitor to see. These are separate from your private application contacts.</p></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Public email" name="publicContactEmail" type="email" defaultValue={investor.public_contact_email ?? ""} />
        <TextField label="Public phone" name="publicContactPhone" type="tel" defaultValue={investor.public_contact_phone ?? ""} />
        <TextField label="Public WhatsApp number or link" name="publicContactWhatsapp" defaultValue={investor.public_contact_whatsapp ?? ""} />
        <TextField label="Public Telegram username or link" name="publicContactTelegram" defaultValue={investor.public_contact_telegram ?? ""} />
        <TextField label="Public Facebook URL" name="publicContactFacebook" type="url" defaultValue={investor.public_contact_facebook ?? ""} />
        <TextField label="Other public contact URL" name="publicContactOtherUrl" type="url" defaultValue={investor.public_contact_other_url ?? ""} />
      </div>
    </section>
    <TextAreaField label="Public investor description" name="description" rows={3} maxLength={3000} defaultValue={investor.description ?? ""} />
    <TextAreaField label="Public investment thesis" name="thesis" rows={4} maxLength={3000} defaultValue={investor.thesis ?? ""} />
    {investor.membership_role === "owner" ? <TextAreaField label="Private professional background (staff-reviewed)" name="background" required minLength={20} maxLength={3000} rows={4} defaultValue={investor.background ?? ""} /> : null}
    <FormMessage state={state} />
    <SubmitButton pendingLabel="Saving profile…">Save investor profile</SubmitButton>
  </form>;
}

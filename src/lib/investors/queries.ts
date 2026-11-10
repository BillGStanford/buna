import "server-only";
import { createClient } from "@/lib/supabase/server";

export type InvestorApplication = {
  id: string; user_id: string; existing_investor_id: string | null; organization_name: string; investor_type: string;
  website_url: string | null; contact_email: string | null; contact_phone: string | null; contact_whatsapp: string | null; contact_telegram: string | null; contact_facebook: string | null; contact_other_url: string | null; background: string; sectors: string[];
  stages: string[]; markets: string[]; investment_min: number | null; investment_max: number | null;
  investment_currency: string; portfolio: string | null; proof_url: string | null; status: string;
  review_note: string | null; created_at: string; applicant?: { username: string; display_name: string } | null;
};
export type OwnedInvestor = {
  id: string; slug: string; name: string; description: string | null; website_url: string | null; contact_url: string | null; thesis: string | null; is_published: boolean; verification_status: string;
  investor_type: string | null; investment_min: number | null; investment_max: number | null;
  investment_currency: string; portfolio: string | null; background: string | null; public_contact_email: string | null; public_contact_phone: string | null; public_contact_whatsapp: string | null; public_contact_telegram: string | null; public_contact_facebook: string | null; public_contact_other_url: string | null;
  contact_email: string | null; contact_phone: string | null; contact_whatsapp: string | null; contact_telegram: string | null; contact_facebook: string | null; contact_other_url: string | null; sectors: string[]; stages: string[]; regions: string[];
};
export type InvestorSubmission = {
  id: string; investor_id: string; founder_id: string; startup_id: string | null; submission_type: string;
  startup_name: string; summary: string; stage: string | null; funding_amount: number | null;
  funding_currency: string; fit_reason: string; pitch_deck_url: string | null; status: string;
  investor_response: string | null; additional_info: string | null; created_at: string; updated_at: string;
  investor?: { name: string; slug: string } | null;
  founder?: { username: string; display_name: string } | null;
  startup?: { name: string; slug: string } | null;
};

export async function getInvestorPortal(userId: string) {
  const supabase = await createClient();
  const [application, membership] = await Promise.all([
    supabase.from("investor_applications").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("investor_memberships").select("investor_id, role, status, investor:investors(id, slug, name, description, website_url, contact_url, thesis, is_published, verification_status, investor_type, entity_kind, investment_min, investment_max, investment_currency, portfolio, sectors, stages, regions, public_contact_email, public_contact_phone, public_contact_whatsapp, public_contact_telegram, public_contact_facebook, public_contact_other_url)")
      .eq("user_id", userId).eq("status", "active").order("created_at", { ascending: true }).limit(1).maybeSingle(),
  ]);
  if (application.error) throw application.error;
  if (membership.error) throw membership.error;
  const row = membership.data as unknown as { investor_id: string; role: string; status: string; investor: OwnedInvestor | OwnedInvestor[] | null } | null;
  const investor = row ? (Array.isArray(row.investor) ? row.investor[0] : row.investor) : null;
  let privateDetails: { contact_email: string | null; contact_phone: string | null; contact_whatsapp: string | null; contact_telegram: string | null; contact_facebook: string | null; contact_other_url: string | null; private_background: string | null } | null = null;
  if (row?.role === "owner") {
    const { data, error } = await supabase.from("investor_accounts").select("contact_email, contact_phone, contact_whatsapp, contact_telegram, contact_facebook, contact_other_url, private_background").eq("investor_id", row.investor_id).maybeSingle();
    if (error) throw error;
    privateDetails = data;
  }
  return {
    application: application.data as InvestorApplication | null,
    investor: investor ? {
      ...investor,
      background: privateDetails?.private_background ?? null,
      contact_email: privateDetails?.contact_email ?? null,
      contact_phone: privateDetails?.contact_phone ?? null,
      contact_whatsapp: privateDetails?.contact_whatsapp ?? null,
      contact_telegram: privateDetails?.contact_telegram ?? null,
      contact_facebook: privateDetails?.contact_facebook ?? null,
      contact_other_url: privateDetails?.contact_other_url ?? null,
      membership_role: row?.role ?? "member",
    } : null,
  };
}

export async function listInvestorSubmissions(investorId: string, status = ""): Promise<InvestorSubmission[]> {
  const supabase = await createClient();
  let q = supabase.from("investor_submissions")
    .select("id, investor_id, founder_id, startup_id, submission_type, startup_name, summary, stage, funding_amount, funding_currency, fit_reason, pitch_deck_url, status, investor_response, additional_info, created_at, updated_at, startup:startups(name, slug)")
    .eq("investor_id", investorId).order("created_at", { ascending: false }).limit(100);
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) throw error;
  const rows = (data ?? []) as unknown as InvestorSubmission[];
  const ids = [...new Set(rows.map((row) => row.founder_id))];
  const { data: people } = ids.length ? await supabase.from("public_profiles").select("id, username, display_name").in("id", ids) : { data: [] };
  const byId = new Map((people ?? []).map((person) => [person.id, person]));
  return rows.map((row) => ({ ...row, founder: byId.get(row.founder_id) ?? null }));
}

export async function listFounderSubmissions(userId: string): Promise<InvestorSubmission[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("investor_submissions")
    .select("id, investor_id, founder_id, startup_id, submission_type, startup_name, summary, stage, funding_amount, funding_currency, fit_reason, pitch_deck_url, status, investor_response, additional_info, created_at, updated_at, investor:investors(name, slug)")
    .eq("founder_id", userId).order("created_at", { ascending: false }).limit(100);
  if (error) throw error;
  return (data ?? []) as unknown as InvestorSubmission[];
}

export async function getInvestorSubmission(id: string): Promise<InvestorSubmission | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("investor_submissions")
    .select("id, investor_id, founder_id, startup_id, submission_type, startup_name, summary, stage, funding_amount, funding_currency, fit_reason, pitch_deck_url, status, investor_response, additional_info, created_at, updated_at, investor:investors(name, slug), startup:startups(name, slug)")
    .eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as unknown as InvestorSubmission | null) ?? null;
}

export async function listInvestorMessages(submissionId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("investor_submission_messages")
    .select("id, sender_id, body, created_at")
    .eq("submission_id", submissionId).order("created_at", { ascending: true }).limit(200);
  if (error) throw error;
  const rows = (data ?? []) as { id: string; sender_id: string; body: string; created_at: string }[];
  const ids = [...new Set(rows.map((row) => row.sender_id))];
  const { data: people } = ids.length ? await supabase.from("public_profiles").select("id, username, display_name").in("id", ids) : { data: [] };
  const byId = new Map((people ?? []).map((person) => [person.id, person]));
  return rows.map((row) => ({ ...row, sender: byId.get(row.sender_id) ?? null }));
}

export async function listPendingInvestorApplications(): Promise<InvestorApplication[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("investor_applications")
    .select("*").eq("status", "pending").order("created_at", { ascending: true }).limit(100);
  if (error) throw error;
  const rows = (data ?? []) as unknown as InvestorApplication[];
  const ids = [...new Set(rows.map((row) => row.user_id))];
  const { data: people } = ids.length ? await supabase.from("public_profiles").select("id, username, display_name").in("id", ids) : { data: [] };
  const byId = new Map((people ?? []).map((person) => [person.id, person]));
  return rows.map((row) => ({ ...row, applicant: byId.get(row.user_id) ?? null }));
}

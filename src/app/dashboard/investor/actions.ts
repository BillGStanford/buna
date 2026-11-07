"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireActiveProfile, requireStaff } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { createLogger } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";
import { formDataToObject } from "@/lib/validation/common";
import { investorApplicationSchema, investorSubmissionSchema, investorSubmissionUpdateSchema, investorMessageSchema, investorApplicationReviewSchema, investorProfileSchema } from "@/lib/validation/investor";
import type { ActionState } from "@/lib/types";

const log = createLogger("investor-mode");
const BAD: ActionState = { status: "error", message: "Check the form and try again." };

export async function applyInvestorModeAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const profile = await requireActiveProfile();
  if (!(await rateLimit("investor-application:" + profile.id, 3, 86400))) return { status: "error", message: "Please wait before submitting another investor application." };
  const parsed = investorApplicationSchema.safeParse(formDataToObject(fd));
  if (!parsed.success) return { status: "error", message: "Check the application details and try again." };
  const d = parsed.data;
  const supabase = await createClient();
  const { data: ownedAccount } = await supabase.from("investor_accounts").select("investor_id").eq("user_id", profile.id).maybeSingle();
  if (ownedAccount) return { status: "error", message: "Your Investor Mode account is already active." };
  const { data: existing } = await supabase.from("investor_applications").select("id, status").eq("user_id", profile.id).in("status", ["pending", "approved"]).limit(1).maybeSingle();
  if (existing?.status === "approved") return { status: "error", message: "Your Investor Mode account is already approved." };
  if (existing?.status === "pending") return { status: "error", message: "Your application is already awaiting review." };
  if (d.existingInvestorId) {
    const { data: listing } = await supabase.from("investors").select("id").eq("id", d.existingInvestorId).maybeSingle();
    const { data: claimable } = await supabase.rpc("investor_listing_claimable", { p_investor: d.existingInvestorId });
    if (!listing || !claimable) return { status: "error", message: "That investor listing cannot be claimed. Check the listing and try again." };
  }
  const { error } = await supabase.from("investor_applications").insert({
    user_id: profile.id, existing_investor_id: d.existingInvestorId, organization_name: d.organizationName,
    investor_type: d.investorType, website_url: d.websiteUrl || null, contact_email: d.contactEmail || null,
    contact_phone: d.contactPhone || null, contact_whatsapp: d.contactWhatsapp || null,
    contact_telegram: d.contactTelegram || null, contact_facebook: d.contactFacebook || null, contact_other_url: d.contactOtherUrl || null,
    background: d.background, sectors: d.sectors, stages: d.stages, markets: d.markets,
    investment_min: d.investmentMin, investment_max: d.investmentMax, investment_currency: d.investmentCurrency,
    portfolio: d.portfolio || null, proof_url: d.proofUrl || null,
  });
  if (error) {
    if (error.code === "23505") return { status: "error", message: "You already have an application awaiting review." };
    log.error("investor application failed", error);
    return BAD;
  }
  try {
    const admin = createAdminClient();
    const { data: staffMembers } = await admin.from("profiles").select("id").in("role", ["admin", "moderator"]).eq("is_suspended", false);
    if (staffMembers?.length) await Promise.all(staffMembers.map((member) => admin.rpc("create_notification", {
      p_user: member.id, p_type: "investor", p_title: "New Investor Mode application",
      p_body: d.organizationName + " has applied for Investor Mode and is awaiting review.",
      p_url: "/admin/investor-applications", p_dedupe: "investor-application-submitted:" + member.id + ":" + profile.id, p_pref: null,
    })));
  } catch (err) { log.error("staff investor application notification failed", err); }
  await writeAuditLog({ actorId: profile.id, action: "investor_application.submit", entityType: "investor_application", metadata: { organization: d.organizationName } });
  revalidatePath("/dashboard/investor");
  revalidatePath("/admin/investor-applications");
  return { status: "success", message: "Application submitted. Buna staff will review it before Investor Mode is activated." };
}

export async function submitInvestorPitchAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const profile = await requireActiveProfile();
  if (!(await rateLimit("investor-submission:" + profile.id, 5, 86400))) return { status: "error", message: "You have reached the daily limit for investor introductions." };
  const parsed = investorSubmissionSchema.safeParse(formDataToObject(fd));
  if (!parsed.success) return { status: "error", message: "Check the pitch details and try again." };
  const d = parsed.data;
  const supabase = await createClient();
  const { data: investor } = await supabase.from("investors").select("id, name").eq("id", d.investorId).eq("is_published", true).maybeSingle();
  const { data: accepts } = await supabase.rpc("investor_accepts_introductions", { p_investor: d.investorId });
  if (!investor || !accepts) return { status: "error", message: "This investor is not currently accepting introductions through Buna." };
  const { data, error } = await supabase.from("investor_submissions").insert({
    investor_id: d.investorId, founder_id: profile.id, startup_id: d.startupId, submission_type: d.submissionType,
    startup_name: d.startupName, summary: d.summary, stage: d.stage || null,
    funding_amount: d.fundingAmount, funding_currency: d.fundingCurrency, fit_reason: d.fitReason,
    pitch_deck_url: d.pitchDeckUrl || null,
  }).select("id").single();
  if (error || !data) {
    log.error("investor pitch submission failed", error);
    return BAD;
  }
  if (d.startupId) {
    try { await createAdminClient().from("investor_deals").upsert({ investor_id: investor.id, startup_id: d.startupId, stage: "discovered", source: "founder_submission" }, { onConflict: "investor_id,startup_id", ignoreDuplicates: true }); }
    catch (err) { log.error("incoming founder pitch pipeline sync failed", err); }
  }
  try {
    const admin = createAdminClient();
    const { data: investorAccount } = await admin.from("investor_accounts").select("user_id").eq("investor_id", investor.id).maybeSingle();
    if (investorAccount?.user_id) await admin.rpc("create_notification", {
      p_user: investorAccount.user_id, p_type: "investor", p_title: "New founder introduction request",
      p_body: (profile.display_name || profile.username) + " sent a " + (d.submissionType === "pitch" ? "pitch" : "request for introduction") + " for " + d.startupName + ".",
      p_url: "/dashboard/investor/inbox", p_dedupe: "investor-submission:" + data.id, p_pref: null,
    });
  } catch (err) { log.error("investor notification failed", err); }
  await writeAuditLog({ actorId: profile.id, action: "investor_submission.create", entityType: "investor_submission", entityId: data.id, metadata: { investorId: investor.id } });
  revalidatePath("/dashboard/investor/submissions");
  revalidatePath("/dashboard/investor/inbox");
  return { status: "success", message: "Sent. You can track the request in your Investor connections dashboard." };
}

export async function updateInvestorSubmissionAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const profile = await requireActiveProfile();
  const parsed = investorSubmissionUpdateSchema.safeParse(formDataToObject(fd));
  if (!parsed.success) return BAD;
  const d = parsed.data;
  const supabase = await createClient();
  const { data: owned } = await supabase.from("investor_accounts").select("investor_id").eq("user_id", profile.id).maybeSingle();
  if (!owned) return { status: "error", message: "Only approved investor accounts can manage this pipeline." };
  const { data, error } = await supabase.from("investor_submissions")
    .update({ status: d.status, investor_response: d.investorResponse || null })
    .eq("id", d.submissionId).eq("investor_id", owned.investor_id).select("founder_id").maybeSingle();
  if (error || !data) return { status: "error", message: "You cannot update that submission." };
  try {
    await createAdminClient().rpc("create_notification", {
      p_user: data.founder_id, p_type: "investor", p_title: "Your investor request was updated",
      p_body: d.investorResponse || ("The investor moved your request to " + d.status.replace(/_/g, " ") + "."),
      p_url: "/dashboard/investor/submissions", p_dedupe: "investor-status:" + d.submissionId + ":" + d.status + ":" + Date.now(), p_pref: null,
    });
  } catch (err) { log.error("founder status notification failed", err); }
  await writeAuditLog({ actorId: profile.id, action: "investor_submission.update", entityType: "investor_submission", entityId: d.submissionId, metadata: { status: d.status } });
  revalidatePath("/dashboard/investor/inbox");
  revalidatePath("/dashboard/investor/submissions");
  revalidatePath("/dashboard/investor/inbox/" + d.submissionId);
  return { status: "success", message: "Pipeline updated." };
}

export async function sendInvestorMessageAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const profile = await requireActiveProfile();
  if (!(await rateLimit("investor-message:" + profile.id, 40, 3600))) return { status: "error", message: "Please slow down before sending more messages." };
  const parsed = investorMessageSchema.safeParse(formDataToObject(fd));
  if (!parsed.success) return BAD;
  const supabase = await createClient();
  const { data: submission } = await supabase.from("investor_submissions")
    .select("id, founder_id, investor_id").eq("id", parsed.data.submissionId).maybeSingle();
  if (!submission) return { status: "error", message: "That conversation is unavailable." };
  const { data: account } = await createAdminClient().from("investor_accounts").select("user_id").eq("investor_id", submission.investor_id).maybeSingle();
  const investorOwner = account?.user_id ?? null;
  const recipient = submission.founder_id === profile.id ? investorOwner : submission.founder_id;
  if (!recipient || (submission.founder_id !== profile.id && investorOwner !== profile.id)) return { status: "error", message: "You are not part of this conversation." };
  const { error } = await supabase.from("investor_submission_messages").insert({
    submission_id: parsed.data.submissionId, sender_id: profile.id, body: parsed.data.body,
  });
  if (error) return { status: "error", message: "Message could not be sent." };
  try {
    await createAdminClient().rpc("create_notification", {
      p_user: recipient, p_type: "investor", p_title: "New message about a founder introduction",
      p_body: (profile.display_name || profile.username) + " sent you a message.",
      p_url: submission.founder_id === profile.id ? ("/dashboard/investor/inbox/" + submission.id) : ("/dashboard/investor/conversations/" + submission.id), p_dedupe: "investor-message:" + submission.id + ":" + Date.now(), p_pref: null,
    });
  } catch (err) { log.error("investor message notification failed", err); }
  revalidatePath("/dashboard/investor/inbox/" + submission.id);
  revalidatePath("/dashboard/investor/submissions");
  return { status: "success", message: "Message sent." };
}

export async function updateInvestorProfileAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const profile = await requireActiveProfile();
  const parsed = investorProfileSchema.safeParse(formDataToObject(fd));
  if (!parsed.success) return { status: "error", message: "Check the profile fields and try again." };
  const d = parsed.data;
  const supabase = await createClient();
  const { data: account } = await supabase.from("investor_accounts").select("investor_id").eq("user_id", profile.id).maybeSingle();
  if (!account) return { status: "error", message: "Only approved investor accounts can edit this profile." };
  const { error: publicError } = await supabase.from("investors").update({
    name: d.name, description: d.description || null, website_url: d.websiteUrl || null, contact_url: d.contactUrl || null,
    investor_type: d.investorType, regions: d.regions, sectors: d.sectors, stages: d.stages,
    investment_min: d.investmentMin, investment_max: d.investmentMax, investment_currency: d.investmentCurrency,
    portfolio: d.portfolio || null, thesis: d.thesis || null,
  }).eq("id", account.investor_id);
  if (publicError) {
    log.error("investor public profile update failed", publicError);
    return { status: "error", message: "The public profile could not be saved." };
  }
  const { error: privateError } = await supabase.from("investor_accounts").update({
    contact_email: d.contactEmail || null, contact_phone: d.contactPhone || null,
    contact_whatsapp: d.contactWhatsapp || null, contact_telegram: d.contactTelegram || null,
    contact_facebook: d.contactFacebook || null, contact_other_url: d.contactOtherUrl || null,
    private_background: d.background,
  }).eq("investor_id", account.investor_id);
  if (privateError) {
    log.error("investor private profile update failed", privateError);
    return { status: "error", message: "The profile was only partly saved. Please try again." };
  }
  await writeAuditLog({ actorId: profile.id, action: "investor.profile.update", entityType: "investor", entityId: account.investor_id });
  const { data: listing } = await supabase.from("investors").select("slug").eq("id", account.investor_id).maybeSingle();
  if (listing?.slug) revalidatePath("/investors/" + listing.slug);
  revalidatePath("/dashboard/investor");
  revalidatePath("/dashboard/investor/profile");
  return { status: "success", message: "Investor profile updated." };
}

export async function saveStartupForInvestorAction(fd: FormData): Promise<void> {
  const profile = await requireActiveProfile();
  const startupId = String(fd.get("startupId") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(startupId)) return;
  const supabase = await createClient();
  const { data: account } = await supabase.from("investor_accounts").select("investor_id").eq("user_id", profile.id).maybeSingle();
  if (!account) return;
  const { data: existing } = await supabase.from("investor_saved_startups").select("startup_id")
    .eq("investor_id", account.investor_id).eq("startup_id", startupId).maybeSingle();
  if (existing) {
    await supabase.from("investor_saved_startups").delete().eq("investor_id", account.investor_id).eq("startup_id", startupId);
  } else {
    await supabase.from("investor_saved_startups").insert({ investor_id: account.investor_id, startup_id: startupId });
  }
  if (!existing) await supabase.from("investor_deals").upsert({ investor_id: account.investor_id, startup_id: startupId, stage: "discovered" }, { onConflict: "investor_id,startup_id", ignoreDuplicates: true });
  revalidatePath("/dashboard/investor/startups");
  revalidatePath("/dashboard/investor/pipeline");
  revalidatePath("/startups");
}

export async function reviewInvestorApplicationAction(fd: FormData): Promise<void> {
  const staff = await requireStaff();
  const parsed = investorApplicationReviewSchema.safeParse(formDataToObject(fd));
  if (!parsed.success) return;
  const supabase = await createClient();
  const { error } = await supabase.rpc("review_investor_application", {
    p_application: parsed.data.applicationId, p_decision: parsed.data.decision, p_note: parsed.data.note || null,
  });
  if (error) {
    log.error("investor application review failed", error);
    return;
  }
  await writeAuditLog({ actorId: staff.id, action: "investor_application.review", entityType: "investor_application", entityId: parsed.data.applicationId, metadata: { decision: parsed.data.decision } });
  revalidatePath("/admin/investor-applications");
  revalidatePath("/admin/investors");
  revalidatePath("/investors");
  revalidatePath("/dashboard/investor");
}


export async function saveInvestorSearchAction(fd: FormData): Promise<void> {
  const profile = await requireActiveProfile();
  const name = String(fd.get("name") ?? "").trim().slice(0, 80);
  if (name.length < 2) return;
  const supabase = await createClient();
  const { data: account } = await supabase.from("investor_accounts").select("investor_id").eq("user_id", profile.id).maybeSingle();
  if (!account) return;
  const split = (key: string) => String(fd.get(key) ?? "").split(",").map((v) => v.trim()).filter(Boolean).slice(0, 12);
  const criteria = {
    sectors: split("sectors"), stages: split("stages"), geographies: split("geographies"),
    businessModels: split("businessModels"), fundingRounds: split("fundingRounds"),
    fundraisingOnly: fd.get("fundraisingOnly") === "on",
    minTarget: String(fd.get("minTarget") ?? "").trim(),
    maxTarget: String(fd.get("maxTarget") ?? "").trim(),
    fundingCurrency: String(fd.get("fundingCurrency") ?? "").trim().toUpperCase(),
  };
  await supabase.from("investor_saved_searches").insert({ investor_id: account.investor_id, name, criteria, alerts_enabled: true });
  revalidatePath("/dashboard/investor/searches");
}

export async function addStartupToPipelineAction(fd: FormData): Promise<void> {
  const profile = await requireActiveProfile();
  const startupId = String(fd.get("startupId") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(startupId)) return;
  const supabase = await createClient();
  const { data: account } = await supabase.from("investor_accounts").select("investor_id").eq("user_id", profile.id).maybeSingle();
  if (!account) return;
  await supabase.from("investor_deals").upsert({ investor_id: account.investor_id, startup_id: startupId, stage: "discovered" }, { onConflict: "investor_id,startup_id", ignoreDuplicates: true });
  revalidatePath("/dashboard/investor/pipeline");
}

export async function updateInvestorDealAction(fd: FormData): Promise<void> {
  const profile = await requireActiveProfile();
  const dealId = String(fd.get("dealId") ?? "");
  const stage = String(fd.get("stage") ?? "");
  const notes = String(fd.get("notes") ?? "").trim().slice(0, 3000);
  if (!/^[0-9a-f-]{36}$/i.test(dealId) || !["discovered","contacted","reviewing","meeting","passed"].includes(stage)) return;
  const supabase = await createClient();
  const { data: account } = await supabase.from("investor_accounts").select("investor_id").eq("user_id", profile.id).maybeSingle();
  if (!account) return;
  await supabase.from("investor_deals").update({ stage, notes: notes || null }).eq("id", dealId).eq("investor_id", account.investor_id);
  revalidatePath("/dashboard/investor/pipeline");
}

export async function requestStartupDocumentsAction(fd: FormData): Promise<void> {
  const profile = await requireActiveProfile();
  const startupId = String(fd.get("startupId") ?? "");
  const message = String(fd.get("message") ?? "").trim().slice(0, 1000);
  if (!/^[0-9a-f-]{36}$/i.test(startupId)) return;
  const supabase = await createClient();
  const { data: account } = await supabase.from("investor_accounts").select("investor_id").eq("user_id", profile.id).maybeSingle();
  if (!account) return;
  const { data: existing } = await supabase.from("startup_document_access_requests").select("id,status")
    .eq("startup_id", startupId).eq("investor_id", account.investor_id).maybeSingle();
  if (existing?.status === "pending" || existing?.status === "approved") return;
  const payload = { startup_id: startupId, investor_id: account.investor_id, requested_by: profile.id, message: message || null, status: "pending" };
  const result = existing
    ? await supabase.from("startup_document_access_requests").update({ status: "pending", message: message || null, reviewed_by: null, reviewed_at: null }).eq("id", existing.id)
    : await supabase.from("startup_document_access_requests").insert(payload);
  if (!result.error) {
    if (existing) {
      const { data: members } = await supabase.from("startup_members").select("user_id").eq("startup_id", startupId).in("role", ["owner","admin","editor"]);
      if (members?.length) {
        const admin = createAdminClient();
        await Promise.all(members.map((m) => admin.rpc("create_notification", {
          p_user: m.user_id, p_type: "investor", p_title: "Investor requested data room access",
          p_body: "An investor has renewed a request to access your private data room.",
          p_url: "/dashboard/startup/" + startupId + "/fundraising", p_dedupe: "startup-data-room-retry:" + startupId + ":" + profile.id + ":" + Date.now(), p_pref: null,
        })));
      }
    }
    revalidatePath("/dashboard/investor/data-rooms");
    revalidatePath("/dashboard/startup/" + startupId + "/fundraising");
  }
}

export async function reviewStartupDocumentRequestAction(fd: FormData): Promise<void> {
  const profile = await requireActiveProfile();
  const requestId = String(fd.get("requestId") ?? "");
  const decision = String(fd.get("decision") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(requestId) || !["approved","declined"].includes(decision)) return;
  const supabase = await createClient();
  const { data: request } = await supabase.from("startup_document_access_requests").select("id,startup_id").eq("id", requestId).maybeSingle();
  if (!request) return;
  const { data: membership } = await supabase.from("startup_members").select("role").eq("startup_id", request.startup_id).eq("user_id", profile.id).maybeSingle();
  if (!membership || !["owner","admin","editor"].includes(membership.role)) return;
  const { error } = await supabase.from("startup_document_access_requests").update({
    status: decision, reviewed_by: profile.id, reviewed_at: new Date().toISOString(),
  }).eq("id", requestId).eq("status", "pending");
  if (!error) {
    try {
      const { data: updated } = await supabase.from("startup_document_access_requests").select("requested_by,startup:startups(name)").eq("id", requestId).single();
      if (updated?.requested_by) await createAdminClient().rpc("create_notification", {
        p_user: updated.requested_by, p_type: "investor", p_title: "Startup data room request update",
        p_body: "Your request to access the startup data room was " + decision + ".",
        p_url: "/dashboard/investor/data-rooms", p_dedupe: "data-room-review:" + requestId + ":" + decision, p_pref: null,
      });
    } catch (err) { log.error("data room request notification failed", err); }
    revalidatePath("/dashboard/startup/" + request.startup_id + "/fundraising");
    revalidatePath("/dashboard/investor/data-rooms");
  }
}

export async function addStartupUpdateAction(fd: FormData): Promise<void> {
  const profile = await requireActiveProfile();
  const startupId = String(fd.get("startupId") ?? "");
  const title = String(fd.get("title") ?? "").trim();
  const body = String(fd.get("body") ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(startupId) || title.length < 3 || title.length > 120 || body.length < 10 || body.length > 3000) return;
  const supabase = await createClient();
  const { data: membership } = await supabase.from("startup_members").select("role").eq("startup_id", startupId).eq("user_id", profile.id).maybeSingle();
  if (!membership || !["owner","admin","editor"].includes(membership.role)) return;
  const { error } = await supabase.from("startup_updates").insert({ startup_id: startupId, author_id: profile.id, title, body });
  if (error) return;
  revalidatePath("/dashboard/investor/startups");
  revalidatePath("/startups");

}

export async function uploadStartupDocumentAction(fd: FormData): Promise<void> {
  const profile = await requireActiveProfile();
  const startupId = String(fd.get("startupId") ?? "");
  const name = String(fd.get("name") ?? "").trim().slice(0, 120);
  const documentType = String(fd.get("documentType") ?? "other");
  const description = String(fd.get("description") ?? "").trim().slice(0, 500);
  const file = fd.get("file");
  const allowed = ["application/pdf","application/vnd.openxmlformats-officedocument.presentationml.presentation","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document","text/plain"];
  if (!/^[0-9a-f-]{36}$/i.test(startupId) || name.length < 2 || !(file instanceof File) || file.size < 1 || file.size > 20 * 1024 * 1024 || !allowed.includes(file.type)) {
    return;
  }
  if (!["pitch_deck","financials","product","legal","traction","other"].includes(documentType)) return;
  const supabase = await createClient();
  const { data: membership } = await supabase.from("startup_members").select("role").eq("startup_id", startupId).eq("user_id", profile.id).maybeSingle();
  if (!membership || !["owner","admin","editor"].includes(membership.role)) return;
  const path = startupId + "/" + crypto.randomUUID() + "-" + file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100);
  const { error: uploadError } = await supabase.storage.from("startup-documents").upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) return;
  const { error } = await supabase.from("startup_documents").insert({ startup_id: startupId, uploaded_by: profile.id, name, document_type: documentType, storage_path: path, description: description || null });
  if (error) {
    await supabase.storage.from("startup-documents").remove([path]);
    return;
  }
  revalidatePath("/dashboard/startup/" + startupId + "/fundraising");

}


export async function toggleInvestorSearchAlertsAction(fd: FormData): Promise<void> {
  const profile = await requireActiveProfile();
  const id = String(fd.get("searchId") ?? "");
  const enabled = fd.get("enabled") === "true";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;
  const supabase = await createClient();
  const { data: account } = await supabase.from("investor_accounts").select("investor_id").eq("user_id", profile.id).maybeSingle();
  if (!account) return;
  await supabase.from("investor_saved_searches").update({ alerts_enabled: enabled }).eq("id", id).eq("investor_id", account.investor_id);
  revalidatePath("/dashboard/investor/searches");
}

export async function deleteInvestorSearchAction(fd: FormData): Promise<void> {
  const profile = await requireActiveProfile();
  const id = String(fd.get("searchId") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;
  const supabase = await createClient();
  const { data: account } = await supabase.from("investor_accounts").select("investor_id").eq("user_id", profile.id).maybeSingle();
  if (!account) return;
  await supabase.from("investor_saved_searches").delete().eq("id", id).eq("investor_id", account.investor_id);
  revalidatePath("/dashboard/investor/searches");
}

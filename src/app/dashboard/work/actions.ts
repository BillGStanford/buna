"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireActiveProfile } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";
import { writeAuditLog } from "@/lib/audit";
import { getSiteUrl } from "@/lib/env";
import { createLogger } from "@/lib/logger";
import { slugCandidate } from "@/lib/slug";
import { workProfileSchema, workProjectSchema, workProposalSchema, workMessageSchema, workReviewSchema, workDisputeSchema } from "@/lib/validation/work";

const log = createLogger("work-marketplace");
const fail = (path: string, code: string) => redirect(`${path}?error=${encodeURIComponent(code)}`);
const notify = async (userId: string, title: string, body: string, url: string, dedupe: string) => {
  try { await createAdminClient().rpc("create_notification", { p_user:userId,p_type:"work",p_title:title,p_body:body,p_url:url,p_dedupe:dedupe,p_pref:null }); }
  catch (error) { log.error("work notification failed", error); }
};

export async function saveWorkProfileAction(fd: FormData): Promise<void> {
  const profile = await requireActiveProfile();
  const parsed = workProfileSchema.safeParse({
    headline:fd.get("headline"),bio:fd.get("bio"),skills:fd.get("skills"),languages:fd.get("languages"),
    experienceLevel:fd.get("experienceLevel"),hourlyRate:fd.get("hourlyRate") || undefined,
    availability:fd.get("availability"),portfolioUrl:fd.get("portfolioUrl"),
  });
  if (!parsed.success) fail("/dashboard/work/profile","invalid_profile");
  const d=parsed.data;
  const supabase=await createClient();
  const {error}=await supabase.from("work_profiles").upsert({
    user_id:profile.id,headline:d.headline,bio:d.bio,skills:d.skills,languages:d.languages,
    experience_level:d.experienceLevel,hourly_rate:d.hourlyRate === "" ? null : d.hourlyRate,
    availability:d.availability,portfolio_url:d.portfolioUrl || null,is_public:true,
  },{onConflict:"user_id"});
  if(error){log.error("save freelancer profile failed",error);fail("/dashboard/work/profile","save_failed");}
  await writeAuditLog({actorId:profile.id,action:"work.profile.update",entityType:"work_profile",entityId:profile.id});
  revalidatePath("/work");revalidatePath("/work/talent");revalidatePath(`/work/talent/${profile.username}`);
  redirect("/dashboard/work/profile?saved=1");
}

export async function createWorkProjectAction(fd: FormData): Promise<void> {
  const profile=await requireActiveProfile();
  if(!(await rateLimit(`work-project:${profile.id}`,10,86400))) fail("/dashboard/work/projects/new","rate_limited");
  const parsed=workProjectSchema.safeParse({
    title:fd.get("title"),summary:fd.get("summary"),description:fd.get("description"),category:fd.get("category"),
    skills:fd.get("skills"),budgetMin:fd.get("budgetMin"),budgetMax:fd.get("budgetMax"),
    experienceLevel:fd.get("experienceLevel"),workLocation:fd.get("workLocation"),country:fd.get("country"),
    deadline:fd.get("deadline"),startupId:fd.get("startupId"),
  });
  if(!parsed.success) fail("/dashboard/work/projects/new","invalid_project");
  const d=parsed.data,supabase=await createClient();
  if(d.startupId){
    const {data:membership}=await supabase.from("startup_members").select("startup_id").eq("startup_id",d.startupId).eq("user_id",profile.id).in("role",["owner","admin","editor"]).maybeSingle();
    if(!membership) fail("/dashboard/work/projects/new","startup_access_denied");
  }
  let id:string|null=null,slug="";
  for(let i=0;i<8&&!id;i++){
    slug=slugCandidate(d.title,i,"project");
    const {data,error}=await supabase.from("work_projects").insert({
      slug,employer_id:profile.id,startup_id:d.startupId||null,title:d.title,summary:d.summary,description:d.description,
      category:d.category,skills:d.skills,budget_type:"fixed",budget_min:d.budgetMin,budget_max:d.budgetMax,currency:"ETB",
      experience_level:d.experienceLevel,work_location:d.workLocation,country:d.country||null,
      deadline:d.deadline?new Date(d.deadline).toISOString():null,status:"published",
    }).select("id").single();
    if(data)id=data.id;
    else if(error?.code!=="23505"){log.error("create work project failed",error);fail("/dashboard/work/projects/new","create_failed");}
  }
  if(!id)fail("/dashboard/work/projects/new","slug_conflict");
  await writeAuditLog({actorId:profile.id,action:"work.project.create",entityType:"work_project",entityId:id});
  revalidatePath("/work");revalidatePath("/work/projects");redirect(`/dashboard/work/projects/${id}?created=1`);
}

export async function submitWorkProposalAction(fd: FormData): Promise<void> {
  const profile=await requireActiveProfile();
  if(!(await rateLimit(`work-proposal:${profile.id}`,20,86400))) fail("/work/projects","rate_limited");
  const parsed=workProposalSchema.safeParse({
    projectId:fd.get("projectId"),coverLetter:fd.get("coverLetter"),proposedAmount:fd.get("proposedAmount"),
    estimatedDays:fd.get("estimatedDays"),relevantWorkUrl:fd.get("relevantWorkUrl"),
  });
  if(!parsed.success)fail("/work/projects","invalid_proposal");
  const d=parsed.data,supabase=await createClient();
  const {data:workProfile}=await supabase.from("work_profiles").select("user_id,is_public").eq("user_id",profile.id).maybeSingle();
  if(!workProfile?.is_public)fail("/dashboard/work/profile","activate_freelancer_profile");
  const {data:project}=await supabase.from("work_projects").select("id,slug,title,employer_id,status,budget_min,budget_max").eq("id",d.projectId).eq("status","published").maybeSingle();
  if(!project||project.employer_id===profile.id)fail("/work/projects","project_unavailable");
  if(d.proposedAmount<Number(project.budget_min)||d.proposedAmount>Number(project.budget_max))fail(`/work/projects/${project.slug}`,"proposal_outside_budget");
  const {error}=await supabase.from("work_proposals").insert({
    project_id:d.projectId,freelancer_id:profile.id,cover_letter:d.coverLetter,proposed_amount:d.proposedAmount,
    estimated_days:d.estimatedDays,relevant_work_url:d.relevantWorkUrl||null,
  });
  if(error){if(error.code==="23505")fail(`/work/projects/${project.slug}`,"already_applied");log.error("submit work proposal failed",error);fail(`/work/projects/${project.slug}`,"proposal_failed");}
  await notify(project.employer_id,"New proposal for "+project.title,(profile.display_name||profile.username)+" submitted a proposal.","/dashboard/work/projects/"+project.id,"work-proposal:"+d.projectId+":"+profile.id);
  await writeAuditLog({actorId:profile.id,action:"work.proposal.submit",entityType:"work_project",entityId:d.projectId});
  revalidatePath("/dashboard/work/proposals");revalidatePath("/dashboard/work/projects/"+d.projectId);
  redirect(`/work/projects/${project.slug}?proposal=submitted`);
}

export async function shortlistWorkProposalAction(fd: FormData): Promise<void> {
  const profile=await requireActiveProfile(),proposalId=String(fd.get("proposalId")||"");
  const supabase=await createClient();
  const {data:proposal}=await supabase.from("work_proposals").select("id,project_id,freelancer_id,status,work_projects!inner(employer_id,title)").eq("id",proposalId).maybeSingle();
  const project=Array.isArray(proposal?.work_projects)?proposal.work_projects[0]:proposal?.work_projects;
  if(!proposal||project?.employer_id!==profile.id||!["submitted","shortlisted"].includes(proposal.status))fail("/dashboard/work","proposal_unavailable");
  const {error}=await supabase.from("work_proposals").update({status:"shortlisted"}).eq("id",proposalId);
  if(error)fail("/dashboard/work","shortlist_failed");
  await notify(proposal.freelancer_id,"Your proposal was shortlisted","The employer is considering your proposal.","/dashboard/work/proposals","work-shortlist:"+proposalId);
  revalidatePath("/dashboard/work/projects/"+proposal.project_id);redirect("/dashboard/work?updated=1");
}

export async function hireWorkProposalAction(fd: FormData): Promise<void> {
  const profile=await requireActiveProfile(),proposalId=String(fd.get("proposalId")||"");
  const supabase=await createClient();
  const {data,error}=await supabase.rpc("hire_work_proposal",{p_proposal:proposalId});
  if(error||!data){log.error("hire proposal failed",error);fail("/dashboard/work","hire_failed");}
  await writeAuditLog({actorId:profile.id,action:"work.contract.create",entityType:"work_contract",entityId:data});
  revalidatePath("/dashboard/work");revalidatePath("/dashboard/work/contracts");redirect(`/dashboard/work/contracts/${data}`);
}

export async function submitWorkMilestoneAction(fd: FormData): Promise<void> {
  const profile=await requireActiveProfile(),milestoneId=String(fd.get("milestoneId")||"");
  const url=String(fd.get("deliverableUrl")||"").trim(),note=String(fd.get("note")||"").trim();
  if(!/^https?:\/\//i.test(url)||note.length>2000)fail("/dashboard/work/contracts","invalid_deliverable");
  const supabase=await createClient();
  const {error}=await supabase.rpc("transition_work_milestone",{p_milestone:milestoneId,p_action:"submit",p_url:url,p_note:note});
  if(error){log.error("submit milestone failed",error);fail("/dashboard/work/contracts","submit_failed");}
  const {data:milestone}=await supabase.from("work_milestones").select("contract_id,work_contracts!inner(employer_id)").eq("id",milestoneId).maybeSingle();
  const contract=Array.isArray(milestone?.work_contracts)?milestone.work_contracts[0]:milestone?.work_contracts;
  if(contract?.employer_id)await notify(contract.employer_id,"Work submitted","A milestone deliverable is ready for review.","/dashboard/work/contracts/"+milestone.contract_id,"work-milestone-submit:"+milestoneId);
  revalidatePath("/dashboard/work/contracts");redirect("/dashboard/work/contracts?submitted=1");
}

export async function reviewWorkMilestoneAction(fd: FormData): Promise<void> {
  const profile=await requireActiveProfile(),milestoneId=String(fd.get("milestoneId")||""),action=String(fd.get("action")||"");
  const note=String(fd.get("note")||"").trim();
  if(!["approve","revision"].includes(action)||note.length>2000)fail("/dashboard/work/contracts","invalid_review");
  const supabase=await createClient();
  const {error}=await supabase.rpc("transition_work_milestone",{p_milestone:milestoneId,p_action:action,p_url:null,p_note:note});
  if(error){log.error("review milestone failed",error);fail("/dashboard/work/contracts","review_failed");}
  revalidatePath("/dashboard/work/contracts");redirect("/dashboard/work/contracts?reviewed=1");
}

export async function sendWorkMessageAction(fd: FormData): Promise<void> {
  const profile=await requireActiveProfile();
  const parsed=workMessageSchema.safeParse({contractId:fd.get("contractId"),body:fd.get("body"),attachmentUrl:fd.get("attachmentUrl")});
  if(!parsed.success)fail("/dashboard/work/contracts","invalid_message");
  const d=parsed.data,supabase=await createClient();
  const {data:contract}=await supabase.from("work_contracts").select("id,employer_id,freelancer_id").eq("id",d.contractId).maybeSingle();
  if(!contract||![contract.employer_id,contract.freelancer_id].includes(profile.id))fail("/dashboard/work/contracts","contract_unavailable");
  const {error}=await supabase.from("work_messages").insert({contract_id:d.contractId,sender_id:profile.id,body:d.body,attachment_url:d.attachmentUrl||null});
  if(error)fail("/dashboard/work/contracts","message_failed");
  const recipient=contract.employer_id===profile.id?contract.freelancer_id:contract.employer_id;
  await notify(recipient,"New contract message",(profile.display_name||profile.username)+" sent you a message.","/dashboard/work/contracts/"+d.contractId,"work-message:"+d.contractId+":"+Date.now());
  revalidatePath("/dashboard/work/contracts/"+d.contractId);redirect(`/dashboard/work/contracts/${d.contractId}?message=sent`);
}

export async function openWorkDisputeAction(fd: FormData): Promise<void> {
  const profile=await requireActiveProfile();
  const parsed=workDisputeSchema.safeParse({contractId:fd.get("contractId"),reason:fd.get("reason"),evidenceUrl:fd.get("evidenceUrl")});
  if(!parsed.success)fail("/dashboard/work/contracts","invalid_dispute");
  const supabase=await createClient();
  const {error}=await supabase.rpc("open_work_dispute",{p_contract:parsed.data.contractId,p_reason:parsed.data.reason,p_evidence_url:parsed.data.evidenceUrl||null});
  if(error){log.error("open dispute failed",error);fail("/dashboard/work/contracts","dispute_failed");}
  await writeAuditLog({actorId:profile.id,action:"work.dispute.open",entityType:"work_contract",entityId:parsed.data.contractId});
  revalidatePath("/dashboard/work/contracts");redirect("/dashboard/work/contracts?dispute=open");
}

export async function leaveWorkReviewAction(fd: FormData): Promise<void> {
  const profile=await requireActiveProfile();
  const parsed=workReviewSchema.safeParse({contractId:fd.get("contractId"),rating:fd.get("rating"),comment:fd.get("comment")});
  if(!parsed.success)fail("/dashboard/work/contracts","invalid_review");
  const supabase=await createClient();
  const {data:contract}=await supabase.from("work_contracts").select("employer_id,freelancer_id,status").eq("id",parsed.data.contractId).maybeSingle();
  if(!contract||contract.status!=="completed"||![contract.employer_id,contract.freelancer_id].includes(profile.id))fail("/dashboard/work/contracts","review_unavailable");
  const reviewee=contract.employer_id===profile.id?contract.freelancer_id:contract.employer_id;
  const {error}=await supabase.from("work_reviews").insert({contract_id:parsed.data.contractId,reviewer_id:profile.id,reviewee_id:reviewee,rating:parsed.data.rating,comment:parsed.data.comment});
  if(error)fail("/dashboard/work/contracts","review_failed");
  await writeAuditLog({actorId:profile.id,action:"work.review.create",entityType:"work_contract",entityId:parsed.data.contractId});
  revalidatePath("/work/talent");revalidatePath("/dashboard/work/contracts");redirect("/dashboard/work/contracts?reviewed=1");
}

export async function connectWorkPayoutAccountAction(fd: FormData): Promise<void> {
  const profile=await requireActiveProfile();
  const bankSlug=String(fd.get("bankSlug")||"").trim().toLowerCase();
  const accountName=String(fd.get("accountName")||"").trim();
  const accountNumber=String(fd.get("accountNumber")||"").replace(/\s/g,"");
  if(!/^[a-z0-9_-]{2,40}$/.test(bankSlug)||accountName.length<3||accountName.length>100||!/^[0-9]{6,32}$/.test(accountNumber))fail("/dashboard/work/profile","invalid_payout_details");
  const secret=process.env.CHAPA_PRIVATE_KEY;
  if(!secret)fail("/dashboard/work/profile","payments_not_configured");
  const response=await fetch("https://api.chapa.global/v2/subaccounts",{method:"POST",headers:{"Authorization":`Bearer ${secret}`,"Content-Type":"application/json"},body:JSON.stringify({
    subaccount_name:profile.display_name||profile.username,account:{account_number:accountNumber,account_name:accountName,bank_slug:bankSlug,bank_name:bankSlug},
    currency:"ETB",split_type:"percentage",split_value:90,is_primary:false,
  }),cache:"no-store"});
  const payload=await response.json().catch(()=>null);
  const reference=payload?.data?.subaccount_reference;
  if(!response.ok||payload?.status!=="success"||typeof reference!=="string"){log.error("Chapa subaccount setup failed",{status:response.status});fail("/dashboard/work/profile","payout_setup_failed");}
  const admin=createAdminClient();
  const {error}=await admin.from("work_payout_accounts").upsert({user_id:profile.id,provider:"chapa",provider_reference:reference,bank_slug:bankSlug,account_last4:accountNumber.slice(-4),status:"active"},{onConflict:"user_id"});
  if(error){log.error("save Chapa payout reference failed",error);fail("/dashboard/work/profile","payout_reference_save_failed");}
  await writeAuditLog({actorId:profile.id,action:"work.payout_account.connect",entityType:"work_payout_account",entityId:profile.id,metadata:{provider:"chapa",bankSlug,accountLast4:accountNumber.slice(-4)}});
  revalidatePath("/dashboard/work/profile");redirect("/dashboard/work/profile?payout=connected");
}

export async function createWorkPaymentAction(fd: FormData): Promise<void> {
  const profile=await requireActiveProfile(),milestoneId=String(fd.get("milestoneId")||"");
  const supabase=await createClient();
  const {data:milestone}=await supabase.from("work_milestones").select("id,contract_id,amount,status,work_contracts!inner(id,employer_id,freelancer_id,status)").eq("id",milestoneId).maybeSingle();
  const contract=Array.isArray(milestone?.work_contracts)?milestone.work_contracts[0]:milestone?.work_contracts;
  if(!milestone||!contract||contract.employer_id!==profile.id||milestone.status!=="approved"||contract.status!=="active")fail("/dashboard/work/contracts","payment_not_ready");
  const admin=createAdminClient();
  const {data:payout}=await admin.from("work_payout_accounts").select("provider_reference,status").eq("user_id",contract.freelancer_id).eq("status","active").maybeSingle();
  if(!payout)fail("/dashboard/work/contracts","freelancer_payout_not_configured");
  const secret=process.env.CHAPA_PRIVATE_KEY;
  if(!secret)fail("/dashboard/work/contracts","payments_not_configured");
  const amountMinor=Math.round(Number(milestone.amount)*100);
  if(!Number.isSafeInteger(amountMinor)||amountMinor<100)fail("/dashboard/work/contracts","invalid_payment_amount");
  const paymentId=crypto.randomUUID(),merchantReference="BW"+crypto.randomUUID().replace(/-/g,"").slice(0,18);
  const {error:insertError}=await admin.from("work_payment_transactions").insert({
    id:paymentId,milestone_id:milestone.id,contract_id:contract.id,employer_id:profile.id,freelancer_id:contract.freelancer_id,
    merchant_reference:merchantReference,amount_minor:amountMinor,currency:"ETB",platform_fee_percent:10,freelancer_share_percent:90,status:"pending",
  });
  if(insertError){log.error("create work payment ledger row failed",insertError);fail("/dashboard/work/contracts","payment_setup_failed");}
  const {data:authData}=await supabase.auth.getUser();
  const name=(profile.display_name||"Buna member").trim().split(/\s+/);
  const site=getSiteUrl();
  const response=await fetch("https://api.chapa.global/v2/payments/hosted",{method:"POST",headers:{
    "Authorization":`Bearer ${secret}`,"Content-Type":"application/json","Idempotency-Key":paymentId,
  },body:JSON.stringify({
    amount:amountMinor,currency:"ETB",merchant_reference:merchantReference,
    customer:{first_name:name[0],last_name:name.slice(1).join(" ")||name[0],email:authData.user?.email},
    callback_url:`${site}/api/webhooks/chapa`,return_url:`${site}/api/work/payments/return?payment_id=${paymentId}`,
    meta:{work_payment_id:paymentId,contract_id:contract.id,milestone_id:milestone.id},
    customization:{title:"Buna Work milestone",description:"Payment for approved freelance work"},
    subaccounts:[{subaccount_reference:payout.provider_reference,split_type:"percentage",split_value:90}],
  }),cache:"no-store"});
  const payload=await response.json().catch(()=>null);
  const checkout=payload?.data?.checkout_url;
  if(!response.ok||payload?.status!=="success"||typeof checkout!=="string"){
    await admin.from("work_payment_transactions").update({status:"failed"}).eq("id",paymentId);
    log.error("Chapa hosted checkout initialization failed",{status:response.status});fail("/dashboard/work/contracts","checkout_failed");
  }
  let checkoutUrl:URL;
  try{checkoutUrl=new URL(checkout);}catch{fail("/dashboard/work/contracts","checkout_invalid");}
  if(checkoutUrl.protocol!=="https:"||!checkoutUrl.hostname.endsWith("chapa.global"))fail("/dashboard/work/contracts","checkout_invalid");
  await admin.from("work_payment_transactions").update({checkout_url:checkout}).eq("id",paymentId);
  redirect(checkout);
}


export async function inviteWorkFreelancerAction(fd:FormData):Promise<void>{
 const profile=await requireActiveProfile(),projectId=String(fd.get("projectId")||""),freelancerId=String(fd.get("freelancerId")||""),message=String(fd.get("message")||"").trim();
 if(!/^[0-9a-f-]{36}$/i.test(projectId)||!/^[0-9a-f-]{36}$/i.test(freelancerId)||message.length<20||message.length>1500)fail("/dashboard/work","invalid_invitation");
 const supabase=await createClient();
 const {data:project}=await supabase.from("work_projects").select("id,title,status,employer_id").eq("id",projectId).eq("employer_id",profile.id).eq("status","published").maybeSingle();
 if(!project)fail("/dashboard/work","project_unavailable");
 const {data:freelancer}=await supabase.from("work_profiles").select("user_id").eq("user_id",freelancerId).eq("is_public",true).maybeSingle();
 if(!freelancer)fail("/dashboard/work","freelancer_unavailable");
 const {error}=await supabase.from("work_invitations").insert({project_id:projectId,employer_id:profile.id,freelancer_id:freelancerId,message});
 if(error){if(error.code==="23505")fail("/dashboard/work","already_invited");log.error("send freelancer invitation failed",error);fail("/dashboard/work","invitation_failed");}
 await notify(freelancerId,"You were invited to a Buna Work project",project.title+": "+message,"/dashboard/work/invitations","work-invite:"+projectId+":"+freelancerId);
 await writeAuditLog({actorId:profile.id,action:"work.invitation.send",entityType:"work_project",entityId:projectId});
 revalidatePath("/dashboard/work/invitations");redirect("/dashboard/work?invited=1");
}

export async function respondWorkInvitationAction(fd:FormData):Promise<void>{
 const profile=await requireActiveProfile(),invitationId=String(fd.get("invitationId")||""),action=String(fd.get("action")||"");
 const supabase=await createClient();
 if(action==="decline"){
  const {error}=await supabase.from("work_invitations").update({status:"declined"}).eq("id",invitationId).eq("freelancer_id",profile.id).eq("status","pending");
  if(error)fail("/dashboard/work/invitations","decline_failed");
  revalidatePath("/dashboard/work/invitations");redirect("/dashboard/work/invitations?declined=1");
 }
 const coverLetter=String(fd.get("coverLetter")||"").trim(),amount=Number(fd.get("proposedAmount")),days=Number(fd.get("estimatedDays")),portfolio=String(fd.get("relevantWorkUrl")||"").trim();
 if(action!=="accept"||coverLetter.length<80||coverLetter.length>3000||!Number.isFinite(amount)||!Number.isInteger(days)||days<1||days>365||portfolio&&!/^https?:\/\//i.test(portfolio))fail("/dashboard/work/invitations","invalid_response");
 const {data,error}=await supabase.rpc("respond_work_invitation",{p_invitation:invitationId,p_action:"accept",p_cover_letter:coverLetter,p_amount:amount,p_days:days,p_portfolio_url:portfolio||null});
 if(error||!data){log.error("accept work invitation failed",error);fail("/dashboard/work/invitations","accept_failed");}
 revalidatePath("/dashboard/work/invitations");revalidatePath("/dashboard/work/proposals");redirect("/dashboard/work/proposals?invitation=accepted");
}

export async function updateWorkProjectStatusAction(fd:FormData):Promise<void>{
 const profile=await requireActiveProfile(),projectId=String(fd.get("projectId")||""),status=String(fd.get("status")||"");
 if(!["paused","closed","published"].includes(status))fail("/dashboard/work/projects","invalid_status");
 const supabase=await createClient();
 const {data,error}=await supabase.from("work_projects").update({status}).eq("id",projectId).eq("employer_id",profile.id).select("id").maybeSingle();
 if(error||!data)fail("/dashboard/work/projects","status_update_failed");
 revalidatePath("/work");revalidatePath("/work/projects");revalidatePath("/dashboard/work/projects/"+projectId);redirect("/dashboard/work/projects/"+projectId+"?updated=1");
}

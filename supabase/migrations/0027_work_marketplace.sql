-- Buna 0027: Work marketplace, private contracts and verified Chapa split payments.

-- Work events can participate in the existing notification email queue.
alter table public.notification_preferences add column email_work boolean not null default true;
grant update (email_work) on public.notification_preferences to authenticated;

create or replace function public.create_notification(
  p_user uuid,p_type text,p_title text,p_body text,p_url text,p_dedupe text,p_pref text default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare v_email boolean := false;
begin
  if p_user is null then return; end if;
  select case p_pref
    when 'comments' then np.email_comments
    when 'replies' then np.email_replies
    when 'inquiries' then np.email_inquiries
    when 'moderation' then np.email_moderation
    when 'deadlines' then np.email_opportunity_deadlines
    when 'work' then np.email_work
    else false
  end into v_email
  from public.notification_preferences np where np.user_id=p_user;
  insert into public.notifications(user_id,type,title,body,url,dedupe_key,email_status)
  values(p_user,p_type,p_title,p_body,p_url,p_dedupe,
    case when coalesce(v_email,false) then 'pending'::public.email_delivery_status end)
  on conflict(user_id,dedupe_key) do nothing;
end;
$$;

create table public.work_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  headline text not null,
  bio text not null,
  skills text[] not null default '{}',
  languages text[] not null default '{}',
  experience_level text not null default 'intermediate',
  hourly_rate numeric(12,2),
  currency char(3) not null default 'ETB',
  availability text not null default 'available',
  portfolio_url text,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint work_profile_headline_len check (char_length(headline) between 5 and 120),
  constraint work_profile_bio_len check (char_length(bio) between 30 and 3000),
  constraint work_profile_skills_len check (cardinality(skills) between 1 and 20),
  constraint work_profile_languages_len check (cardinality(languages) <= 10),
  constraint work_profile_experience check (experience_level in ('entry','intermediate','expert')),
  constraint work_profile_hourly_rate check (hourly_rate is null or hourly_rate > 0),
  constraint work_profile_currency check (currency='ETB'),
  constraint work_profile_availability check (availability in ('available','limited','unavailable')),
  constraint work_profile_portfolio_url check (portfolio_url is null or portfolio_url ~* '^https?://')
);
create trigger work_profiles_updated_at before update on public.work_profiles
for each row execute function public.set_updated_at();
create index work_profiles_skills_idx on public.work_profiles using gin(skills);
create index work_profiles_discoverable_idx on public.work_profiles(is_public,availability);

create table public.work_portfolio_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text not null,
  project_url text,
  image_url text,
  skills text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint work_portfolio_title_len check (char_length(title) between 4 and 120),
  constraint work_portfolio_description_len check (char_length(description) between 20 and 2000),
  constraint work_portfolio_project_url check (project_url is null or project_url ~* '^https?://'),
  constraint work_portfolio_image_url check (image_url is null or image_url ~* '^https?://'),
  constraint work_portfolio_skills_len check (cardinality(skills)<=10)
);
create trigger work_portfolio_items_updated_at before update on public.work_portfolio_items
for each row execute function public.set_updated_at();
create index work_portfolio_items_user_idx on public.work_portfolio_items(user_id,created_at desc);

create table public.work_projects (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  employer_id uuid not null references public.profiles(id) on delete cascade,
  startup_id uuid references public.startups(id) on delete set null,
  title text not null,
  summary text not null,
  description text not null,
  category text not null,
  skills text[] not null default '{}',
  budget_type text not null default 'fixed',
  budget_min numeric(12,2) not null,
  budget_max numeric(12,2) not null,
  currency char(3) not null default 'ETB',
  experience_level text not null default 'intermediate',
  work_location text not null default 'remote',
  country char(2),
  deadline timestamptz,
  status text not null default 'published',
  applications_count int not null default 0,
  hired_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint work_project_title_len check (char_length(title) between 8 and 120),
  constraint work_project_summary_len check (char_length(summary) between 20 and 220),
  constraint work_project_description_len check (char_length(description) between 80 and 8000),
  constraint work_project_category_len check (char_length(category) between 2 and 60),
  constraint work_project_skills_len check (cardinality(skills) between 1 and 15),
  constraint work_project_budget_type check (budget_type='fixed'),
  constraint work_project_budget_range check (budget_min>0 and budget_max>=budget_min),
  constraint work_project_currency check (currency='ETB'),
  constraint work_project_experience check (experience_level in ('entry','intermediate','expert')),
  constraint work_project_location check (work_location in ('remote','hybrid','onsite')),
  constraint work_project_status check (status in ('draft','published','paused','filled','closed'))
);
create trigger work_projects_updated_at before update on public.work_projects
for each row execute function public.set_updated_at();
create index work_projects_feed_idx on public.work_projects(status,created_at desc);
create index work_projects_skills_idx on public.work_projects using gin(skills);
create index work_projects_employer_idx on public.work_projects(employer_id,created_at desc);

create table public.work_project_reports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.work_projects(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null,
  details text,
  status text not null default 'open',
  handled_by uuid references public.profiles(id) on delete set null,
  handled_at timestamptz,
  resolution text,
  created_at timestamptz not null default now(),
  constraint work_project_report_reason_len check (char_length(reason) between 3 and 80),
  constraint work_project_report_details_len check (details is null or char_length(details)<=1500),
  constraint work_project_report_status check (status in ('open','reviewing','actioned','dismissed')),
  unique(project_id,reporter_id)
);
create index work_project_reports_queue_idx on public.work_project_reports(status,created_at desc);

create table public.work_proposals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.work_projects(id) on delete cascade,
  freelancer_id uuid not null references public.profiles(id) on delete cascade,
  cover_letter text not null,
  proposed_amount numeric(12,2) not null,
  estimated_days int not null,
  relevant_work_url text,
  status text not null default 'submitted',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint work_proposal_cover_len check (char_length(cover_letter) between 80 and 3000),
  constraint work_proposal_amount check (proposed_amount>0),
  constraint work_proposal_days check (estimated_days between 1 and 365),
  constraint work_proposal_url check (relevant_work_url is null or relevant_work_url ~* '^https?://'),
  constraint work_proposal_status check (status in ('submitted','shortlisted','declined','withdrawn','hired')),
  unique(project_id,freelancer_id)
);
create trigger work_proposals_updated_at before update on public.work_proposals
for each row execute function public.set_updated_at();
create index work_proposals_project_idx on public.work_proposals(project_id,status,created_at);
create index work_proposals_freelancer_idx on public.work_proposals(freelancer_id,created_at desc);

create table public.work_invitations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.work_projects(id) on delete cascade,
  employer_id uuid not null references public.profiles(id) on delete cascade,
  freelancer_id uuid not null references public.profiles(id) on delete cascade,
  message text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint work_invitation_message_len check (char_length(message) between 20 and 1500),
  constraint work_invitation_status check (status in ('pending','accepted','declined','cancelled')),
  constraint work_invitation_parties check (employer_id<>freelancer_id),
  unique(project_id,freelancer_id)
);
create trigger work_invitations_updated_at before update on public.work_invitations
for each row execute function public.set_updated_at();
create index work_invitations_freelancer_idx on public.work_invitations(freelancer_id,status,created_at desc);
create index work_invitations_employer_idx on public.work_invitations(employer_id,status,created_at desc);

create table public.work_contracts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.work_projects(id) on delete restrict,
  proposal_id uuid not null unique references public.work_proposals(id) on delete restrict,
  employer_id uuid not null references public.profiles(id) on delete restrict,
  freelancer_id uuid not null references public.profiles(id) on delete restrict,
  title text not null,
  scope text not null,
  agreed_amount numeric(12,2) not null,
  currency char(3) not null default 'ETB',
  status text not null default 'active',
  started_at timestamptz not null default now(),
  due_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint work_contract_amount check (agreed_amount>0),
  constraint work_contract_currency check (currency='ETB'),
  constraint work_contract_status check (status in ('active','completed','cancelled','disputed')),
  constraint work_contract_scope_len check (char_length(scope) between 80 and 8000),
  constraint work_contract_parties check (employer_id<>freelancer_id)
);
create trigger work_contracts_updated_at before update on public.work_contracts
for each row execute function public.set_updated_at();
create index work_contracts_employer_idx on public.work_contracts(employer_id,status,created_at desc);
create index work_contracts_freelancer_idx on public.work_contracts(freelancer_id,status,created_at desc);

create table public.work_milestones (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.work_contracts(id) on delete cascade,
  title text not null,
  description text not null,
  amount numeric(12,2) not null,
  due_at timestamptz,
  status text not null default 'pending',
  deliverable_url text,
  deliverable_path text,
  submission_note text,
  employer_note text,
  submitted_at timestamptz,
  approved_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint work_milestone_title_len check (char_length(title) between 3 and 120),
  constraint work_milestone_description_len check (char_length(description) between 10 and 2000),
  constraint work_milestone_amount check (amount>0),
  constraint work_milestone_status check (status in ('pending','submitted','revision_requested','approved','paid')),
  constraint work_milestone_url check (deliverable_url is null or deliverable_url ~* '^https?://'),
  constraint work_milestone_path check (deliverable_path is null or deliverable_path ~* '^[0-9a-f-]{36}/[0-9a-f-]{36}/[a-zA-Z0-9._-]+$'),
  constraint work_one_milestone_v1 unique(contract_id)
);
create trigger work_milestones_updated_at before update on public.work_milestones
for each row execute function public.set_updated_at();
create index work_milestones_contract_idx on public.work_milestones(contract_id,created_at);

create table public.work_messages (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.work_contracts(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  attachment_url text,
  attachment_path text,
  created_at timestamptz not null default now(),
  constraint work_message_body_len check (char_length(body) between 1 and 4000),
  constraint work_message_attachment_url check (attachment_url is null or attachment_url ~* '^https?://'),
  constraint work_message_attachment_path check (attachment_path is null or attachment_path ~* '^[0-9a-f-]{36}/[0-9a-f-]{36}/[a-zA-Z0-9._-]+$')
);
create index work_messages_contract_idx on public.work_messages(contract_id,created_at);

create table public.work_reviews (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.work_contracts(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  reviewee_id uuid not null references public.profiles(id) on delete cascade,
  rating int not null,
  comment text not null,
  created_at timestamptz not null default now(),
  constraint work_review_rating check (rating between 1 and 5),
  constraint work_review_comment_len check (char_length(comment) between 20 and 1200),
  constraint work_review_not_self check (reviewer_id<>reviewee_id),
  unique(contract_id,reviewer_id)
);
create index work_reviews_reviewee_idx on public.work_reviews(reviewee_id,created_at desc);

create table public.work_disputes (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.work_contracts(id) on delete cascade,
  opened_by uuid not null references public.profiles(id) on delete cascade,
  reason text not null,
  evidence_url text,
  status text not null default 'open',
  resolution text,
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  constraint work_dispute_reason_len check (char_length(reason) between 50 and 3000),
  constraint work_dispute_evidence_url check (evidence_url is null or evidence_url ~* '^https?://'),
  constraint work_dispute_status check (status in ('open','reviewing','resolved','rejected')),
  unique(contract_id)
);

create table public.work_payout_accounts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  provider text not null default 'chapa',
  provider_reference text not null unique,
  bank_slug text not null,
  bank_name text not null,
  account_last4 text not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint work_payout_status check (status in ('active','disabled'))
);
create trigger work_payout_accounts_updated_at before update on public.work_payout_accounts
for each row execute function public.set_updated_at();

create table public.work_payment_transactions (
  id uuid primary key default gen_random_uuid(),
  milestone_id uuid not null references public.work_milestones(id) on delete restrict,
  contract_id uuid not null references public.work_contracts(id) on delete restrict,
  employer_id uuid not null references public.profiles(id) on delete restrict,
  freelancer_id uuid not null references public.profiles(id) on delete restrict,
  provider text not null default 'chapa',
  merchant_reference text not null unique,
  provider_reference text,
  processor_reference text,
  payment_method text,
  provider_fee_minor bigint,
  checkout_url text,
  checkout_expires_at timestamptz,
  amount_minor bigint not null,
  currency char(3) not null default 'ETB',
  platform_fee_percent numeric(5,2) not null default 10,
  freelancer_share_percent numeric(5,2) not null default 90,
  status text not null default 'pending',
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint work_payment_amount check (amount_minor>=100),
  constraint work_payment_provider_fee check (provider_fee_minor is null or provider_fee_minor>=0),
  constraint work_payment_method_len check (payment_method is null or char_length(payment_method)<=80),
  constraint work_payment_processor_reference_len check (processor_reference is null or char_length(processor_reference)<=200),
  constraint work_payment_currency check (currency='ETB'),
  constraint work_payment_fee check (platform_fee_percent>=0 and freelancer_share_percent>0 and platform_fee_percent+freelancer_share_percent=100),
  constraint work_payment_status check (status in ('pending','succeeded','failed','cancelled'))
);
create trigger work_payment_transactions_updated_at before update on public.work_payment_transactions
for each row execute function public.set_updated_at();
create index work_payments_milestone_idx on public.work_payment_transactions(milestone_id,created_at desc);
create unique index work_payments_one_pending_per_milestone on public.work_payment_transactions(milestone_id) where status='pending';

create table public.chapa_webhook_events (
  id uuid primary key default gen_random_uuid(),
  body_hash char(64) not null unique,
  webhook_type text not null,
  event text not null,
  event_status text,
  mode text,
  merchant_reference text,
  payment_id uuid references public.work_payment_transactions(id) on delete set null,
  processing_status text not null default 'received',
  last_error text,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  constraint chapa_webhook_event_status check (processing_status in ('received','retry','processed','ignored'))
);
create index chapa_webhook_events_retry_idx on public.chapa_webhook_events(processing_status,created_at);
alter table public.chapa_webhook_events enable row level security;
revoke all on public.chapa_webhook_events from public,anon,authenticated;
grant select,insert,update on public.chapa_webhook_events to service_role;

create view public.work_public_history as
select c.id,c.freelancer_id,c.title,c.completed_at
from public.work_contracts c
join public.work_profiles wp on wp.user_id=c.freelancer_id and wp.is_public=true
join public.profiles p on p.id=c.freelancer_id and p.is_public_profile=true and not p.is_suspended
where c.status='completed';
grant select on public.work_public_history to anon,authenticated;

create function public.is_work_project_applicant(p_project uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.work_proposals wp where wp.project_id=p_project and wp.freelancer_id=auth.uid())
$$;
revoke all on function public.is_work_project_applicant(uuid) from public,anon;
grant execute on function public.is_work_project_applicant(uuid) to anon,authenticated;

create function public.is_work_project_manager(p_project uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(
    select 1 from public.work_projects p
    where p.id=p_project and (
      p.employer_id=auth.uid() or exists(
        select 1 from public.startup_members sm
        where sm.startup_id=p.startup_id and sm.user_id=auth.uid() and sm.role in ('owner','admin','editor')
      )
    )
  )
$$;
revoke all on function public.is_work_project_manager(uuid) from public;
grant execute on function public.is_work_project_manager(uuid) to anon,authenticated;

create function public.work_contract_party(p_contract uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.work_contracts c where c.id=p_contract and (auth.uid()=c.freelancer_id or public.is_work_project_manager(c.project_id)))
$$;
revoke all on function public.work_contract_party(uuid) from public,anon;
grant execute on function public.work_contract_party(uuid) to authenticated;

create function public.hire_work_proposal(p_proposal uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v record; v_contract uuid;
begin
  if not public.is_active_user() then raise exception 'inactive_user' using errcode='42501'; end if;
  select p.id as proposal_id,p.project_id,p.freelancer_id,p.proposed_amount,p.estimated_days,p.status as proposal_status,
         w.employer_id,w.title,w.description,w.status,w.currency,w.id as project
    into v
    from public.work_proposals p join public.work_projects w on w.id=p.project_id
   where p.id=p_proposal for update of p,w;
  if not found or not public.is_work_project_manager(v.project) then raise exception 'not_project_manager' using errcode='42501'; end if;
  if v.status<>'published' then raise exception 'project_not_open' using errcode='55000'; end if;
  if v.proposal_status not in ('submitted','shortlisted') then raise exception 'proposal_not_hireable' using errcode='55000'; end if;
  if exists(select 1 from public.work_contracts where project_id=v.project) then raise exception 'already_hired' using errcode='23505'; end if;
  if not exists(select 1 from public.work_profiles wp join public.profiles pr on pr.id=wp.user_id where wp.user_id=v.freelancer_id and wp.is_public and pr.is_public_profile and not pr.is_suspended) then raise exception 'freelancer_unavailable' using errcode='23514'; end if;
  insert into public.work_contracts(project_id,proposal_id,employer_id,freelancer_id,title,scope,agreed_amount,currency,due_at)
  values(v.project,v.proposal_id,v.employer_id,v.freelancer_id,v.title,v.description,v.proposed_amount,v.currency,
    now()+make_interval(days=>v.estimated_days)) returning id into v_contract;
  insert into public.work_milestones(contract_id,title,description,amount,due_at)
  values(v_contract,'Project delivery','Complete the agreed project scope and submit the deliverable.',v.proposed_amount,
    now()+make_interval(days=>v.estimated_days));
  update public.work_proposals set status=case when id=p_proposal then 'hired' else 'declined' end
   where project_id=v.project and status in ('submitted','shortlisted');
  update public.work_projects set status='filled',hired_at=now() where id=v.project;
  perform public.create_notification(v.freelancer_id,'work','You were hired on Buna Work',
    'A project contract is ready. Open your Work dashboard to review the terms.',
    '/dashboard/work/contracts','work-hired:'||v_contract::text,'work');
  return v_contract;
end;
$$;
revoke all on function public.hire_work_proposal(uuid) from public,anon;
grant execute on function public.hire_work_proposal(uuid) to authenticated;

create function public.transition_work_milestone(p_milestone uuid,p_action text,p_url text default null,p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v record;
begin
  if not public.is_active_user() then raise exception 'inactive_user' using errcode='42501'; end if;
  select m.*,c.employer_id,c.freelancer_id,c.id as contract,c.status as contract_status
    into v from public.work_milestones m join public.work_contracts c on c.id=m.contract_id
   where m.id=p_milestone for update of m;
  if not found or not public.work_contract_party(v.contract) then raise exception 'not_contract_party' using errcode='42501'; end if;
  if v.contract_status<>'active' then raise exception 'contract_not_active' using errcode='55000'; end if;
  if p_action='submit' then
    if auth.uid()<>v.freelancer_id or v.status not in ('pending','revision_requested') or p_url is null
      or (p_url !~* '^https?://' and p_url !~* '^[0-9a-f-]{36}/[0-9a-f-]{36}/[a-zA-Z0-9._-]+$') then
      raise exception 'invalid_submission' using errcode='22023';
    end if;
    if p_url !~* '^https?://' and (
      split_part(p_url,'/',1)<>v.contract::text or split_part(p_url,'/',2)<>auth.uid()::text
      or not exists(select 1 from storage.objects where bucket_id='work-deliverables' and name=p_url)
    ) then raise exception 'deliverable_file_not_found' using errcode='22023'; end if;
    update public.work_milestones set status='submitted',
      deliverable_url=case when p_url ~* '^https?://' then p_url else null end,
      deliverable_path=case when p_url ~* '^https?://' then null else p_url end,
      submission_note=left(coalesce(p_note,''),2000),submitted_at=now(),employer_note=null
    where id=p_milestone;
    perform public.create_notification(v.employer_id,'work','Work submitted for review',
      'A freelancer submitted a milestone deliverable.','/dashboard/work/contracts',
      'work-submit:'||p_milestone::text||':'||extract(epoch from now())::bigint,'work');
  elsif p_action in ('approve','revision') then
    if auth.uid()<>v.employer_id or v.status<>'submitted' then raise exception 'invalid_review' using errcode='42501'; end if;
    if p_action='revision' and coalesce(btrim(p_note),'')='' then raise exception 'revision_note_required' using errcode='22023'; end if;
    update public.work_milestones set status=case when p_action='approve' then 'approved' else 'revision_requested' end,
      employer_note=left(coalesce(p_note,''),2000),approved_at=case when p_action='approve' then now() else null end
    where id=p_milestone;
    perform public.create_notification(v.freelancer_id,'work',
      case when p_action='approve' then 'Milestone approved' else 'Revision requested' end,
      case when p_action='approve' then 'Your work was approved. The employer can now complete payment.' else left(p_note,250) end,
      '/dashboard/work/contracts','work-review:'||p_milestone::text||':'||extract(epoch from now())::bigint,'work');
  else raise exception 'invalid_action' using errcode='22023';
  end if;
end;
$$;
revoke all on function public.transition_work_milestone(uuid,text,text,text) from public,anon;
grant execute on function public.transition_work_milestone(uuid,text,text,text) to authenticated;

create function public.respond_work_invitation(
  p_invitation uuid,p_action text,p_cover_letter text default null,p_amount numeric default null,
  p_days int default null,p_portfolio_url text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v record; v_proposal uuid;
begin
  if not public.is_active_user() then raise exception 'inactive_user' using errcode='42501'; end if;
  select i.*,p.status as project_status,p.budget_min,p.budget_max
    into v from public.work_invitations i join public.work_projects p on p.id=i.project_id
   where i.id=p_invitation for update of i,p;
  if not found or v.freelancer_id<>auth.uid() or v.status<>'pending' then raise exception 'invitation_unavailable' using errcode='42501'; end if;
  if p_action='decline' then
    update public.work_invitations set status='declined' where id=p_invitation;
    return null;
  end if;
  if p_action<>'accept' or v.project_status<>'published' or p_cover_letter is null
    or char_length(btrim(p_cover_letter))<80 or char_length(p_cover_letter)>3000
    or p_amount is null or p_amount<v.budget_min or p_amount>v.budget_max
    or p_days is null or p_days<1 or p_days>365 then
    raise exception 'invalid_invitation_response' using errcode='22023';
  end if;
  insert into public.work_proposals(project_id,freelancer_id,cover_letter,proposed_amount,estimated_days,relevant_work_url)
  values(v.project_id,auth.uid(),p_cover_letter,p_amount,p_days,nullif(p_portfolio_url,'')) returning id into v_proposal;
  update public.work_invitations set status='accepted' where id=p_invitation;
  perform public.create_notification(v.employer_id,'work','Freelancer accepted your invitation',
    'A freelancer submitted a proposal in response to your invitation.','/dashboard/work/projects/'||v.project_id,
    'work-invitation-accepted:'||p_invitation::text,'work');
  return v_proposal;
end;
$$;
revoke all on function public.respond_work_invitation(uuid,text,text,numeric,int,text) from public,anon;
grant execute on function public.respond_work_invitation(uuid,text,text,numeric,int,text) to authenticated;

create function public.open_work_dispute(p_contract uuid,p_reason text,p_evidence_url text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v record; v_dispute uuid; v_recipient uuid;
begin
  if not public.is_active_user() then raise exception 'inactive_user' using errcode='42501'; end if;
  select * into v from public.work_contracts where id=p_contract for update;
  if not found or not public.work_contract_party(p_contract) then raise exception 'not_contract_party' using errcode='42501'; end if;
  if v.status<>'active' then raise exception 'contract_not_disputable' using errcode='55000'; end if;
  if exists(select 1 from public.work_milestones where contract_id=p_contract and status in ('approved','paid')) or exists(select 1 from public.work_payment_transactions where contract_id=p_contract and status in ('pending','succeeded')) then raise exception 'payment_phase_started' using errcode='55000'; end if;
  if exists(select 1 from public.work_disputes where contract_id=p_contract and status in ('open','reviewing')) then
    raise exception 'dispute_already_open' using errcode='23505';
  end if;
  insert into public.work_disputes(contract_id,opened_by,reason,evidence_url)
  values(p_contract,auth.uid(),left(p_reason,3000),nullif(p_evidence_url,'')) returning id into v_dispute;
  update public.work_contracts set status='disputed' where id=p_contract;
  v_recipient:=case when auth.uid()=v.freelancer_id then v.employer_id else v.freelancer_id end;
  perform public.create_notification(v_recipient,'work','A contract dispute was opened',
    'The other party opened a dispute. Review the contract workspace.','/dashboard/work/contracts/'||p_contract,
    'work-dispute:'||v_dispute::text,'work');
  return v_dispute;
end;
$$;
revoke all on function public.open_work_dispute(uuid,text,text) from public,anon;
grant execute on function public.open_work_dispute(uuid,text,text) to authenticated;

create function public.finalize_work_payment(p_payment uuid,p_provider_reference text,p_amount_minor bigint,p_currency text,p_provider_fee_minor bigint default null,p_payment_method text default null,p_processor_reference text default null)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v record;
begin
  if auth.role()<>'service_role' then raise exception 'service_only' using errcode='42501'; end if;
  select * into v from public.work_payment_transactions where id=p_payment for update;
  if not found then return false; end if;
  if v.status='succeeded' then return true; end if;
  if not exists(select 1 from public.work_contracts c where c.id=v.contract_id and c.status='active') then raise exception 'contract_not_active' using errcode='55000'; end if;
  if v.status not in ('pending','failed','cancelled') or v.amount_minor<>p_amount_minor or v.currency<>upper(p_currency) then
    raise exception 'payment_mismatch' using errcode='23514';
  end if;
  update public.work_payment_transactions set status='succeeded',provider_reference=p_provider_reference,processor_reference=p_processor_reference,payment_method=p_payment_method,provider_fee_minor=p_provider_fee_minor,verified_at=now() where id=p_payment;
  update public.work_milestones set status='paid',paid_at=now() where id=v.milestone_id and status='approved';
  if not found then raise exception 'milestone_not_approved' using errcode='23514'; end if;
  if not exists(select 1 from public.work_milestones where contract_id=v.contract_id and status<>'paid') then
    update public.work_contracts set status='completed',completed_at=now() where id=v.contract_id;
  end if;
  perform public.create_notification(v.freelancer_id,'work','Milestone payment confirmed',
    'The payment was verified by Chapa.','/dashboard/work/contracts','work-payment:'||p_payment::text,'work');
  return true;
end;
$$;
revoke all on function public.finalize_work_payment(uuid,text,bigint,text,bigint,text,text) from public,anon,authenticated;
grant execute on function public.finalize_work_payment(uuid,text,bigint,text,bigint,text,text) to service_role;

create function public.count_work_proposal() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.work_projects set applications_count=applications_count+1 where id=new.project_id;
  return new;
end;
$$;
create trigger work_proposal_count after insert on public.work_proposals
for each row execute function public.count_work_proposal();

-- Least-privilege access to marketplace records.
alter table public.work_profiles enable row level security;
alter table public.work_portfolio_items enable row level security;
alter table public.work_projects enable row level security;
alter table public.work_project_reports enable row level security;
alter table public.work_proposals enable row level security;
alter table public.work_invitations enable row level security;
alter table public.work_contracts enable row level security;
alter table public.work_milestones enable row level security;
alter table public.work_messages enable row level security;
alter table public.work_reviews enable row level security;
alter table public.work_disputes enable row level security;
alter table public.work_payout_accounts enable row level security;
alter table public.work_payment_transactions enable row level security;

grant select on public.work_profiles to anon,authenticated;
grant insert,update on public.work_profiles to authenticated;
create policy work_profiles_public_read on public.work_profiles for select to anon,authenticated
using ((is_public and exists(select 1 from public.profiles p where p.id=user_id and not p.is_suspended and p.is_public_profile)) or user_id=auth.uid());
create policy work_profiles_owner_insert on public.work_profiles for insert to authenticated
with check (user_id=auth.uid() and public.is_active_user());
create policy work_profiles_owner_update on public.work_profiles for update to authenticated
using (user_id=auth.uid()) with check (user_id=auth.uid() and public.is_active_user());

grant select on public.work_portfolio_items to anon,authenticated;
grant insert,update,delete on public.work_portfolio_items to authenticated;
create policy work_portfolio_public_read on public.work_portfolio_items for select to anon,authenticated
using ((exists(select 1 from public.work_profiles wp join public.profiles p on p.id=wp.user_id
  where wp.user_id=work_portfolio_items.user_id and wp.is_public and p.is_public_profile and not p.is_suspended)) or user_id=auth.uid());
create policy work_portfolio_owner_insert on public.work_portfolio_items for insert to authenticated
with check (user_id=auth.uid() and public.is_active_user());
create policy work_portfolio_owner_update on public.work_portfolio_items for update to authenticated
using (user_id=auth.uid()) with check (user_id=auth.uid() and public.is_active_user());
create policy work_portfolio_owner_delete on public.work_portfolio_items for delete to authenticated
using (user_id=auth.uid() and public.is_active_user());

grant select,delete on public.work_projects to authenticated;
grant select on public.work_projects to anon;
grant insert (slug,employer_id,startup_id,title,summary,description,category,skills,budget_type,budget_min,budget_max,currency,experience_level,work_location,country,deadline,status) on public.work_projects to authenticated;
grant update (title,summary,description,category,skills,budget_min,budget_max,experience_level,work_location,country,deadline,status) on public.work_projects to authenticated;
create policy work_projects_public_read on public.work_projects for select to anon,authenticated
using ((status='published' and exists(select 1 from public.profiles p where p.id=employer_id and not p.is_suspended)) or employer_id=auth.uid() or public.is_staff() or public.is_work_project_applicant(id) or public.is_work_project_manager(id));
create policy work_projects_owner_insert on public.work_projects for insert to authenticated
with check (employer_id=auth.uid() and public.is_active_user()
  and (startup_id is null or exists(select 1 from public.startup_members sm where sm.startup_id=work_projects.startup_id and sm.user_id=auth.uid() and sm.role in ('owner','admin','editor'))));
create policy work_projects_owner_update on public.work_projects for update to authenticated
using (public.is_work_project_manager(id)) with check (public.is_work_project_manager(id) and public.is_active_user()
  and (startup_id is null or exists(select 1 from public.startup_members sm where sm.startup_id=work_projects.startup_id and sm.user_id=auth.uid() and sm.role in ('owner','admin','editor'))));
create policy work_projects_owner_delete on public.work_projects for delete to authenticated
using (public.is_work_project_manager(id) and status='draft');

grant select on public.work_project_reports to authenticated;
grant insert (project_id,reporter_id,reason,details) on public.work_project_reports to authenticated;
create policy work_project_reports_read on public.work_project_reports for select to authenticated
using (reporter_id=auth.uid() or public.is_staff());
create policy work_project_reports_insert on public.work_project_reports for insert to authenticated
with check (reporter_id=auth.uid() and public.is_active_user()
  and exists(select 1 from public.work_projects p where p.id=project_id and p.status='published' and p.employer_id<>auth.uid()));

grant select on public.work_proposals to authenticated;
grant insert (project_id,freelancer_id,cover_letter,proposed_amount,estimated_days,relevant_work_url) on public.work_proposals to authenticated;
grant update (status) on public.work_proposals to authenticated;
create policy work_proposals_parties_read on public.work_proposals for select to authenticated
using (freelancer_id=auth.uid() or public.is_work_project_manager(project_id) or public.is_staff());
create policy work_proposals_freelancer_insert on public.work_proposals for insert to authenticated
with check (freelancer_id=auth.uid() and status='submitted' and public.is_active_user()
  and exists(select 1 from public.work_profiles wp join public.profiles pr on pr.id=wp.user_id where wp.user_id=auth.uid() and wp.is_public and wp.availability<>'unavailable' and pr.is_public_profile and not pr.is_suspended)
  and exists(select 1 from public.work_projects p where p.id=project_id and p.status='published' and p.employer_id<>auth.uid() and proposed_amount between p.budget_min and p.budget_max));
create policy work_proposals_freelancer_update on public.work_proposals for update to authenticated
using (freelancer_id=auth.uid() and status in ('submitted','shortlisted'))
with check (freelancer_id=auth.uid() and status='withdrawn' and public.is_active_user());
create policy work_proposals_employer_update on public.work_proposals for update to authenticated
using (public.is_work_project_manager(project_id))
with check (status in ('shortlisted','declined') and public.is_active_user() and public.is_work_project_manager(project_id));

grant select on public.work_invitations to authenticated;
grant insert (project_id,employer_id,freelancer_id,message) on public.work_invitations to authenticated;
grant update (status) on public.work_invitations to authenticated;
create policy work_invitations_party_read on public.work_invitations for select to authenticated
using (employer_id=auth.uid() or freelancer_id=auth.uid() or public.is_staff() or public.is_work_project_manager(project_id));
create policy work_invitations_employer_insert on public.work_invitations for insert to authenticated
with check (employer_id=auth.uid() and public.is_active_user()
  and public.is_work_project_manager(project_id) and exists(select 1 from public.work_projects p where p.id=project_id and p.status='published')
  and exists(select 1 from public.work_profiles wp join public.profiles pr on pr.id=wp.user_id
    where wp.user_id=freelancer_id and wp.is_public and wp.availability<>'unavailable' and pr.is_public_profile and not pr.is_suspended));
create policy work_invitations_freelancer_respond on public.work_invitations for update to authenticated
using (freelancer_id=auth.uid() and status='pending')
with check (freelancer_id=auth.uid() and status in ('accepted','declined') and public.is_active_user());

grant select on public.work_contracts to authenticated;
create policy work_contracts_party_read on public.work_contracts for select to authenticated
using (public.work_contract_party(id) or public.is_staff());

grant select on public.work_milestones to authenticated;
create policy work_milestones_party_read on public.work_milestones for select to authenticated
using (public.work_contract_party(contract_id) or public.is_staff());

grant select on public.work_messages to authenticated;
grant insert (contract_id,sender_id,body,attachment_url,attachment_path) on public.work_messages to authenticated;
create policy work_messages_party_read on public.work_messages for select to authenticated
using (public.work_contract_party(contract_id) or public.is_staff());
create policy work_messages_party_insert on public.work_messages for insert to authenticated
with check (sender_id=auth.uid() and public.is_active_user() and public.work_contract_party(contract_id)
  and (attachment_path is null or ((storage.foldername(attachment_path))[1]=contract_id::text and (storage.foldername(attachment_path))[2]=auth.uid()::text and exists(select 1 from storage.objects o where o.bucket_id='work-deliverables' and o.name=attachment_path))));

grant select on public.work_reviews to anon,authenticated;
grant insert on public.work_reviews to authenticated;
create policy work_reviews_public_read on public.work_reviews for select to anon,authenticated
using (exists(select 1 from public.work_profiles wp join public.profiles p on p.id=wp.user_id
  where wp.user_id=reviewee_id and wp.is_public and p.is_public_profile and not p.is_suspended));
create policy work_reviews_party_insert on public.work_reviews for insert to authenticated
with check (reviewer_id=auth.uid() and public.is_active_user()
  and exists(select 1 from public.work_contracts c where c.id=contract_id and c.status='completed'
    and auth.uid() in (c.employer_id,c.freelancer_id)
    and reviewee_id=case when auth.uid()=c.employer_id then c.freelancer_id else c.employer_id end));

grant select on public.work_disputes to authenticated;
grant insert (contract_id,opened_by,reason,evidence_url) on public.work_disputes to authenticated;
create policy work_disputes_party_read on public.work_disputes for select to authenticated
using (opened_by=auth.uid() or public.is_staff() or public.work_contract_party(contract_id));
create policy work_disputes_party_insert on public.work_disputes for insert to authenticated
with check (opened_by=auth.uid() and public.is_active_user()
  and exists(select 1 from public.work_contracts c where c.id=contract_id and c.status='active') and public.work_contract_party(contract_id));

grant select on public.work_payout_accounts to authenticated;
create policy work_payout_accounts_owner_read on public.work_payout_accounts for select to authenticated
using (user_id=auth.uid());

grant select on public.work_payment_transactions to authenticated;
create policy work_payments_party_read on public.work_payment_transactions for select to authenticated
using (public.work_contract_party(contract_id) or public.is_staff());

-- Private files are scoped to the contract and the uploading participant.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('work-deliverables','work-deliverables',false,15728640,array['application/pdf','image/jpeg','image/png','image/webp','application/zip','text/plain'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy work_deliverables_select on storage.objects for select to authenticated
using(bucket_id='work-deliverables' and public.work_contract_party(public.storage_folder_uuid(name)));
create policy work_deliverables_insert on storage.objects for insert to authenticated
with check(bucket_id='work-deliverables' and public.is_active_user()
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and (storage.foldername(name))[2]=auth.uid()::text
  and public.work_contract_party(((storage.foldername(name))[1])::uuid));

-- Do not grant browser clients write access to payout or payment ledger rows.

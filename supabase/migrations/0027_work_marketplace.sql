-- Buna 0027 — Work marketplace: talent profiles, projects, proposals, contracts,
-- milestones, secure messages, reviews, disputes and verified split payments.
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
  constraint work_profile_currency check (currency = 'ETB'),
  constraint work_profile_availability check (availability in ('available','limited','unavailable')),
  constraint work_profile_portfolio_url check (portfolio_url is null or portfolio_url ~* '^https?://')
);
create trigger work_profiles_updated_at before update on public.work_profiles
for each row execute function public.set_updated_at();
create index work_profiles_skills_idx on public.work_profiles using gin(skills);
create index work_profiles_discoverable_idx on public.work_profiles(is_public, availability);

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
  constraint work_project_budget_type check (budget_type in ('fixed','hourly')),
  constraint work_project_budget_range check (budget_min > 0 and budget_max >= budget_min),
  constraint work_project_currency check (currency = 'ETB'),
  constraint work_project_experience check (experience_level in ('entry','intermediate','expert')),
  constraint work_project_location check (work_location in ('remote','hybrid','onsite')),
  constraint work_project_status check (status in ('draft','published','paused','filled','closed'))
);
create trigger work_projects_updated_at before update on public.work_projects
for each row execute function public.set_updated_at();
create index work_projects_feed_idx on public.work_projects(status, created_at desc);
create index work_projects_skills_idx on public.work_projects using gin(skills);
create index work_projects_employer_idx on public.work_projects(employer_id, created_at desc);

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
  constraint work_proposal_amount check (proposed_amount > 0),
  constraint work_proposal_days check (estimated_days between 1 and 365),
  constraint work_proposal_url check (relevant_work_url is null or relevant_work_url ~* '^https?://'),
  constraint work_proposal_status check (status in ('submitted','shortlisted','declined','withdrawn','hired')),
  unique(project_id, freelancer_id)
);
create trigger work_proposals_updated_at before update on public.work_proposals
for each row execute function public.set_updated_at();
create index work_proposals_project_idx on public.work_proposals(project_id,status,created_at);
create index work_proposals_freelancer_idx on public.work_proposals(freelancer_id,created_at desc);

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
  constraint work_contract_amount check (agreed_amount > 0),
  constraint work_contract_currency check (currency = 'ETB'),
  constraint work_contract_status check (status in ('active','completed','cancelled','disputed')),
  constraint work_contract_scope_len check (char_length(scope) between 80 and 8000),
  constraint work_contract_parties check (employer_id <> freelancer_id)
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
  submission_note text,
  employer_note text,
  submitted_at timestamptz,
  approved_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint work_milestone_title_len check (char_length(title) between 3 and 120),
  constraint work_milestone_description_len check (char_length(description) between 10 and 2000),
  constraint work_milestone_amount check (amount > 0),
  constraint work_milestone_status check (status in ('pending','submitted','revision_requested','approved','paid')),
  constraint work_milestone_url check (deliverable_url is null or deliverable_url ~* '^https?://')
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
  created_at timestamptz not null default now(),
  constraint work_message_body_len check (char_length(body) between 1 and 4000),
  constraint work_message_attachment_url check (attachment_url is null or attachment_url ~* '^https?://')
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
  constraint work_review_not_self check (reviewer_id <> reviewee_id),
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

-- Private payout metadata: bank account details are sent directly to Chapa and never stored here.
create table public.work_payout_accounts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  provider text not null default 'chapa',
  provider_reference text not null unique,
  bank_slug text not null,
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
  checkout_url text,
  amount_minor bigint not null,
  currency char(3) not null default 'ETB',
  platform_fee_percent numeric(5,2) not null default 10,
  freelancer_share_percent numeric(5,2) not null default 90,
  status text not null default 'pending',
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint work_payment_amount check (amount_minor >= 100),
  constraint work_payment_currency check (currency = 'ETB'),
  constraint work_payment_status check (status in ('pending','succeeded','failed','cancelled'))
);
create trigger work_payment_transactions_updated_at before update on public.work_payment_transactions
for each row execute function public.set_updated_at();
create index work_payments_milestone_idx on public.work_payment_transactions(milestone_id,created_at desc);

create function public.work_contract_party(p_contract uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.work_contracts c where c.id=p_contract and auth.uid() in (c.employer_id,c.freelancer_id))
$$;

create function public.hire_work_proposal(p_proposal uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v record; v_contract uuid;
begin
  if not public.is_active_user() then raise exception 'inactive_user' using errcode='42501'; end if;
  select p.id as proposal_id,p.project_id,p.freelancer_id,p.proposed_amount,p.estimated_days,
         w.employer_id,w.title,w.description,w.status,w.currency,w.id as project
    into v
    from public.work_proposals p join public.work_projects w on w.id=p.project_id
   where p.id=p_proposal for update of p,w;
  if not found or v.employer_id<>auth.uid() then raise exception 'not_project_owner' using errcode='42501'; end if;
  if v.status<>'published' then raise exception 'project_not_open' using errcode='55000'; end if;
  if exists(select 1 from public.work_contracts where project_id=v.project) then raise exception 'already_hired' using errcode='23505'; end if;
  if not exists(select 1 from public.work_profiles where user_id=v.freelancer_id and is_public) then raise exception 'freelancer_unavailable' using errcode='23514'; end if;
  insert into public.work_contracts(project_id,proposal_id,employer_id,freelancer_id,title,scope,agreed_amount,currency,due_at)
  values(v.project,v.proposal_id,v.employer_id,v.freelancer_id,v.title,v.description,v.proposed_amount,v.currency,
    now()+make_interval(days=>v.estimated_days)) returning id into v_contract;
  insert into public.work_milestones(contract_id,title,description,amount,due_at)
  values(v_contract,'Project delivery','Complete the agreed project scope and submit the deliverable.',v.proposed_amount,now()+make_interval(days=>v.estimated_days));
  update public.work_proposals set status=case when id=p_proposal then 'hired' else 'declined' end
   where project_id=v.project and status in ('submitted','shortlisted');
  update public.work_projects set status='filled',hired_at=now() where id=v.project;
  perform public.create_notification(v.freelancer_id,'work','You were hired on Buna Work',
    'A project contract is ready. Open your Work dashboard to review the terms.',
    '/dashboard/work/contracts','work-hired:'||v_contract::text,null);
  return v_contract;
end $$;
revoke all on function public.hire_work_proposal(uuid) from public,anon;
grant execute on function public.hire_work_proposal(uuid) to authenticated;

create function public.transition_work_milestone(p_milestone uuid,p_action text,p_url text default null,p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v record;
begin
  if not public.is_active_user() then raise exception 'inactive_user' using errcode='42501'; end if;
  select m.*,c.employer_id,c.freelancer_id,c.id as contract
    into v from public.work_milestones m join public.work_contracts c on c.id=m.contract_id
   where m.id=p_milestone for update of m;
  if not found or auth.uid() not in (v.employer_id,v.freelancer_id) then raise exception 'not_contract_party' using errcode='42501'; end if;
  if p_action='submit' then
    if auth.uid()<>v.freelancer_id or v.status not in ('pending','revision_requested') or p_url is null or p_url !~* '^https?://' then
      raise exception 'invalid_submission' using errcode='22023';
    end if;
    update public.work_milestones set status='submitted',deliverable_url=p_url,submission_note=left(coalesce(p_note,''),2000),submitted_at=now(),employer_note=null where id=p_milestone;
    perform public.create_notification(v.employer_id,'work','Work submitted for review','A freelancer submitted a milestone deliverable.','/dashboard/work/contracts','work-submit:'||p_milestone::text||':'||extract(epoch from now())::bigint,null);
  elsif p_action in ('approve','revision') then
    if auth.uid()<>v.employer_id or v.status<>'submitted' then raise exception 'invalid_review' using errcode='42501'; end if;
    if p_action='revision' and coalesce(btrim(p_note),'')='' then raise exception 'revision_note_required' using errcode='22023'; end if;
    update public.work_milestones set status=case when p_action='approve' then 'approved' else 'revision_requested' end,
      employer_note=left(coalesce(p_note,''),2000),approved_at=case when p_action='approve' then now() else null end where id=p_milestone;
    perform public.create_notification(v.freelancer_id,'work',
      case when p_action='approve' then 'Milestone approved' else 'Revision requested' end,
      case when p_action='approve' then 'Your work was approved. The employer can now complete payment.' else left(p_note,250) end,
      '/dashboard/work/contracts','work-review:'||p_milestone::text||':'||extract(epoch from now())::bigint,null);
  else raise exception 'invalid_action' using errcode='22023';
  end if;
end $$;
revoke all on function public.transition_work_milestone(uuid,text,text,text) from public,anon;
grant execute on function public.transition_work_milestone(uuid,text,text,text) to authenticated;

create function public.finalize_work_payment(p_payment uuid,p_provider_reference text,p_amount_minor bigint,p_currency text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v record;
begin
  if auth.role()<>'service_role' then raise exception 'service_only' using errcode='42501'; end if;
  select * into v from public.work_payment_transactions where id=p_payment for update;
  if not found then return false; end if;
  if v.status='succeeded' then return true; end if;
  if v.status<>'pending' or v.amount_minor<>p_amount_minor or v.currency<>upper(p_currency) then
    raise exception 'payment_mismatch' using errcode='23514';
  end if;
  update public.work_payment_transactions set status='succeeded',provider_reference=p_provider_reference,verified_at=now() where id=p_payment;
  update public.work_milestones set status='paid',paid_at=now() where id=v.milestone_id and status='approved';
  if not found then raise exception 'milestone_not_approved' using errcode='23514'; end if;
  if not exists(select 1 from public.work_milestones where contract_id=v.contract_id and status<>'paid') then
    update public.work_contracts set status='completed',completed_at=now() where id=v.contract_id;
  end if;
  perform public.create_notification(v.freelancer_id,'work','Milestone payment confirmed','The payment was verified by Chapa.','/dashboard/work/contracts','work-payment:'||p_payment::text,null);
  return true;
end $$;
revoke all on function public.finalize_work_payment(uuid,text,bigint,text) from public,anon,authenticated;
grant execute on function public.finalize_work_payment(uuid,text,bigint,text) to service_role;

-- RLS and least-privilege grants.
alter table public.work_profiles enable row level security;
alter table public.work_projects enable row level security;
alter table public.work_proposals enable row level security;
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
using (is_public and exists(select 1 from public.profiles p where p.id=user_id and not p.is_suspended) or user_id=auth.uid());
create policy work_profiles_owner_insert on public.work_profiles for insert to authenticated
with check (user_id=auth.uid() and public.is_active_user());
create policy work_profiles_owner_update on public.work_profiles for update to authenticated
using (user_id=auth.uid()) with check (user_id=auth.uid() and public.is_active_user());

grant select,insert,update,delete on public.work_projects to authenticated;
grant select on public.work_projects to anon;
create policy work_projects_public_read on public.work_projects for select to anon,authenticated
using (status='published' or employer_id=auth.uid() or public.is_staff());
create policy work_projects_owner_insert on public.work_projects for insert to authenticated
with check (employer_id=auth.uid() and public.is_active_user());
create policy work_projects_owner_update on public.work_projects for update to authenticated
using (employer_id=auth.uid()) with check (employer_id=auth.uid() and public.is_active_user());
create policy work_projects_owner_delete on public.work_projects for delete to authenticated
using (employer_id=auth.uid() and status='draft');

grant select,insert,update on public.work_proposals to authenticated;
create policy work_proposals_parties_read on public.work_proposals for select to authenticated
using (freelancer_id=auth.uid() or exists(select 1 from public.work_projects p where p.id=project_id and p.employer_id=auth.uid()) or public.is_staff());
create policy work_proposals_freelancer_insert on public.work_proposals for insert to authenticated
with check (freelancer_id=auth.uid() and public.is_active_user()
  and exists(select 1 from public.work_profiles wp where wp.user_id=auth.uid() and wp.is_public)
  and exists(select 1 from public.work_projects p where p.id=project_id and p.status='published' and p.employer_id<>auth.uid()));
create policy work_proposals_freelancer_update on public.work_proposals for update to authenticated
using (freelancer_id=auth.uid() and status in ('submitted','shortlisted'))
with check (freelancer_id=auth.uid() and status='withdrawn' and public.is_active_user());
create policy work_proposals_employer_update on public.work_proposals for update to authenticated
using (exists(select 1 from public.work_projects p where p.id=project_id and p.employer_id=auth.uid()))
with check (exists(select 1 from public.work_projects p where p.id=project_id and p.employer_id=auth.uid()));

grant select on public.work_contracts to authenticated;
create policy work_contracts_party_read on public.work_contracts for select to authenticated
using (employer_id=auth.uid() or freelancer_id=auth.uid() or public.is_staff());

grant select,insert,update on public.work_milestones to authenticated;
create policy work_milestones_party_read on public.work_milestones for select to authenticated
using (public.work_contract_party(contract_id) or public.is_staff());
create policy work_milestones_employer_insert on public.work_milestones for insert to authenticated
with check (exists(select 1 from public.work_contracts c where c.id=contract_id and c.employer_id=auth.uid() and c.status='active'));
create policy work_milestones_party_update on public.work_milestones for update to authenticated
using (public.work_contract_party(contract_id)) with check (public.work_contract_party(contract_id));

grant select,insert on public.work_messages to authenticated;
create policy work_messages_party_read on public.work_messages for select to authenticated
using (public.work_contract_party(contract_id) or public.is_staff());
create policy work_messages_party_insert on public.work_messages for insert to authenticated
with check (sender_id=auth.uid() and public.is_active_user() and public.work_contract_party(contract_id));

grant select,insert on public.work_reviews to anon,authenticated;
create policy work_reviews_public_read on public.work_reviews for select to anon,authenticated using (true);
create policy work_reviews_party_insert on public.work_reviews for insert to authenticated
with check (reviewer_id=auth.uid() and public.is_active_user()
  and exists(select 1 from public.work_contracts c where c.id=contract_id and c.status='completed'
    and auth.uid() in (c.employer_id,c.freelancer_id)
    and reviewee_id=case when auth.uid()=c.employer_id then c.freelancer_id else c.employer_id end));

grant select,insert on public.work_disputes to authenticated;
create policy work_disputes_party_read on public.work_disputes for select to authenticated
using (opened_by=auth.uid() or public.is_staff() or exists(select 1 from public.work_contracts c where c.id=contract_id and auth.uid() in (c.employer_id,c.freelancer_id)));
create policy work_disputes_party_insert on public.work_disputes for insert to authenticated
with check (opened_by=auth.uid() and public.is_active_user() and exists(select 1 from public.work_contracts c where c.id=contract_id and c.status in ('active','disputed') and auth.uid() in (c.employer_id,c.freelancer_id)));
create policy work_disputes_staff_update on public.work_disputes for update to authenticated
using (public.is_staff()) with check (public.is_staff());

grant select on public.work_payout_accounts to authenticated;
create policy work_payout_accounts_owner_read on public.work_payout_accounts for select to authenticated using (user_id=auth.uid());

grant select on public.work_payment_transactions to authenticated;
create policy work_payments_party_read on public.work_payment_transactions for select to authenticated
using (employer_id=auth.uid() or freelancer_id=auth.uid() or public.is_staff());

-- Increment application counts without exposing a writable counter to clients.
create function public.count_work_proposal() returns trigger language plpgsql security definer set search_path = '' as $$
begin update public.work_projects set applications_count=applications_count+1 where id=new.project_id; return new; end $$;
create trigger work_proposal_count after insert on public.work_proposals for each row execute function public.count_work_proposal();

-- Storage for private contract deliverables. No public URLs or cross-contract access.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('work-deliverables','work-deliverables',false,15728640,array['application/pdf','image/jpeg','image/png','image/webp','application/zip','text/plain'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy work_deliverables_select on storage.objects for select to authenticated
using(bucket_id='work-deliverables' and public.work_contract_party(public.storage_folder_uuid(name)));
create policy work_deliverables_insert on storage.objects for insert to authenticated
with check(bucket_id='work-deliverables' and public.is_active_user()
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and public.work_contract_party(((storage.foldername(name))[1])::uuid));

-- No raw bank account data or payment credentials are granted to browser clients.

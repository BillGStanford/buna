-- Remove the Work marketplace and introduce opt-in co-founder discovery.
-- This is intentionally forward-only: never rewrite migrations already applied.

begin;

-- Remove marketplace storage access. Supabase protects storage.objects and
-- storage.buckets from direct SQL deletion; the bucket must be emptied/deleted
-- through the Storage API or Dashboard after this migration succeeds.
drop policy if exists work_deliverables_select on storage.objects;
drop policy if exists work_deliverables_insert on storage.objects;

-- Drop marketplace tables (dependents first). No Buna startup, launch, investor,
-- community, referral, account, or profile tables are touched.
drop view if exists public.work_public_history cascade;
drop table if exists public.chapa_webhook_events cascade;
drop table if exists public.work_payment_transactions cascade;
drop table if exists public.work_payout_accounts cascade;
drop table if exists public.work_disputes cascade;
drop table if exists public.work_reviews cascade;
drop table if exists public.work_messages cascade;
drop table if exists public.work_milestones cascade;
drop table if exists public.work_contracts cascade;
drop table if exists public.work_invitations cascade;
drop table if exists public.work_proposals cascade;
drop table if exists public.work_project_reports cascade;
drop table if exists public.work_projects cascade;
drop table if exists public.work_portfolio_items cascade;
drop table if exists public.work_profiles cascade;

drop function if exists public.can_invite_work_freelancer(uuid,uuid) cascade;
drop function if exists public.can_submit_work_proposal(uuid,numeric) cascade;
drop function if exists public.is_work_project_applicant(uuid) cascade;
drop function if exists public.is_work_project_manager(uuid) cascade;
drop function if exists public.work_contract_party(uuid) cascade;
drop function if exists public.hire_work_proposal(uuid) cascade;
drop function if exists public.transition_work_milestone(uuid,text,text,text) cascade;
drop function if exists public.respond_work_invitation(uuid,text,text,numeric,integer,text) cascade;
drop function if exists public.open_work_dispute(uuid,text,text) cascade;
drop function if exists public.finalize_work_payment(uuid,text,bigint,text,bigint,text,text) cascade;
drop function if exists public.count_work_proposal() cascade;
drop function if exists public.is_public_work_project(uuid) cascade;

alter table public.notification_preferences drop column if exists email_work;

-- Co-founder profiles are discoverable only after explicit opt-in AND staff approval.
create table public.cofounder_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  headline text not null check (char_length(headline) between 8 and 120),
  bio text not null check (char_length(bio) between 40 and 2400),
  location text,
  skills text[] not null default '{}',
  interests text[] not null default '{}',
  experience text,
  accomplishments text,
  website_url text,
  linkedin_url text,
  github_url text,
  role_seeking text[] not null default '{}',
  commitment text not null default 'exploring' check (commitment in ('exploring','part_time','full_time')),
  hours_per_week int check (hours_per_week between 1 and 80),
  work_style text not null default 'remote' check (work_style in ('remote','hybrid','in_person','flexible')),
  idea_status text not null default 'open' check (idea_status in ('has_idea','seeking_idea','open')),
  opted_in boolean not null default false,
  approval_status text not null default 'pending' check (approval_status in ('pending','approved','rejected')),
  is_paused boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index cofounder_profiles_discovery_idx
  on public.cofounder_profiles(approval_status,opted_in,is_paused,updated_at desc);
create index cofounder_profiles_skills_idx on public.cofounder_profiles using gin(skills);

create table public.cofounder_opportunities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 5 and 120),
  problem text not null check (char_length(problem) between 30 and 2000),
  solution text,
  industry text,
  stage text not null default 'idea' check (stage in ('idea','research','prototype','mvp','launched')),
  looking_for text[] not null default '{}',
  location text,
  is_open boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index cofounder_opportunities_open_idx on public.cofounder_opportunities(is_open,created_at desc);

create table public.cofounder_connections (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  message text not null check (char_length(message) between 30 and 1500),
  status text not null default 'pending' check (status in ('pending','accepted','declined','withdrawn')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cofounder_connection_not_self check(sender_id<>recipient_id),
  unique(sender_id,recipient_id)
);
create index cofounder_connections_recipient_idx on public.cofounder_connections(recipient_id,status,created_at desc);
create index cofounder_connections_sender_idx on public.cofounder_connections(sender_id,status,created_at desc);

create table public.cofounder_messages (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.cofounder_connections(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check(char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index cofounder_messages_thread_idx on public.cofounder_messages(connection_id,created_at);

create table public.cofounder_saved_profiles (
  user_id uuid not null references public.profiles(id) on delete cascade,
  saved_user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(user_id,saved_user_id),
  check(user_id<>saved_user_id)
);

create table public.cofounder_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reported_user_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null check(char_length(reason) between 5 and 120),
  details text,
  status text not null default 'open' check(status in ('open','reviewing','resolved','dismissed')),
  created_at timestamptz not null default now(),
  unique(reporter_id,reported_user_id),
  check(reporter_id<>reported_user_id)
);

create table public.cofounder_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(blocker_id,blocked_id),
  check(blocker_id<>blocked_id)
);

create or replace function public.is_approved_cofounder_member(p_user uuid)
returns boolean language sql stable security definer set search_path=''
as $$
  select exists(
    select 1 from public.cofounder_profiles cp
    join public.profiles p on p.id=cp.user_id
    where cp.user_id=p_user and cp.opted_in and cp.approval_status='approved'
      and not cp.is_paused and not p.is_suspended
  )
$$;
revoke all on function public.is_approved_cofounder_member(uuid) from public,anon;
grant execute on function public.is_approved_cofounder_member(uuid) to authenticated;

alter table public.cofounder_profiles enable row level security;
alter table public.cofounder_opportunities enable row level security;
alter table public.cofounder_connections enable row level security;
alter table public.cofounder_messages enable row level security;
alter table public.cofounder_saved_profiles enable row level security;
alter table public.cofounder_reports enable row level security;
alter table public.cofounder_blocks enable row level security;

create policy cofounder_profiles_read on public.cofounder_profiles for select to authenticated
using (
  user_id=auth.uid()
  or (public.is_approved_cofounder_member(auth.uid())
      and public.is_approved_cofounder_member(user_id)
      and not exists(select 1 from public.cofounder_blocks b where
        (b.blocker_id=auth.uid() and b.blocked_id=user_id)
        or (b.blocker_id=user_id and b.blocked_id=auth.uid())))
);
create policy cofounder_profiles_insert on public.cofounder_profiles for insert to authenticated
with check(user_id=auth.uid());
create policy cofounder_profiles_update on public.cofounder_profiles for update to authenticated
using(user_id=auth.uid()) with check(user_id=auth.uid());

create policy cofounder_opportunities_read on public.cofounder_opportunities for select to authenticated
using(user_id=auth.uid() or (is_open and public.is_approved_cofounder_member(auth.uid())
  and public.is_approved_cofounder_member(user_id)));
create policy cofounder_opportunities_insert on public.cofounder_opportunities for insert to authenticated
with check(user_id=auth.uid() and public.is_approved_cofounder_member(auth.uid()));
create policy cofounder_opportunities_update on public.cofounder_opportunities for update to authenticated
using(user_id=auth.uid()) with check(user_id=auth.uid());

create policy cofounder_connections_read on public.cofounder_connections for select to authenticated
using(sender_id=auth.uid() or recipient_id=auth.uid());
create policy cofounder_connections_insert on public.cofounder_connections for insert to authenticated
with check(sender_id=auth.uid() and public.is_approved_cofounder_member(auth.uid())
  and public.is_approved_cofounder_member(recipient_id)
  and not exists(select 1 from public.cofounder_blocks b where
    (b.blocker_id=sender_id and b.blocked_id=recipient_id)
    or (b.blocker_id=recipient_id and b.blocked_id=sender_id))
  and (select count(*) from public.cofounder_connections c
    where c.sender_id=auth.uid() and c.created_at>now()-interval '7 days')<15);
create policy cofounder_connections_update on public.cofounder_connections for update to authenticated
using(recipient_id=auth.uid() or sender_id=auth.uid())
with check(recipient_id=auth.uid() or sender_id=auth.uid());

create policy cofounder_messages_read on public.cofounder_messages for select to authenticated
using(exists(select 1 from public.cofounder_connections c where c.id=connection_id
  and c.status='accepted' and (c.sender_id=auth.uid() or c.recipient_id=auth.uid())));
create policy cofounder_messages_insert on public.cofounder_messages for insert to authenticated
with check(sender_id=auth.uid() and exists(select 1 from public.cofounder_connections c
  where c.id=connection_id and c.status='accepted'
  and (c.sender_id=auth.uid() or c.recipient_id=auth.uid())));

create policy cofounder_saved_read on public.cofounder_saved_profiles for select to authenticated using(user_id=auth.uid());
create policy cofounder_saved_insert on public.cofounder_saved_profiles for insert to authenticated with check(user_id=auth.uid());
create policy cofounder_saved_delete on public.cofounder_saved_profiles for delete to authenticated using(user_id=auth.uid());
create policy cofounder_reports_insert on public.cofounder_reports for insert to authenticated with check(reporter_id=auth.uid());
create policy cofounder_reports_read on public.cofounder_reports for select to authenticated using(reporter_id=auth.uid() or public.is_staff());
create policy cofounder_blocks_read on public.cofounder_blocks for select to authenticated using(blocker_id=auth.uid());
create policy cofounder_blocks_insert on public.cofounder_blocks for insert to authenticated with check(blocker_id=auth.uid());
create policy cofounder_blocks_delete on public.cofounder_blocks for delete to authenticated using(blocker_id=auth.uid());

grant select,insert,update on public.cofounder_profiles to authenticated;
grant select,insert,update on public.cofounder_opportunities to authenticated;
grant select,insert,update on public.cofounder_connections to authenticated;
grant select,insert on public.cofounder_messages to authenticated;
grant select,insert,delete on public.cofounder_saved_profiles to authenticated;
grant select,insert on public.cofounder_reports to authenticated;
grant select,insert,delete on public.cofounder_blocks to authenticated;

commit;

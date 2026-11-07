-- Buna 0019 — actionable referral reward requests.
-- 5-referral Founder Circle and 10-referral roundtable milestones now create reviewable requests.

create table if not exists public.referral_reward_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  reward_key text not null check (reward_key in ('founder_circle', 'roundtable')),
  status text not null default 'requested' check (status in ('requested', 'approved', 'declined')),
  member_note text,
  staff_note text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  constraint referral_reward_one_request unique (user_id, reward_key)
);

create index if not exists referral_reward_requests_status_created_idx
  on public.referral_reward_requests(status, created_at desc);

alter table public.referral_reward_requests enable row level security;
revoke all on public.referral_reward_requests from anon, authenticated;
grant select on public.referral_reward_requests to authenticated;

create policy referral_reward_requests_member_read
  on public.referral_reward_requests for select to authenticated
  using (user_id = auth.uid());

-- Writes and staff decisions are performed only by server actions using the service role
-- after checking the member's referral count or staff role.

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


-- Preserve the existing opportunity-deadline email preference when extending
-- create_notification with the referral-specific preference.
create or replace function public.create_notification(
  p_user uuid, p_type text, p_title text, p_body text, p_url text, p_dedupe text, p_pref text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email boolean := false;
begin
  if p_user is null then return; end if;
  select case p_pref
           when 'comments' then np.email_comments
           when 'replies' then np.email_replies
           when 'inquiries' then np.email_inquiries
           when 'moderation' then np.email_moderation
           when 'deadlines' then np.email_opportunity_deadlines
           when 'referrals' then np.email_referrals
           else false
         end
    into v_email
    from public.notification_preferences np
   where np.user_id = p_user;

  insert into public.notifications (user_id, type, title, body, url, dedupe_key, email_status)
  values (p_user, p_type, p_title, p_body, p_url, p_dedupe,
          case when coalesce(v_email, false) then 'pending'::public.email_delivery_status end)
  on conflict (user_id, dedupe_key) do nothing;
end
$$;
revoke all on function public.create_notification(uuid, text, text, text, text, text, text) from public, anon, authenticated;

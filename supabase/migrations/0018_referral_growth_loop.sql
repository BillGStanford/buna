-- Buna 0018 — account referrals, verified signup attribution and milestone rewards.
-- A referral is successful only after the new auth user and profile are committed.

alter table public.profiles
  add column if not exists referral_code text;

create unique index if not exists profiles_referral_code_unique
  on public.profiles (referral_code)
  where referral_code is not null;

create table if not exists public.referral_attributions (
  referred_user_id uuid primary key references public.profiles(id) on delete cascade,
  referrer_id uuid not null references public.profiles(id) on delete cascade,
  referral_code text not null,
  created_at timestamptz not null default now(),
  constraint referral_no_self_referral check (referred_user_id <> referrer_id)
);

create index if not exists referral_attributions_referrer_created_idx
  on public.referral_attributions(referrer_id, created_at desc);

alter table public.referral_attributions enable row level security;
revoke all on public.referral_attributions from anon, authenticated;
grant select on public.referral_attributions to authenticated;

create policy referral_attributions_referrer_read
  on public.referral_attributions for select to authenticated
  using (referrer_id = auth.uid());

-- Codes are generated server-side and cannot be chosen or overwritten by a member.
create or replace function public.assign_profile_referral_code()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text;
  v_referral_code text;
  v_referrer uuid;
  v_count integer;
begin
  if new.referral_code is null or btrim(new.referral_code) = '' then
    loop
      v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
      exit when not exists (select 1 from public.profiles p where p.referral_code = v_code);
    end loop;
    new.referral_code := v_code;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_assign_referral_code on public.profiles;
create trigger profiles_assign_referral_code
  before insert on public.profiles
  for each row execute function public.assign_profile_referral_code();

-- Existing members receive a code as part of the rollout, not only new signups.
update public.profiles
   set referral_code = upper(substr(md5(id::text || random()::text), 1, 10))
 where referral_code is null;

-- Attribution happens after the profile insert in the trusted auth.users trigger.
-- Raising on an invalid supplied code rolls back signup rather than silently losing attribution.
create or replace function public.attribute_new_referral_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_referral_code text;
  v_referrer uuid;
  v_count integer;
begin
  select upper(nullif(btrim(u.raw_user_meta_data ->> 'referral_code'), ''))
    into v_referral_code
    from auth.users u
   where u.id = new.id;

  if v_referral_code is null then
    return new;
  end if;

  select p.id into v_referrer
    from public.profiles p
   where p.referral_code = v_referral_code
     and p.id <> new.id
   limit 1;

  if v_referrer is null then
    raise exception 'invalid_referral_code' using errcode = '22023';
  end if;

  insert into public.referral_attributions(referred_user_id, referrer_id, referral_code)
  values (new.id, v_referrer, v_referral_code)
  on conflict (referred_user_id) do nothing;

  select count(*)::integer into v_count
    from public.referral_attributions
   where referrer_id = v_referrer;

  perform public.create_notification(
    v_referrer,
    'reply',
    'You earned a referral',
    'A new member joined Buna using your referral link. You now have ' || v_count::text || ' successful referral' || case when v_count = 1 then '' else 's' end || '.',
    '/dashboard/referrals',
    'referral-signup:' || new.id::text,
    'referrals'
  );

  if v_count in (3, 5, 10) then
    perform public.create_notification(
      v_referrer,
      'reply',
      case v_count when 3 then 'Founding Supporter unlocked' when 5 then 'Founder Circle unlocked' else 'Community Builder unlocked' end,
      case v_count
        when 3 then 'You have 3 successful referrals. Your Founding Supporter badge is now unlocked.'
        when 5 then 'You have 5 successful referrals. You now qualify for early access and founder spotlight consideration.'
        else 'You have 10 successful referrals. You are eligible for Buna’s private founder roundtable invitations.'
      end,
      '/dashboard/referrals',
      'referral-milestone:' || v_referrer::text || ':' || v_count::text,
      'replies'
    );
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_attribute_referral_signup on public.profiles;
create constraint trigger profiles_attribute_referral_signup
  after insert on public.profiles
  deferrable initially deferred
  for each row execute function public.attribute_new_referral_signup();

revoke all on function public.assign_profile_referral_code() from public, anon, authenticated;
revoke all on function public.attribute_new_referral_signup() from public, anon, authenticated;


-- Public profiles may display the recognition badge without exposing referral identities or counts.
create or replace function public.member_is_founding_supporter(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select count(*) >= 3
    from public.referral_attributions
   where referrer_id = p_user
$$;
revoke all on function public.member_is_founding_supporter(uuid) from public;
grant execute on function public.member_is_founding_supporter(uuid) to anon, authenticated;


create or replace function public.referral_code_exists(p_code text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
     where referral_code = upper(nullif(btrim(p_code), ''))
  )
$$;
revoke all on function public.referral_code_exists(text) from public;
grant execute on function public.referral_code_exists(text) to anon, authenticated;


-- Give referral email notifications their own preference instead of piggybacking on reply emails.
alter table public.notification_preferences
  add column if not exists email_referrals boolean not null default true;

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

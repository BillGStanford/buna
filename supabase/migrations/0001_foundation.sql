-- Buna 0001 — foundation: extensions, enums, profiles, roles, helpers, settings,
-- rate limiting, audit log, notifications, reports.
-- Apply on a fresh Supabase project with `supabase db push` (see README).

create extension if not exists citext with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- ---------- enums ----------
create type public.user_role as enum ('user', 'moderator', 'admin');
create type public.member_role as enum ('owner', 'admin', 'editor', 'viewer');
create type public.startup_status as enum ('draft', 'pending_review', 'published', 'unpublished', 'rejected', 'removed');
create type public.verification_status as enum ('unverified', 'pending', 'verified', 'rejected', 'revoked');
create type public.startup_stage as enum ('idea', 'prototype', 'mvp', 'early_revenue', 'growth', 'scale');
create type public.launch_status as enum ('draft', 'pending_review', 'scheduled', 'published', 'rejected', 'removed');
create type public.comment_status as enum ('visible', 'hidden', 'deleted');
create type public.report_status as enum ('open', 'reviewing', 'actioned', 'dismissed');
create type public.opportunity_category as enum ('grant', 'accelerator', 'competition', 'fellowship', 'job', 'event', 'mentorship', 'partnership');
create type public.opportunity_status as enum ('draft', 'published', 'expired', 'archived');
create type public.inquiry_status as enum ('new', 'read', 'replied', 'archived', 'spam');
create type public.email_delivery_status as enum ('pending', 'sent', 'failed', 'not_configured');
create type public.invitation_status as enum ('pending', 'accepted', 'revoked', 'expired');

-- ---------- generic trigger ----------
create function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------- profiles ----------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username citext not null unique,
  display_name text not null default '',
  avatar_url text,
  headline text,
  bio text,
  country text,
  city text,
  professional_role text,
  founder_status text,
  interests text[] not null default '{}',
  expertise text[] not null default '{}',
  startup_intent text,
  website_url text,
  social_links jsonb not null default '{}'::jsonb,
  role public.user_role not null default 'user',
  is_suspended boolean not null default false,
  suspended_reason text,
  suspended_at timestamptz,
  is_public_profile boolean not null default false,
  show_location boolean not null default false,
  is_discoverable_founder boolean not null default false,
  onboarding_completed_at timestamptz,
  onboarding_skipped_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_format check (username ~ '^[a-z0-9][a-z0-9_-]{2,29}$'),
  constraint profiles_display_name_len check (char_length(display_name) <= 80),
  constraint profiles_bio_len check (bio is null or char_length(bio) <= 500),
  constraint profiles_headline_len check (headline is null or char_length(headline) <= 120),
  constraint profiles_country_fmt check (country is null or country ~ '^[A-Z]{2}$'),
  constraint profiles_founder_status_chk check (founder_status is null or founder_status in
    ('founder', 'cofounder_seeking', 'team_member', 'investor', 'mentor', 'explorer')),
  constraint profiles_startup_intent_chk check (startup_intent is null or startup_intent in ('create', 'join', 'none')),
  constraint profiles_website_chk check (website_url is null or website_url ~* '^https?://')
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create index profiles_discoverable_idx on public.profiles (is_discoverable_founder) where is_discoverable_founder;

-- Creates the profile + notification preferences whenever an auth user is created.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_username text;
  v_try int := 0;
begin
  -- placeholder username the user replaces during onboarding; retried on the (rare) collision
  loop
    v_username := 'user-' || substr(md5(random()::text || clock_timestamp()::text || new.id::text), 1, 10);
    exit when v_try >= 5 or not exists (select 1 from public.profiles p where p.username = v_username);
    v_try := v_try + 1;
  end loop;

  insert into public.profiles (id, username, display_name)
  values (new.id, v_username, left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 80));
  insert into public.notification_preferences (user_id) values (new.id);
  return new;
end $$;

-- ---------- role / state helpers (security definer: they bypass RLS on purpose) ----------
create function public.current_user_role() returns public.user_role
language sql stable security definer set search_path = '' as $$
  select coalesce((select p.role from public.profiles p where p.id = auth.uid()), 'user'::public.user_role)
$$;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.current_user_role() = 'admin'
$$;

create function public.is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.current_user_role() in ('moderator', 'admin')
$$;

create function public.is_active_user() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and not p.is_suspended)
$$;

create function public.has_verified_email() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from auth.users u where u.id = auth.uid() and u.email_confirmed_at is not null)
$$;

-- ---------- categories (sectors) ----------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug citext not null unique,
  name text not null,
  description text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint categories_slug_fmt check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);
create trigger categories_updated_at before update on public.categories
  for each row execute function public.set_updated_at();

-- ---------- platform settings (read/written server-side only) ----------
create table public.platform_settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

-- ---------- rate limiting (fixed window; called with the service role only) ----------
create table public.rate_limits (
  key text primary key,
  window_start timestamptz not null default now(),
  hits int not null default 0
);

create function public.check_rate_limit(p_key text, p_limit int, p_window_seconds int) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_hits int;
begin
  insert into public.rate_limits as r (key, window_start, hits)
  values (p_key, now(), 1)
  on conflict (key) do update set
    window_start = case when r.window_start < now() - make_interval(secs => p_window_seconds)
                        then now() else r.window_start end,
    hits = case when r.window_start < now() - make_interval(secs => p_window_seconds)
                then 1 else r.hits + 1 end
  returning hits into v_hits;
  return v_hits <= p_limit;
end $$;

-- housekeeping: call from a scheduled job
create function public.prune_rate_limits() returns void
language sql security definer set search_path = '' as $$
  delete from public.rate_limits where window_start < now() - interval '1 day'
$$;

revoke all on function public.check_rate_limit(text, int, int) from public, anon, authenticated;
revoke all on function public.prune_rate_limits() from public, anon, authenticated;
grant execute on function public.check_rate_limit(text, int, int) to service_role;
grant execute on function public.prune_rate_limits() to service_role;

-- ---------- audit log (append-only; written by service role / definer functions) ----------
create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity_type text,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_created_idx on public.audit_logs (created_at desc);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);
create index audit_logs_actor_idx on public.audit_logs (actor_id);

-- ---------- notifications ----------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  url text,
  data jsonb not null default '{}'::jsonb,
  dedupe_key text,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notifications_dedupe unique (user_id, dedupe_key)
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;

create table public.notification_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  email_comments boolean not null default true,
  email_replies boolean not null default true,
  email_inquiries boolean not null default true,
  email_moderation boolean not null default true,
  email_opportunity_deadlines boolean not null default false,
  updated_at timestamptz not null default now()
);
create trigger notification_prefs_updated_at before update on public.notification_preferences
  for each row execute function public.set_updated_at();

-- profile + prefs creation hook (functions above must exist first)
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- reports (polymorphic target) ----------
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  target_type text not null,
  target_id uuid not null,
  reason text not null,
  details text,
  status public.report_status not null default 'open',
  handled_by uuid references public.profiles (id) on delete set null,
  handled_at timestamptz,
  resolution_note text,
  created_at timestamptz not null default now(),
  constraint reports_target_type_chk check (target_type in
    ('startup', 'launch', 'comment', 'user', 'opportunity', 'investor')),
  constraint reports_reason_chk check (reason in
    ('spam', 'impersonation', 'misleading', 'abusive', 'illegal', 'other')),
  constraint reports_details_len check (details is null or char_length(details) <= 1000),
  -- one report per reporter per target: repeated reporting cannot flood the queue
  constraint reports_unique_per_reporter unique (reporter_id, target_type, target_id)
);
create index reports_status_idx on public.reports (status, created_at);
create index reports_target_idx on public.reports (target_type, target_id);

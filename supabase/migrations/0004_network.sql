-- Buna 0004 — opportunities, investors, inquiries, team invitations.

create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  slug citext not null unique,
  title text not null,
  organization text not null,
  description text,
  category public.opportunity_category not null,
  eligibility text,
  countries text[] not null default '{}',   -- ISO codes; empty = open to all of Africa
  deadline timestamptz,
  application_url text,
  source_url text,
  published_date date,
  last_checked_at timestamptz,
  status public.opportunity_status not null default 'draft',
  tags text[] not null default '{}',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search tsvector generated always as (
    setweight(to_tsvector('english'::regconfig, coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english'::regconfig, coalesce(organization, '')), 'B') ||
    setweight(to_tsvector('english'::regconfig, coalesce(description, '')), 'C')
  ) stored,
  constraint opportunities_slug_fmt check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint opportunities_title_len check (char_length(title) between 3 and 140),
  constraint opportunities_app_url_chk check (application_url is null or application_url ~* '^https?://'),
  constraint opportunities_source_url_chk check (source_url is null or source_url ~* '^https?://')
);
create trigger opportunities_updated_at before update on public.opportunities
  for each row execute function public.set_updated_at();
create index opportunities_search_idx on public.opportunities using gin (search);
create index opportunities_listing_idx on public.opportunities (status, deadline);
create index opportunities_category_idx on public.opportunities (category) where status = 'published';

-- Expired listings must never look open. Run daily (Vercel cron or pg_cron; see README).
create function public.expire_past_opportunities() returns int
language plpgsql security definer set search_path = '' as $$
declare v_count int;
begin
  update public.opportunities set status = 'expired'
   where status = 'published' and deadline is not null and deadline < now();
  get diagnostics v_count = row_count;
  return v_count;
end $$;
revoke all on function public.expire_past_opportunities() from public, anon, authenticated;
grant execute on function public.expire_past_opportunities() to service_role;

create table public.saved_opportunities (
  user_id uuid not null references public.profiles (id) on delete cascade,
  opportunity_id uuid not null references public.opportunities (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, opportunity_id)
);

create table public.investors (
  id uuid primary key default gen_random_uuid(),
  slug citext not null unique,
  name text not null,
  description text,
  website_url text,
  country text,
  regions text[] not null default '{}',
  stages public.startup_stage[] not null default '{}',
  sectors text[] not null default '{}',
  thesis text,
  contact_url text,
  verification_status public.verification_status not null default 'unverified',
  is_published boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint investors_slug_fmt check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint investors_name_len check (char_length(name) between 2 and 120),
  constraint investors_website_chk check (website_url is null or website_url ~* '^https?://'),
  constraint investors_contact_chk check (contact_url is null or contact_url ~* '^https?://')
);
create trigger investors_updated_at before update on public.investors
  for each row execute function public.set_updated_at();
create index investors_listing_idx on public.investors (is_published, name);

create table public.inquiries (
  id uuid primary key default gen_random_uuid(),
  startup_id uuid not null references public.startups (id) on delete cascade,
  sender_id uuid references public.profiles (id) on delete set null,
  sender_name text not null,
  sender_email text not null,
  category text not null default 'general',
  subject text not null,
  message text not null,
  status public.inquiry_status not null default 'new',
  read_at timestamptz,
  email_status public.email_delivery_status not null default 'pending',
  email_error text,
  email_attempts int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inquiries_name_len check (char_length(sender_name) between 1 and 100),
  constraint inquiries_email_fmt check (sender_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  constraint inquiries_subject_len check (char_length(subject) between 1 and 150),
  constraint inquiries_message_len check (char_length(message) between 10 and 4000),
  constraint inquiries_category_chk check (category in
    ('general', 'partnership', 'customer', 'investment', 'press', 'hiring', 'other'))
);
create trigger inquiries_updated_at before update on public.inquiries
  for each row execute function public.set_updated_at();
create index inquiries_startup_idx on public.inquiries (startup_id, created_at desc);
create index inquiries_unread_idx on public.inquiries (startup_id) where read_at is null;
create index inquiries_email_retry_idx on public.inquiries (email_status) where email_status in ('pending', 'failed');

-- Invitations are the only way to gain membership. Only the hash of the token is stored.
create table public.team_invitations (
  id uuid primary key default gen_random_uuid(),
  startup_id uuid not null references public.startups (id) on delete cascade,
  email citext not null,
  role public.member_role not null default 'editor',
  token_hash text not null unique,
  invited_by uuid references public.profiles (id) on delete set null,
  status public.invitation_status not null default 'pending',
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint team_invitations_not_owner check (role <> 'owner')
);
create unique index team_invitations_pending_idx on public.team_invitations (startup_id, email) where status = 'pending';

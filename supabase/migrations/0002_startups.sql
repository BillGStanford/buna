-- Buna 0002 — startups, memberships, products, media, links, slug history, verification.

create table public.startups (
  id uuid primary key default gen_random_uuid(),
  slug citext not null unique,
  name text not null,
  tagline text,
  description text,
  logo_url text,
  website_url text,
  country text,
  city text,
  category_id uuid references public.categories (id) on delete set null,
  tags text[] not null default '{}',
  stage public.startup_stage,
  founded_year int,
  status public.startup_status not null default 'draft',
  verification_status public.verification_status not null default 'unverified',
  verified_at timestamptz,
  is_featured boolean not null default false,
  is_demo boolean not null default false,
  published_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search tsvector generated always as (
    setweight(to_tsvector('english'::regconfig, coalesce(name, '')), 'A') ||
    setweight(to_tsvector('english'::regconfig, coalesce(tagline, '')), 'B') ||
    setweight(to_tsvector('english'::regconfig, coalesce(description, '')), 'C')
  ) stored,
  constraint startups_slug_fmt check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 60),
  constraint startups_name_len check (char_length(name) between 2 and 80),
  constraint startups_tagline_len check (tagline is null or char_length(tagline) <= 160),
  constraint startups_description_len check (description is null or char_length(description) <= 5000),
  constraint startups_country_fmt check (country is null or country ~ '^[A-Z]{2}$'),
  constraint startups_year_chk check (founded_year is null or founded_year between 1900 and 2100),
  constraint startups_website_chk check (website_url is null or website_url ~* '^https?://'),
  constraint startups_logo_chk check (logo_url is null or logo_url ~* '^https?://')
);
create trigger startups_updated_at before update on public.startups
  for each row execute function public.set_updated_at();
create index startups_search_idx on public.startups using gin (search);
create index startups_name_trgm_idx on public.startups using gin (name gin_trgm_ops);
create index startups_listing_idx on public.startups (status, published_at desc);
create index startups_country_idx on public.startups (country) where status = 'published';
create index startups_category_idx on public.startups (category_id) where status = 'published';
create index startups_stage_idx on public.startups (stage) where status = 'published';
create index startups_featured_idx on public.startups (is_featured) where is_featured and status = 'published';
create index startups_created_by_idx on public.startups (created_by);

-- Old slugs are kept so that renaming never silently breaks existing links.
create table public.startup_slug_history (
  slug citext primary key,
  startup_id uuid not null references public.startups (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index startup_slug_history_startup_idx on public.startup_slug_history (startup_id);

create function public.startups_slug_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- a slug retired by another startup stays reserved so its old links keep redirecting
  if exists (select 1 from public.startup_slug_history h where h.slug = new.slug and h.startup_id <> new.id) then
    raise exception 'slug_reserved' using errcode = '23505';
  end if;
  if tg_op = 'UPDATE' and old.slug is distinct from new.slug then
    insert into public.startup_slug_history (slug, startup_id) values (old.slug, old.id)
    on conflict (slug) do nothing;
  end if;
  -- reclaiming one's own previous slug removes it from history
  delete from public.startup_slug_history h where h.slug = new.slug and h.startup_id = new.id;
  return new;
end $$;
create trigger startups_slug_guard_trg before insert or update of slug on public.startups
  for each row execute function public.startups_slug_guard();

-- ---------- memberships ----------
create table public.startup_members (
  startup_id uuid not null references public.startups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.member_role not null default 'viewer',
  is_public boolean not null default false,
  public_title text,
  created_at timestamptz not null default now(),
  primary key (startup_id, user_id),
  constraint startup_members_title_len check (public_title is null or char_length(public_title) <= 80)
);
create index startup_members_user_idx on public.startup_members (user_id);

create function public.add_owner_membership() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.created_by is not null then
    insert into public.startup_members (startup_id, user_id, role, is_public)
    values (new.id, new.created_by, 'owner', true)
    on conflict do nothing;
  end if;
  return new;
end $$;
create trigger startups_add_owner after insert on public.startups
  for each row execute function public.add_owner_membership();

-- ---------- membership helpers ----------
create function public.is_startup_member(
  p_startup_id uuid,
  p_roles public.member_role[] default array['owner', 'admin', 'editor', 'viewer']::public.member_role[]
) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.startup_members m
    where m.startup_id = p_startup_id and m.user_id = auth.uid() and m.role = any (p_roles)
  )
$$;

create function public.can_edit_startup(p_startup_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_startup_member(p_startup_id, array['owner', 'admin', 'editor']::public.member_role[])
$$;

create function public.startup_is_published(p_startup_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.startups s where s.id = p_startup_id and s.status = 'published')
$$;

-- ---------- products, media, links ----------
create table public.startup_products (
  id uuid primary key default gen_random_uuid(),
  startup_id uuid not null references public.startups (id) on delete cascade,
  name text not null,
  description text,
  url text,
  image_url text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint startup_products_name_len check (char_length(name) between 1 and 80),
  constraint startup_products_desc_len check (description is null or char_length(description) <= 1000),
  constraint startup_products_url_chk check (url is null or url ~* '^https?://')
);
create trigger startup_products_updated_at before update on public.startup_products
  for each row execute function public.set_updated_at();
create index startup_products_startup_idx on public.startup_products (startup_id, sort_order);

create table public.startup_media (
  id uuid primary key default gen_random_uuid(),
  startup_id uuid not null references public.startups (id) on delete cascade,
  kind text not null default 'gallery',
  storage_path text not null,
  url text not null,
  alt_text text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  constraint startup_media_kind_chk check (kind in ('logo', 'gallery')),
  constraint startup_media_alt_len check (alt_text is null or char_length(alt_text) <= 200)
);
create index startup_media_startup_idx on public.startup_media (startup_id, sort_order);

create table public.startup_links (
  id uuid primary key default gen_random_uuid(),
  startup_id uuid not null references public.startups (id) on delete cascade,
  kind text not null default 'other',
  url text not null,
  label text,
  created_at timestamptz not null default now(),
  constraint startup_links_kind_chk check (kind in
    ('website', 'twitter', 'linkedin', 'github', 'facebook', 'instagram', 'youtube', 'telegram', 'other')),
  constraint startup_links_url_chk check (url ~* '^https?://'),
  constraint startup_links_unique unique (startup_id, url)
);
create index startup_links_startup_idx on public.startup_links (startup_id);

-- ---------- verification ----------
create table public.verification_requests (
  id uuid primary key default gen_random_uuid(),
  startup_id uuid not null references public.startups (id) on delete cascade,
  requested_by uuid references public.profiles (id) on delete set null,
  notes text,
  evidence_paths text[] not null default '{}',
  status public.verification_status not null default 'pending',
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  decision_note text,
  created_at timestamptz not null default now(),
  constraint verification_notes_len check (notes is null or char_length(notes) <= 2000)
);
create unique index verification_one_pending_idx on public.verification_requests (startup_id) where status = 'pending';
create index verification_status_idx on public.verification_requests (status, created_at);

-- ---------- publishing (the only way a startup's status can change for owners) ----------
create function public.set_startup_publication(p_startup_id uuid, p_publish boolean)
returns public.startup_status
language plpgsql security definer set search_path = '' as $$
declare
  v_startup public.startups%rowtype;
  v_review boolean;
  v_new public.startup_status;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not public.is_active_user() then
    raise exception 'account_suspended' using errcode = '42501';
  end if;
  if not public.is_startup_member(p_startup_id, array['owner', 'admin']::public.member_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into v_startup from public.startups where id = p_startup_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_startup.status in ('removed', 'rejected') then
    raise exception 'blocked_by_moderation' using errcode = '42501';
  end if;

  if p_publish then
    if not public.has_verified_email() then
      raise exception 'email_not_verified' using errcode = '42501';
    end if;
    if coalesce(btrim(v_startup.tagline), '') = '' or coalesce(btrim(v_startup.description), '') = ''
       or v_startup.category_id is null or v_startup.country is null then
      raise exception 'profile_incomplete' using errcode = '23514';
    end if;
    select coalesce((s.value #>> '{}')::boolean, false) into v_review
      from public.platform_settings s where s.key = 'startups_require_review';
    v_new := case when coalesce(v_review, false) then 'pending_review' else 'published' end;
  else
    v_new := 'unpublished';
  end if;

  update public.startups
     set status = v_new,
         published_at = case when v_new = 'published' then coalesce(published_at, now()) else published_at end
   where id = p_startup_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), case when p_publish then 'startup.publish' else 'startup.unpublish' end,
          'startup', p_startup_id::text, jsonb_build_object('resulting_status', v_new));
  return v_new;
end $$;
revoke all on function public.set_startup_publication(uuid, boolean) from public, anon;
grant execute on function public.set_startup_publication(uuid, boolean) to authenticated;

-- A verification request moves the startup into "pending" (never straight to verified).
create function public.verification_request_created() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.startups set verification_status = 'pending'
   where id = new.startup_id and verification_status in ('unverified', 'rejected');
  return new;
end $$;
create trigger verification_request_created_trg after insert on public.verification_requests
  for each row execute function public.verification_request_created();

-- regression-test: supabase/tests/platform_tag_catalog.sql
-- 0053: administrator-managed tag catalogue. Tags are deactivated rather than deleted
-- so existing references and historical content remain understandable.

create table if not exists public.platform_tags (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 48),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 60),
  description text check (description is null or char_length(description) <= 240),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger platform_tags_updated_at
  before update on public.platform_tags
  for each row execute function public.set_updated_at();

alter table public.platform_tags enable row level security;

create policy platform_tags_public_read
  on public.platform_tags for select to anon, authenticated
  using (is_active);

create policy platform_tags_staff_read
  on public.platform_tags for select to authenticated
  using (public.is_staff() and public.is_active_user());

grant select on public.platform_tags to anon, authenticated;
revoke insert, update, delete on public.platform_tags from anon, authenticated;

create index if not exists platform_tags_active_name_idx
  on public.platform_tags (name) where is_active;

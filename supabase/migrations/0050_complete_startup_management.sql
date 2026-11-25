-- 0050: complete founder-facing startup management.
-- Adds product asset metadata, public progress communications, hiring state,
-- and a durable audit trail for founder edits and public-data correction requests.

alter table public.startups
  add column if not exists hiring_status text not null default 'not_hiring',
  add column if not exists last_public_update_at timestamptz;

alter table public.startups
  drop constraint if exists startups_hiring_status_check,
  add constraint startups_hiring_status_check
    check (hiring_status in ('not_hiring','open_roles','always_open'));

alter table public.startup_products
  add column if not exists content_type text not null default 'external_link',
  add column if not exists storage_path text,
  add column if not exists file_name text,
  add column if not exists file_size bigint,
  add column if not exists mime_type text;

alter table public.startup_products
  drop constraint if exists startup_products_content_type_check,
  add constraint startup_products_content_type_check
    check (content_type in ('external_link','file_upload')),
  drop constraint if exists startup_products_asset_check,
  add constraint startup_products_asset_check
    check (
      (content_type = 'external_link' and storage_path is null and (url is null or url ~* '^https?://'))
      or (content_type = 'file_upload' and storage_path is not null and file_name is not null)
    );

create table if not exists public.startup_changelog (
  id uuid primary key default gen_random_uuid(),
  startup_id uuid not null references public.startups(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 2 and 120),
  body text not null check (char_length(btrim(body)) between 2 and 5000),
  version text,
  released_on date not null default current_date,
  is_public boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists startup_changelog_public_idx on public.startup_changelog(startup_id, released_on desc) where is_public;
create trigger startup_changelog_updated_at before update on public.startup_changelog
  for each row execute function public.set_updated_at();

create table if not exists public.startup_milestones (
  id uuid primary key default gen_random_uuid(),
  startup_id uuid not null references public.startups(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 2 and 120),
  description text check (description is null or char_length(description) <= 3000),
  target_date date,
  completed_at timestamptz,
  is_public boolean not null default true,
  sort_order integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists startup_milestones_public_idx on public.startup_milestones(startup_id, sort_order, target_date) where is_public;
create trigger startup_milestones_updated_at before update on public.startup_milestones
  for each row execute function public.set_updated_at();

create table if not exists public.startup_announcements (
  id uuid primary key default gen_random_uuid(),
  startup_id uuid not null references public.startups(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 2 and 160),
  body text not null check (char_length(btrim(body)) between 2 and 8000),
  announcement_type text not null default 'company_news'
    check (announcement_type in ('company_news','product_release','fundraising','hiring','partnership','other')),
  is_public boolean not null default true,
  published_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists startup_announcements_public_idx on public.startup_announcements(startup_id, published_at desc) where is_public and published_at is not null;
create trigger startup_announcements_updated_at before update on public.startup_announcements
  for each row execute function public.set_updated_at();

create table if not exists public.startup_correction_requests (
  id uuid primary key default gen_random_uuid(),
  startup_id uuid not null references public.startups(id) on delete cascade,
  field_name text not null check (char_length(btrim(field_name)) between 1 and 80),
  current_value text,
  proposed_value text not null check (char_length(proposed_value) <= 5000),
  reason text not null check (char_length(btrim(reason)) between 5 and 2000),
  status text not null default 'submitted' check (status in ('submitted','reviewing','accepted','rejected')),
  reviewer_id uuid references public.profiles(id) on delete set null,
  reviewer_note text,
  reviewed_at timestamptz,
  submitted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists startup_correction_requests_startup_idx on public.startup_correction_requests(startup_id, created_at desc);

-- Founder edits are captured automatically, including before/after values for public profile fields.
create table if not exists public.startup_profile_change_log (
  id bigint generated always as identity primary key,
  startup_id uuid not null references public.startups(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  changed_fields jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists startup_profile_change_log_startup_idx on public.startup_profile_change_log(startup_id, created_at desc);

create or replace function public.log_startup_profile_changes()
returns trigger language plpgsql security definer set search_path = '' as $$
declare changes jsonb := '{}'::jsonb;
begin
  if old.name is distinct from new.name then changes := changes || jsonb_build_object('name', jsonb_build_object('before',old.name,'after',new.name)); end if;
  if old.tagline is distinct from new.tagline then changes := changes || jsonb_build_object('tagline', jsonb_build_object('before',old.tagline,'after',new.tagline)); end if;
  if old.description is distinct from new.description then changes := changes || jsonb_build_object('description', jsonb_build_object('before',old.description,'after',new.description)); end if;
  if old.problem_statement is distinct from new.problem_statement then changes := changes || jsonb_build_object('problem_statement', jsonb_build_object('before',old.problem_statement,'after',new.problem_statement)); end if;
  if old.solution is distinct from new.solution then changes := changes || jsonb_build_object('solution', jsonb_build_object('before',old.solution,'after',new.solution)); end if;
  if old.website_url is distinct from new.website_url then changes := changes || jsonb_build_object('website_url', jsonb_build_object('before',old.website_url,'after',new.website_url)); end if;
  if old.country is distinct from new.country then changes := changes || jsonb_build_object('country', jsonb_build_object('before',old.country,'after',new.country)); end if;
  if old.city is distinct from new.city then changes := changes || jsonb_build_object('city', jsonb_build_object('before',old.city,'after',new.city)); end if;
  if old.category_id is distinct from new.category_id then changes := changes || jsonb_build_object('category_id', jsonb_build_object('before',old.category_id,'after',new.category_id)); end if;
  if old.stage is distinct from new.stage then changes := changes || jsonb_build_object('stage', jsonb_build_object('before',old.stage,'after',new.stage)); end if;
  if old.business_model is distinct from new.business_model then changes := changes || jsonb_build_object('business_model', jsonb_build_object('before',old.business_model,'after',new.business_model)); end if;
  if old.fundraising_status is distinct from new.fundraising_status then changes := changes || jsonb_build_object('fundraising_status', jsonb_build_object('before',old.fundraising_status,'after',new.fundraising_status)); end if;
  if changes <> '{}'::jsonb then
    insert into public.startup_profile_change_log(startup_id,actor_id,changed_fields)
    values(new.id,auth.uid(),changes);
  end if;
  return new;
end $$;
drop trigger if exists startup_profile_change_log_trg on public.startups;
create trigger startup_profile_change_log_trg after update on public.startups
  for each row execute function public.log_startup_profile_changes();

-- RLS: public visitors see only explicitly public content on published, non-demo companies.
do $$
declare t text;
begin
  foreach t in array array['startup_changelog','startup_milestones','startup_announcements','startup_correction_requests','startup_profile_change_log']
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

drop policy if exists startup_changelog_read on public.startup_changelog;
create policy startup_changelog_read on public.startup_changelog for select to anon, authenticated
using (
  (is_public and exists(select 1 from public.startups s where s.id=startup_id and s.status='published' and not s.is_demo))
  or public.is_startup_member(startup_id)
);
drop policy if exists startup_changelog_write on public.startup_changelog;
create policy startup_changelog_write on public.startup_changelog for all to authenticated
using (public.is_startup_member(startup_id, array['owner','admin','editor']::public.member_role[]))
with check (public.is_startup_member(startup_id, array['owner','admin','editor']::public.member_role[]));

drop policy if exists startup_milestones_read on public.startup_milestones;
create policy startup_milestones_read on public.startup_milestones for select to anon, authenticated
using (
  (is_public and exists(select 1 from public.startups s where s.id=startup_id and s.status='published' and not s.is_demo))
  or public.is_startup_member(startup_id)
);
drop policy if exists startup_milestones_write on public.startup_milestones;
create policy startup_milestones_write on public.startup_milestones for all to authenticated
using (public.is_startup_member(startup_id, array['owner','admin','editor']::public.member_role[]))
with check (public.is_startup_member(startup_id, array['owner','admin','editor']::public.member_role[]));

drop policy if exists startup_announcements_read on public.startup_announcements;
create policy startup_announcements_read on public.startup_announcements for select to anon, authenticated
using (
  (is_public and published_at is not null and exists(select 1 from public.startups s where s.id=startup_id and s.status='published' and not s.is_demo))
  or public.is_startup_member(startup_id)
);
drop policy if exists startup_announcements_write on public.startup_announcements;
create policy startup_announcements_write on public.startup_announcements for all to authenticated
using (public.is_startup_member(startup_id, array['owner','admin','editor']::public.member_role[]))
with check (public.is_startup_member(startup_id, array['owner','admin','editor']::public.member_role[]));

drop policy if exists startup_correction_requests_read on public.startup_correction_requests;
create policy startup_correction_requests_read on public.startup_correction_requests for select to authenticated
using (public.is_startup_member(startup_id));
drop policy if exists startup_correction_requests_insert on public.startup_correction_requests;
create policy startup_correction_requests_insert on public.startup_correction_requests for insert to authenticated
with check (submitted_by = auth.uid() and public.is_startup_member(startup_id, array['owner','admin','editor']::public.member_role[]));
drop policy if exists startup_profile_change_log_read on public.startup_profile_change_log;
create policy startup_profile_change_log_read on public.startup_profile_change_log for select to authenticated
using (public.is_startup_member(startup_id));

grant select, insert, update, delete on public.startup_changelog, public.startup_milestones, public.startup_announcements to authenticated;
grant select on public.startup_changelog, public.startup_milestones, public.startup_announcements to anon;
grant select, insert on public.startup_correction_requests to authenticated;
grant select on public.startup_profile_change_log to authenticated;
grant usage, select on sequence public.startup_profile_change_log_id_seq to authenticated;

-- Product files are separate from screenshot media: PDFs, documents and demos are allowed.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types) values
  ('startup-product-files','startup-product-files',true,20971520,
   array['application/pdf','image/jpeg','image/png','image/webp','text/plain','application/zip'])
on conflict (id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists startup_product_files_insert on storage.objects;
create policy startup_product_files_insert on storage.objects for insert to authenticated
with check (bucket_id='startup-product-files' and public.is_active_user()
  and public.can_edit_startup(public.storage_startup_id(name)));
drop policy if exists startup_product_files_update on storage.objects;
create policy startup_product_files_update on storage.objects for update to authenticated
using (bucket_id='startup-product-files' and public.can_edit_startup(public.storage_startup_id(name)));
drop policy if exists startup_product_files_delete on storage.objects;
create policy startup_product_files_delete on storage.objects for delete to authenticated
using (bucket_id='startup-product-files' and public.can_edit_startup(public.storage_startup_id(name)));

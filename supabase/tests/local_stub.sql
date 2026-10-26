-- LOCAL TESTING ONLY. Emulates the parts of a Supabase project the migrations depend on
-- (auth/storage schemas, API roles, auth.uid()) so they can be tested on plain Postgres.
-- Never run this against a real Supabase project.
create schema if not exists extensions;
create schema if not exists auth;
create schema if not exists storage;
do $$ begin
  if not exists (select from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;
grant usage on schema public, auth, storage, extensions to anon, authenticated, service_role;
-- Supabase grants API roles everything on new public objects by default; the migrations then revoke
-- what clients must not have. Emulating the default makes the tests meaningful.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter database buna_test set search_path = "$user", public, extensions;
set search_path = "$user", public, extensions;

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  email_confirmed_at timestamptz,
  raw_user_meta_data jsonb not null default '{}'::jsonb
);
-- Like Supabase's auth.uid(): reads the JWT subject from either the legacy claim GUC or the claims JSON.
create function auth.uid() returns uuid language sql stable as
$$ select coalesce(
     nullif(current_setting('request.jwt.claim.sub', true), ''),
     nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
   )::uuid $$;

create table storage.buckets (
  id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid
);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as
$$ select (string_to_array(name, '/'))[1:greatest(array_length(string_to_array(name, '/'), 1) - 1, 0)] $$;
grant select, insert, update, delete on storage.objects to authenticated;

-- Phase 7 regression checks: company permissions and private document storage.
-- Run with the Supabase test database after all migrations are applied.
begin;

do $$
declare
  v_table text;
begin
  -- Membership roles must never be writable directly by an authenticated client.
  if has_table_privilege('authenticated', 'public.startup_members', 'INSERT')
     or has_table_privilege('authenticated', 'public.startup_members', 'UPDATE')
     or has_table_privilege('authenticated', 'public.startup_members', 'DELETE') then
    raise exception 'Authenticated clients must not directly mutate startup_members';
  end if;

  -- Confidential data room and verification documents must remain private buckets.
  if not exists (select 1 from storage.buckets where id='startup-documents' and public=false) then
    raise exception 'startup-documents bucket must be private';
  end if;
  if not exists (select 1 from storage.buckets where id='verification-docs' and public=false) then
    raise exception 'verification-docs bucket must be private';
  end if;

  -- All private data-room tables must have RLS enabled.
  foreach v_table in array array['startup_documents','startup_document_access_requests'] loop
    if not exists (
      select 1 from pg_class c
      join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname=v_table and c.relrowsecurity
    ) then
      raise exception 'RLS must be enabled on public.%', v_table;
    end if;
  end loop;

  -- The storage object policies are the second authorization boundary after document-row RLS.
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='startup_documents_storage_team_select') then
    raise exception 'Private startup document read policy is missing';
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='startup_documents_storage_team_insert') then
    raise exception 'Private startup document upload policy is missing';
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='startup_documents_storage_team_delete') then
    raise exception 'Private startup document delete policy is missing';
  end if;
end $$;

rollback;

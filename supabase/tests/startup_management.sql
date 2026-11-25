-- Regression coverage for migration 0050_complete_startup_management.sql.
begin;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'startup_changelog','startup_milestones','startup_announcements',
    'startup_correction_requests','startup_profile_change_log'
  ] loop
    if to_regclass('public.' || v_table) is null then
      raise exception 'Required startup management table is missing: %', v_table;
    end if;
    if not exists (
      select 1 from pg_class c
      join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname=v_table and c.relrowsecurity
    ) then
      raise exception 'RLS is not enabled for %', v_table;
    end if;
  end loop;

  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='startups' and column_name='hiring_status') then
    raise exception 'startups.hiring_status is missing';
  end if;
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='startups' and column_name='is_product_live') then
    raise exception 'startups.is_product_live is missing';
  end if;
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='startup_products' and column_name='content_type') then
    raise exception 'startup_products.content_type is missing';
  end if;
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='startup_products' and column_name='storage_path') then
    raise exception 'startup_products.storage_path is missing';
  end if;
  if to_regprocedure('public.transfer_startup_ownership(uuid,uuid)') is null then
    raise exception 'Ownership transfer function is missing';
  end if;
  if to_regprocedure('public.log_startup_profile_changes()') is null then
    raise exception 'Profile change audit trigger function is missing';
  end if;
  if not exists(select 1 from pg_trigger where tgname='startup_profile_change_log_trg' and not tgisinternal) then
    raise exception 'Profile change audit trigger is missing';
  end if;
  if not exists(select 1 from storage.buckets where id='startup-product-files' and public and file_size_limit=20971520) then
    raise exception 'Public product file storage bucket is missing or misconfigured';
  end if;
end $$;

rollback;

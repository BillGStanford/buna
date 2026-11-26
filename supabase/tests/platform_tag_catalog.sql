-- Regression test for migration 0053_platform_tag_catalog.sql.
-- Run against the migrated test database.

do $$
begin
  if to_regclass('public.platform_tags') is null then
    raise exception 'platform_tags table was not created';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.platform_tags'::regclass
      and conname = 'platform_tags_slug_key'
  ) then
    raise exception 'platform tag slugs must be unique';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'platform_tags'
      and policyname = 'platform_tags_public_read'
  ) then
    raise exception 'active platform tags must be publicly readable';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'platform_tags'
      and policyname = 'platform_tags_staff_read'
  ) then
    raise exception 'staff read policy is required';
  end if;
end
$$;

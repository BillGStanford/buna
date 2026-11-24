-- Regression coverage for migration 0048.
\set ON_ERROR_STOP on
begin;
do $$
begin
  assert not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'profiles' and column_name = 'banner_url'
  ), 'profile banner column is removed';
  assert not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'public_profiles' and column_name = 'banner_url'
  ), 'public profile projection no longer exposes banners';
  assert exists (select 1 from storage.buckets where id = 'profile-banners' and not public),
    'legacy banner bucket is private pending Storage API cleanup';
  assert not exists (
    select 1 from pg_policies
     where schemaname = 'storage' and tablename = 'objects' and policyname like 'profile_banners_%'
  ), 'banner storage policies are removed';
end
$$;
rollback;

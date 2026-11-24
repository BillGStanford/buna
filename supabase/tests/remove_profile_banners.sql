-- Regression coverage for migration 0048.
\set ON_ERROR_STOP on
begin;
do $$
begin
  assert not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'profiles' and column_name = 'banner_url'
  ), 'profile banner column is removed';
  assert not exists (select 1 from storage.buckets where id = 'profile-banners'),
    'profile banner storage bucket is removed';
end
$$;
rollback;

begin;

do $test$
declare
  v_type text;
  v_data jsonb;
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='profiles' and column_name='account_type'
  ) then raise exception 'profiles.account_type missing'; end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='profiles' and column_name='onboarding_data'
  ) then raise exception 'profiles.onboarding_data missing'; end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid='public.profiles'::regclass and conname='profiles_account_type_check'
  ) then raise exception 'account type constraint missing'; end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid='public.profiles'::regclass and conname='profiles_onboarding_data_object_check'
  ) then raise exception 'onboarding JSON object constraint missing'; end if;

  -- The onboarding server action runs as authenticated. Verify every column
  -- written by its identity, interests and founder-path steps is updateable.
  if not has_column_privilege('authenticated', 'public.profiles', 'account_type', 'UPDATE')
    or not has_column_privilege('authenticated', 'public.profiles', 'onboarding_data', 'UPDATE')
    or not has_column_privilege('authenticated', 'public.profiles', 'display_name', 'UPDATE')
    or not has_column_privilege('authenticated', 'public.profiles', 'username', 'UPDATE')
    or not has_column_privilege('authenticated', 'public.profiles', 'headline', 'UPDATE')
    or not has_column_privilege('authenticated', 'public.profiles', 'bio', 'UPDATE')
    or not has_column_privilege('authenticated', 'public.profiles', 'avatar_url', 'UPDATE')
    or not has_column_privilege('authenticated', 'public.profiles', 'website_url', 'UPDATE')
    or not has_column_privilege('authenticated', 'public.profiles', 'professional_role', 'UPDATE')
    or not has_column_privilege('authenticated', 'public.profiles', 'interests', 'UPDATE')
    or not has_column_privilege('authenticated', 'public.profiles', 'country', 'UPDATE')
    or not has_column_privilege('authenticated', 'public.profiles', 'city', 'UPDATE')
    or not has_column_privilege('authenticated', 'public.profiles', 'social_links', 'UPDATE')
    or not has_column_privilege('authenticated', 'public.profiles', 'founder_status', 'UPDATE')
    or not has_column_privilege('authenticated', 'public.profiles', 'startup_intent', 'UPDATE')
    or not has_column_privilege('authenticated', 'public.profiles', 'onboarding_completed_at', 'UPDATE')
    or not has_column_privilege('authenticated', 'public.profiles', 'onboarding_skipped_at', 'UPDATE')
  then raise exception 'authenticated is missing one or more scoped profile UPDATE grants required by onboarding'; end if;

  if (select count(*) from public.profiles where jsonb_typeof(onboarding_data) <> 'object') > 0 then
    raise exception 'onboarding_data contains a non-object value';
  end if;
end
$test$;

rollback;

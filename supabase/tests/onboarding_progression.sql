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

  if (select count(*) from public.profiles where jsonb_typeof(onboarding_data) <> 'object') > 0 then
    raise exception 'onboarding_data contains a non-object value';
  end if;
end
$test$;

rollback;

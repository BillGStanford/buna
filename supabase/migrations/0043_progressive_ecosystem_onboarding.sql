-- Buna 0043 — progressive ecosystem onboarding data.
-- regression-test: supabase/tests/onboarding_progression.sql

alter table public.profiles
  add column if not exists account_type text,
  add column if not exists onboarding_data jsonb not null default '{}'::jsonb;

do $onboarding$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.profiles'::regclass and conname = 'profiles_account_type_check') then
    alter table public.profiles add constraint profiles_account_type_check
      check (account_type is null or account_type in ('founder_business','investor'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.profiles'::regclass and conname = 'profiles_onboarding_data_object_check') then
    alter table public.profiles add constraint profiles_onboarding_data_object_check
      check (jsonb_typeof(onboarding_data) = 'object');
  end if;
end
$onboarding$;

comment on column public.profiles.account_type is 'Member onboarding pathway: founder_business or investor.';
comment on column public.profiles.onboarding_data is 'Versioned progressive onboarding answers; public-safe fields are separately projected onto profile columns.';

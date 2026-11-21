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

alter table public.investor_applications
  add column if not exists thesis text,
  add column if not exists investment_stages text[] not null default '{}',
  add column if not exists investment_geographies text[] not null default '{}',
  add column if not exists investment_sectors text[] not null default '{}',
  add column if not exists investment_min numeric(14,2),
  add column if not exists investment_max numeric(14,2);

do $investor_onboarding$
begin
  if not exists (select 1 from pg_constraint where conrelid='public.investor_applications'::regclass and conname='investor_app_thesis_len') then
    alter table public.investor_applications add constraint investor_app_thesis_len check (thesis is null or char_length(thesis) <= 2000);
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.investor_applications'::regclass and conname='investor_app_investment_range') then
    alter table public.investor_applications add constraint investor_app_investment_range check (
      (investment_min is null or investment_min >= 0) and
      (investment_max is null or investment_max >= 0) and
      (investment_min is null or investment_max is null or investment_min <= investment_max)
    );
  end if;
end
$investor_onboarding$;

grant insert (thesis, investment_stages, investment_geographies, investment_sectors, investment_min, investment_max)
  on public.investor_applications to authenticated;
grant update (thesis, investment_stages, investment_geographies, investment_sectors, investment_min, investment_max)
  on public.investor_applications to authenticated;

comment on column public.profiles.account_type is 'Member onboarding pathway: founder_business or investor.';
comment on column public.profiles.onboarding_data is 'Versioned progressive onboarding answers; public-safe fields are separately projected onto profile columns.';

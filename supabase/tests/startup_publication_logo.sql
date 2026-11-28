-- Regression coverage for migration 0056_startup_publication_logo.sql.
begin;

do $$
declare
  v_definition text;
begin
  if to_regprocedure('public.set_startup_publication(uuid,boolean)') is null then
    raise exception 'Startup publication function is missing';
  end if;

  select pg_get_functiondef('public.set_startup_publication(uuid,boolean)'::regprocedure)
    into v_definition;

  if position('v_startup.logo_url' in v_definition) = 0 then
    raise exception 'Startup publication does not require a company logo';
  end if;
  if position('profile_incomplete' in v_definition) = 0 then
    raise exception 'Startup publication no longer reports incomplete profiles';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='startups' and column_name='logo_url'
  ) then
    raise exception 'startups.logo_url is missing';
  end if;
end $$;

rollback;

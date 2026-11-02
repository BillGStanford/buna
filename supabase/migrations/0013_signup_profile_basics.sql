-- Buna 0013 — collect the existing lightweight onboarding answers at account creation.
-- Auth metadata is copied server-side by the auth.users trigger; clients cannot set platform roles.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_username text;
  v_try int := 0;
  v_country text;
  v_founder_status text;
  v_startup_intent text;
  v_terms_version text := nullif(left(new.raw_user_meta_data ->> 'terms_version', 40), '');
  v_signup_onboarding boolean := new.raw_user_meta_data ->> 'signup_onboarding_version' = '1';
begin
  -- Placeholder username remains in place until the member chooses a public handle.
  loop
    v_username := 'user-' || substr(md5(random()::text || clock_timestamp()::text || new.id::text), 1, 10);
    exit when v_try >= 5 or not exists (select 1 from public.profiles p where p.username = v_username);
    v_try := v_try + 1;
  end loop;

  v_country := upper(nullif(left(coalesce(new.raw_user_meta_data ->> 'country', ''), 2), ''));
  if v_country !~ '^[A-Z]{2}$' then v_country := null; end if;

  v_founder_status := new.raw_user_meta_data ->> 'founder_status';
  if v_founder_status not in ('founder', 'cofounder_seeking', 'team_member', 'investor', 'mentor', 'explorer') then
    v_founder_status := null;
  end if;

  v_startup_intent := new.raw_user_meta_data ->> 'startup_intent';
  if v_startup_intent not in ('create', 'join', 'none') then
    v_startup_intent := null;
  end if;

  insert into public.profiles (
    id, username, display_name, country, founder_status, startup_intent,
    terms_accepted_at, terms_version, onboarding_completed_at
  ) values (
    new.id,
    v_username,
    left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 80),
    v_country,
    v_founder_status,
    v_startup_intent,
    case when v_terms_version is not null then now() end,
    v_terms_version,
    case when v_signup_onboarding then now() else null end
  );
  insert into public.notification_preferences (user_id) values (new.id);
  return new;
end $$;

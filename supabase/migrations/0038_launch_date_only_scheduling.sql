-- Buna 0038 — compare date-only launch schedules at calendar-day granularity.
-- launch_date is a DATE, so comparing its UTC midnight to now() incorrectly
-- rejects tomorrow for much of the current day when the configured notice is 24h.
create or replace function public.submit_launch(p_launch_id uuid) returns public.launch_status
language plpgsql security definer set search_path = '' as $$
declare
  v public.launches%rowtype;
  v_config public.launch_platform_config%rowtype;
  v_new public.launch_status;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if not public.is_active_user() then raise exception 'account_suspended' using errcode = '42501'; end if;
  select * into v from public.launches where id = p_launch_id for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if not public.can_edit_launch(p_launch_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  if v.status not in ('draft', 'rejected') then raise exception 'invalid_state' using errcode = '55000'; end if;
  if not public.has_verified_email() then raise exception 'email_not_verified' using errcode = '42501'; end if;
  if v.category_id is null or coalesce(btrim(v.description), '') = '' then raise exception 'launch_incomplete' using errcode = '23514'; end if;

  select * into v_config from public.launch_platform_config where id = true;

  -- Scheduling is date-only. Round the configured hour notice up to whole
  -- calendar days: 24 hours permits tomorrow; 48 hours permits the day after.
  if v.launch_date is not null
     and v.launch_date > current_date
     and v.launch_date < current_date
       + ((coalesce(v_config.schedule_min_lead_hours, 24) + 23) / 24) then
    raise exception 'schedule_too_soon' using errcode = '23514';
  end if;

  v_new := case
    when coalesce(v_config.publishing_mode, 'instant') = 'review' then 'pending_review'
    when v.launch_date is not null and v.launch_date > current_date then 'scheduled'
    else 'published'
  end;

  update public.launches set
    status = v_new,
    moderation_note = null,
    published_at = case when v_new = 'published' then coalesce(published_at, now()) else published_at end,
    competition_started_at = case when v_new = 'published' then now() else null end,
    competition_ends_at = case when v_new = 'published'
      then now() + make_interval(hours => coalesce(v_config.competition_duration_hours, 24)) else null end,
    competition_day = case when v_new = 'published' then (now() at time zone 'UTC')::date else null end
  where id = p_launch_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'launch.submit', 'launch', p_launch_id::text,
    jsonb_build_object('resulting_status', v_new, 'publishing_mode', coalesce(v_config.publishing_mode, 'instant')));
  return v_new;
end $$;

revoke all on function public.submit_launch(uuid) from public, anon;
grant execute on function public.submit_launch(uuid) to authenticated;

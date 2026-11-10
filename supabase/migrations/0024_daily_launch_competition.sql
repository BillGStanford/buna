-- Buna 0024 — daily launch competition, lifecycle controls and permanent archive.
-- A competition is time-bounded; the published product page is not.

create table public.launch_platform_config (
  id boolean primary key default true check (id),
  publishing_mode text not null default 'instant' check (publishing_mode in ('instant', 'review')),
  competition_duration_hours int not null default 24 check (competition_duration_hours between 1 and 72),
  schedule_min_lead_hours int not null default 24 check (schedule_min_lead_hours between 0 and 720),
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.launch_platform_config enable row level security;
grant select, update on public.launch_platform_config to authenticated;
create policy launch_platform_config_admin_select on public.launch_platform_config
  for select to authenticated using (public.is_admin() and public.is_active_user());
create policy launch_platform_config_admin_update on public.launch_platform_config
  for update to authenticated using (public.is_admin() and public.is_active_user())
  with check (public.is_admin() and public.is_active_user());
insert into public.launch_platform_config (id, publishing_mode)
values (true, case when exists (
  select 1 from public.platform_settings where key = 'launches_require_review' and value = 'true'::jsonb
) then 'review' else 'instant' end)
on conflict (id) do nothing;

alter table public.launches
  add column competition_started_at timestamptz,
  add column competition_ends_at timestamptz,
  add column competition_day date;

update public.launches
   set competition_started_at = coalesce(published_at, created_at),
       competition_ends_at = coalesce(published_at, created_at) + interval '24 hours',
       competition_day = (coalesce(published_at, created_at) at time zone 'UTC')::date
 where status = 'published' and competition_started_at is null;

create index launches_competition_active_idx on public.launches (competition_ends_at, vote_count desc)
  where status = 'published' and competition_ends_at is not null;
create index launches_competition_day_idx on public.launches (competition_day desc, vote_count desc)
  where status = 'published';

create or replace function public.submit_launch(p_launch_id uuid) returns public.launch_status
language plpgsql security definer set search_path = '' as $$
declare v public.launches%rowtype; v_config public.launch_platform_config%rowtype; v_new public.launch_status;
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
  if v.launch_date is not null and v.launch_date > current_date
     and (v.launch_date::timestamp at time zone 'UTC') < now() + make_interval(hours => coalesce(v_config.schedule_min_lead_hours, 24)) then
    raise exception 'schedule_too_soon' using errcode = '23514';
  end if;
  v_new := case when coalesce(v_config.publishing_mode, 'instant') = 'review' then 'pending_review'
    when v.launch_date is not null and v.launch_date > current_date then 'scheduled' else 'published' end;
  update public.launches set status = v_new, moderation_note = null,
    published_at = case when v_new = 'published' then coalesce(published_at, now()) else published_at end,
    competition_started_at = case when v_new = 'published' then now() else null end,
    competition_ends_at = case when v_new = 'published' then now() + make_interval(hours => coalesce(v_config.competition_duration_hours, 24)) else null end,
    competition_day = case when v_new = 'published' then (now() at time zone 'UTC')::date else null end
    where id = p_launch_id;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'launch.submit', 'launch', p_launch_id::text,
    jsonb_build_object('resulting_status', v_new, 'publishing_mode', coalesce(v_config.publishing_mode, 'instant')));
  return v_new;
end $$;
revoke all on function public.submit_launch(uuid) from public, anon;
grant execute on function public.submit_launch(uuid) to authenticated;

create or replace function public.moderate_launch(p_launch_id uuid, p_action text, p_note text default null)
returns public.launch_status language plpgsql security definer set search_path = '' as $$
declare v public.launches%rowtype; v_config public.launch_platform_config%rowtype; v_new public.launch_status;
begin
  if auth.uid() is null or not public.is_staff() then raise exception 'forbidden' using errcode = '42501'; end if;
  if not public.is_active_user() then raise exception 'account_suspended' using errcode = '42501'; end if;
  select * into v from public.launches where id = p_launch_id for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  select * into v_config from public.launch_platform_config where id = true;
  v_new := v.status;
  if p_action = 'approve' then
    if v.status <> 'pending_review' then raise exception 'invalid_state' using errcode = '55000'; end if;
    v_new := case when v.launch_date is not null and v.launch_date > current_date then 'scheduled' else 'published' end;
    update public.launches set status = v_new, moderation_note = null,
      published_at = case when v_new = 'published' then coalesce(published_at, now()) else published_at end,
      competition_started_at = case when v_new = 'published' then now() else null end,
      competition_ends_at = case when v_new = 'published' then now() + make_interval(hours => coalesce(v_config.competition_duration_hours, 24)) else null end,
      competition_day = case when v_new = 'published' then (now() at time zone 'UTC')::date else null end where id = p_launch_id;
    perform public.create_notification(v.submitted_by, 'launch_approved',
      case when v_new = 'published' then v.name || ' is live' else v.name || ' is approved and scheduled' end,
      null, '/launches/' || v.slug, 'launch:' || v.id || ':' || v_new || ':' || extract(epoch from now())::bigint, 'moderation');
  elsif p_action = 'reject' then
    if v.status <> 'pending_review' then raise exception 'invalid_state' using errcode = '55000'; end if;
    if coalesce(btrim(p_note), '') = '' then raise exception 'note_required' using errcode = '23514'; end if;
    v_new := 'rejected';
    update public.launches set status = v_new, moderation_note = left(p_note, 500) where id = p_launch_id;
    perform public.create_notification(v.submitted_by, 'launch_rejected', v.name || ' needs changes', left(p_note, 300),
      '/dashboard/launches/' || v.id, 'launch:' || v.id || ':rejected:' || extract(epoch from now())::bigint, 'moderation');
  elsif p_action = 'remove' then
    v_new := 'removed';
    update public.launches set status = v_new, moderation_note = left(coalesce(p_note, ''), 500), is_featured = false where id = p_launch_id;
  elsif p_action in ('feature', 'unfeature') then
    if v.status <> 'published' then raise exception 'invalid_state' using errcode = '55000'; end if;
    update public.launches set is_featured = (p_action = 'feature') where id = p_launch_id;
  else raise exception 'unknown_action' using errcode = '22023';
  end if;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'launch.' || p_action, 'launch', p_launch_id::text, jsonb_build_object('note', p_note, 'resulting_status', v_new));
  return v_new;
end $$;
revoke all on function public.moderate_launch(uuid, text, text) from public, anon;
grant execute on function public.moderate_launch(uuid, text, text) to authenticated;

create or replace function public.publish_due_launches() returns int
language plpgsql security definer set search_path = '' as $$
declare v_count int := 0; r record; v_hours int;
begin
  select competition_duration_hours into v_hours from public.launch_platform_config where id = true;
  for r in
    update public.launches set status = 'published', published_at = now(), competition_started_at = now(),
      competition_ends_at = now() + make_interval(hours => coalesce(v_hours, 24)),
      competition_day = (now() at time zone 'UTC')::date
    where status = 'scheduled' and launch_date <= current_date
    returning id, slug, name, submitted_by
  loop
    v_count := v_count + 1;
    perform public.create_notification(r.submitted_by, 'launch_approved', r.name || ' is live', null, '/launches/' || r.slug,
      'launch:' || r.id || ':live', 'moderation');
  end loop;
  return v_count;
end $$;
revoke all on function public.publish_due_launches() from public, anon, authenticated;
grant execute on function public.publish_due_launches() to service_role;

create or replace function public.list_launches(
  p_sort text, p_category uuid, p_tag text, p_query text, p_since timestamptz, p_limit int, p_offset int
) returns table (id uuid, score double precision, total bigint)
language plpgsql stable security definer set search_path = '' as $$
declare v_q text := nullif(btrim(coalesce(p_query, '')), '');
begin
  if p_sort = 'upcoming' then
    return query select l.id, 0::double precision, count(*) over () from public.launches l
    where l.status = 'scheduled' and (p_category is null or l.category_id = p_category)
      and (p_tag is null or p_tag = any (l.tags))
      and (v_q is null or l.search @@ websearch_to_tsquery('english', v_q) or position(lower(v_q) in lower(l.name)) > 0)
    order by l.launch_date asc, l.id limit least(greatest(p_limit, 1), 50) offset greatest(p_offset, 0);
  elsif p_sort = 'today' then
    return query select l.id, l.vote_count::double precision, count(*) over () from public.launches l
    where l.status = 'published' and l.competition_ends_at > now()
      and (p_category is null or l.category_id = p_category) and (p_tag is null or p_tag = any (l.tags))
      and (p_since is null or l.published_at >= p_since)
      and (v_q is null or l.search @@ websearch_to_tsquery('english', v_q) or position(lower(v_q) in lower(l.name)) > 0)
    order by l.vote_count desc, l.comment_count desc, l.published_at asc nulls last, l.id
    limit least(greatest(p_limit, 1), 50) offset greatest(p_offset, 0);
  elsif p_sort in ('rising', 'trending') then
    return query select l.id, coalesce(sum(case when v.created_at >= now() - interval '6 hours' then 1.0 else 0.0 end), 0)::double precision, count(*) over ()
    from public.launches l left join public.launch_votes v on v.launch_id = l.id
    where l.status = 'published' and l.competition_ends_at > now()
      and (p_category is null or l.category_id = p_category) and (p_tag is null or p_tag = any (l.tags))
      and (p_since is null or l.published_at >= p_since)
      and (v_q is null or l.search @@ websearch_to_tsquery('english', v_q) or position(lower(v_q) in lower(l.name)) > 0)
    group by l.id order by 2 desc, l.vote_count desc, l.published_at desc nulls last, l.id
    limit least(greatest(p_limit, 1), 50) offset greatest(p_offset, 0);
  elsif p_sort = 'discussed' then
    return query select l.id, l.comment_count::double precision, count(*) over () from public.launches l
    where l.status = 'published' and l.competition_ends_at > now()
      and (p_category is null or l.category_id = p_category) and (p_tag is null or p_tag = any (l.tags))
      and (p_since is null or l.published_at >= p_since)
      and (v_q is null or l.search @@ websearch_to_tsquery('english', v_q) or position(lower(v_q) in lower(l.name)) > 0)
    order by l.comment_count desc, l.vote_count desc, l.published_at desc nulls last, l.id
    limit least(greatest(p_limit, 1), 50) offset greatest(p_offset, 0);
  elsif p_sort = 'archive' then
    return query select l.id, l.vote_count::double precision, count(*) over () from public.launches l
    where l.status = 'published' and l.competition_ends_at <= now()
      and (p_category is null or l.category_id = p_category) and (p_tag is null or p_tag = any (l.tags))
      and (p_since is null or l.published_at >= p_since)
      and (v_q is null or l.search @@ websearch_to_tsquery('english', v_q) or position(lower(v_q) in lower(l.name)) > 0)
    order by l.competition_day desc nulls last, l.vote_count desc, l.published_at desc nulls last, l.id
    limit least(greatest(p_limit, 1), 50) offset greatest(p_offset, 0);
  else
    return query select l.id, 0::double precision, count(*) over () from public.launches l
    where l.status = 'published' and (p_sort <> 'featured' or l.is_featured)
      and (p_category is null or l.category_id = p_category) and (p_tag is null or p_tag = any (l.tags))
      and (p_since is null or l.published_at >= p_since)
      and (v_q is null or l.search @@ websearch_to_tsquery('english', v_q) or position(lower(v_q) in lower(l.name)) > 0)
    order by case when p_sort = 'top' then l.vote_count end desc nulls last, l.published_at desc nulls last, l.id
    limit least(greatest(p_limit, 1), 50) offset greatest(p_offset, 0);
  end if;
end $$;
revoke all on function public.list_launches(text, uuid, text, text, timestamptz, int, int) from public;
grant execute on function public.list_launches(text, uuid, text, text, timestamptz, int, int) to anon, authenticated, service_role;

create function public.list_launch_competition_days(p_limit int default 60)
returns table (competition_day date, launch_count bigint, top_launch_id uuid)
language sql stable security definer set search_path = '' as $$
  select l.competition_day, count(*)::bigint, (array_agg(l.id order by l.vote_count desc, l.published_at asc))[1]
  from public.launches l where l.status = 'published' and l.competition_ends_at <= now() and l.competition_day is not null
  group by l.competition_day order by l.competition_day desc limit least(greatest(p_limit, 1), 180)
$$;
revoke all on function public.list_launch_competition_days(int) from public;
grant execute on function public.list_launch_competition_days(int) to anon, authenticated, service_role;


-- Voting and new discussion are only open during the configured competition window.
-- Public visibility and the permanent product page remain unaffected after expiry.
drop policy votes_insert on public.launch_votes;
create policy votes_insert on public.launch_votes for insert to authenticated
  with check (user_id = auth.uid() and public.is_active_user() and public.has_verified_email()
    and exists (select 1 from public.launches l where l.id = launch_id
      and l.status = 'published' and l.competition_ends_at > now()));

drop policy comments_insert on public.comments;
create policy comments_insert on public.comments for insert to authenticated
  with check (author_id = auth.uid() and public.is_active_user() and public.has_verified_email()
    and exists (select 1 from public.launches l where l.id = launch_id
      and l.status = 'published' and l.competition_ends_at > now()));

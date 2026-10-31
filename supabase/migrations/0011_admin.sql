-- Buna 0011 — administration: startup/comment moderation, reports queue, user management, verification review,
-- platform settings, overview. Every function re-checks the caller's role itself and writes the audit log.

create function public.assert_staff() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.is_staff() or not public.is_active_user() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
end $$;

create function public.assert_admin() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.is_admin() or not public.is_active_user() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
end $$;

create function public.audit(p_action text, p_type text, p_id text, p_meta jsonb) returns void
language sql security definer set search_path = '' as $$
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata) values (auth.uid(), p_action, p_type, p_id, coalesce(p_meta, '{}'::jsonb))
$$;

-- notify a startup's owners and admins (in-app; email per their moderation preference)
create function public.notify_startup_managers(p_startup uuid, p_type text, p_title text, p_body text, p_dedupe text) returns void
language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  for r in select m.user_id from public.startup_members m where m.startup_id = p_startup and m.role in ('owner', 'admin') loop
    perform public.create_notification(r.user_id, p_type, p_title, p_body, '/dashboard/startup/' || p_startup || '/settings', p_dedupe, 'moderation');
  end loop;
end $$;
revoke all on function public.assert_staff(), public.assert_admin() from public, anon;
revoke all on function public.audit(text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.notify_startup_managers(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.assert_staff(), public.assert_admin() to authenticated;

-- ---------- startup moderation ----------
create function public.moderate_startup(p_startup uuid, p_action text, p_note text default null) returns public.startup_status
language plpgsql security definer set search_path = '' as $$
declare v public.startups%rowtype; v_new public.startup_status;
begin
  perform public.assert_staff();
  select * into v from public.startups where id = p_startup for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  v_new := v.status;

  if p_action = 'approve' then
    if v.status <> 'pending_review' then raise exception 'invalid_state' using errcode = '55000'; end if;
    v_new := 'published';
    update public.startups set status = v_new, published_at = coalesce(published_at, now()) where id = p_startup;
    perform public.notify_startup_managers(p_startup, 'startup_approved', v.name || ' is live', null, 'startup:' || p_startup || ':approved:' || extract(epoch from now())::bigint);
  elsif p_action = 'reject' then
    if v.status <> 'pending_review' then raise exception 'invalid_state' using errcode = '55000'; end if;
    if coalesce(btrim(p_note), '') = '' then raise exception 'note_required' using errcode = '23514'; end if;
    v_new := 'rejected';
    update public.startups set status = v_new where id = p_startup;
    perform public.notify_startup_managers(p_startup, 'startup_rejected', v.name || ' needs changes', left(p_note, 300), 'startup:' || p_startup || ':rejected:' || extract(epoch from now())::bigint);
  elsif p_action = 'unpublish' then
    if v.status not in ('published', 'pending_review') then raise exception 'invalid_state' using errcode = '55000'; end if;
    v_new := 'unpublished';
    update public.startups set status = v_new, is_featured = false where id = p_startup;
  elsif p_action = 'remove' then
    if v.status = 'removed' then raise exception 'invalid_state' using errcode = '55000'; end if;
    v_new := 'removed';
    update public.startups set status = v_new, is_featured = false where id = p_startup;
    perform public.notify_startup_managers(p_startup, 'startup_removed', v.name || ' was removed', left(coalesce(p_note, ''), 300), 'startup:' || p_startup || ':removed:' || extract(epoch from now())::bigint);
  elsif p_action = 'restore' then
    if v.status not in ('removed', 'rejected') then raise exception 'invalid_state' using errcode = '55000'; end if;
    v_new := 'unpublished';
    update public.startups set status = v_new where id = p_startup;
  elsif p_action in ('feature', 'unfeature') then
    if v.status <> 'published' then raise exception 'invalid_state' using errcode = '55000'; end if;
    update public.startups set is_featured = (p_action = 'feature') where id = p_startup;
  else
    raise exception 'unknown_action' using errcode = '22023';
  end if;
  perform public.audit('startup.' || p_action, 'startup', p_startup::text, jsonb_build_object('note', p_note, 'resulting_status', v_new));
  return v_new;
end $$;

-- ---------- comment moderation ----------
create function public.moderate_comment(p_comment uuid, p_action text, p_note text default null) returns public.comment_status
language plpgsql security definer set search_path = '' as $$
declare v public.comments%rowtype; v_new public.comment_status;
begin
  perform public.assert_staff();
  select * into v from public.comments where id = p_comment for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if v.status = 'deleted' then raise exception 'invalid_state' using errcode = '55000'; end if;   -- the author's own deletion stays
  if p_action = 'hide' then v_new := 'hidden';
  elsif p_action = 'restore' then v_new := 'visible';
  else raise exception 'unknown_action' using errcode = '22023'; end if;
  update public.comments set status = v_new where id = p_comment;
  perform public.audit('comment.' || p_action, 'comment', p_comment::text, jsonb_build_object('note', p_note));
  return v_new;
end $$;

-- ---------- reports ----------
create function public.resolve_report(p_report uuid, p_status public.report_status, p_note text default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.assert_staff();
  if p_status = 'open' then raise exception 'invalid_state' using errcode = '55000'; end if;
  update public.reports set status = p_status, handled_by = auth.uid(), handled_at = now(), resolution_note = left(p_note, 500) where id = p_report;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  perform public.audit('report.' || p_status, 'report', p_report::text, jsonb_build_object('note', p_note));
end $$;

create function public.admin_list_reports(p_status text, p_limit int, p_offset int)
returns table (id uuid, target_type text, target_id uuid, reason text, details text, status public.report_status, created_at timestamptz,
               handled_at timestamptz, resolution_note text, reporter_username text, target_label text, target_url text, target_state text,
               same_target_count bigint, total bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.assert_staff();
  return query
  select r.id, r.target_type, r.target_id, r.reason, r.details, r.status, r.created_at, r.handled_at, r.resolution_note,
         (select p.username::text from public.profiles p where p.id = r.reporter_id),
         case r.target_type
           when 'startup' then (select s.name from public.startups s where s.id = r.target_id)
           when 'launch' then (select l.name from public.launches l where l.id = r.target_id)
           when 'comment' then (select left(c.body, 140) from public.comments c where c.id = r.target_id)
           when 'user' then (select '@' || p.username from public.profiles p where p.id = r.target_id)
           when 'opportunity' then (select o.title from public.opportunities o where o.id = r.target_id)
           when 'investor' then (select i.name from public.investors i where i.id = r.target_id) end,
         case r.target_type
           when 'startup' then (select '/startups/' || s.slug from public.startups s where s.id = r.target_id)
           when 'launch' then (select '/launches/' || l.slug from public.launches l where l.id = r.target_id)
           when 'comment' then (select '/launches/' || l.slug || '#comment-' || c.id from public.comments c join public.launches l on l.id = c.launch_id where c.id = r.target_id)
           when 'user' then (select '/users/' || p.username from public.profiles p where p.id = r.target_id)
           when 'opportunity' then (select '/opportunities/' || o.slug from public.opportunities o where o.id = r.target_id)
           when 'investor' then (select '/investors/' || i.slug from public.investors i where i.id = r.target_id) end,
         case r.target_type
           when 'startup' then (select s.status::text from public.startups s where s.id = r.target_id)
           when 'launch' then (select l.status::text from public.launches l where l.id = r.target_id)
           when 'comment' then (select c.status::text from public.comments c where c.id = r.target_id)
           when 'user' then (select case when p.is_suspended then 'suspended' else 'active' end from public.profiles p where p.id = r.target_id)
           when 'opportunity' then (select o.status::text from public.opportunities o where o.id = r.target_id)
           when 'investor' then (select case when i.is_published then 'published' else 'unpublished' end from public.investors i where i.id = r.target_id) end,
         (select count(*) from public.reports x where x.target_type = r.target_type and x.target_id = r.target_id),
         count(*) over ()
    from public.reports r
   where (p_status = 'active' and r.status in ('open', 'reviewing')) or (p_status <> 'active' and r.status::text = p_status)
   order by r.created_at asc, r.id
   limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0);
end $$;

-- ---------- users ----------
create function public.set_user_suspension(p_user uuid, p_suspended boolean, p_reason text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare v_target public.user_role;
begin
  perform public.assert_staff();
  if p_user = auth.uid() then raise exception 'forbidden' using errcode = '42501'; end if;
  select role into v_target from public.profiles where id = p_user;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if v_target <> 'user' and not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;   -- only admins act on staff
  if p_suspended and coalesce(btrim(p_reason), '') = '' then raise exception 'note_required' using errcode = '23514'; end if;
  update public.profiles set is_suspended = p_suspended, suspended_reason = case when p_suspended then left(p_reason, 300) end,
         suspended_at = case when p_suspended then now() end where id = p_user;
  perform public.create_notification(p_user, 'account', case when p_suspended then 'Your account was suspended' else 'Your account was reinstated' end,
    case when p_suspended then left(p_reason, 300) else 'You can post, vote and comment again.' end, '/dashboard', 'account:' || p_user || ':' || extract(epoch from now())::bigint, null);
  perform public.audit(case when p_suspended then 'user.suspend' else 'user.reinstate' end, 'user', p_user::text, jsonb_build_object('reason', p_reason));
end $$;

create function public.set_user_role(p_user uuid, p_role public.user_role) returns void
language plpgsql security definer set search_path = '' as $$
declare v_old public.user_role;
begin
  perform public.assert_admin();
  if p_user = auth.uid() then raise exception 'forbidden' using errcode = '42501'; end if;   -- nobody changes (or locks out) their own role
  select role into v_old from public.profiles where id = p_user;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  update public.profiles set role = p_role where id = p_user;
  perform public.audit('user.role_change', 'user', p_user::text, jsonb_build_object('from', v_old, 'to', p_role));
end $$;

create function public.admin_search_users(p_query text, p_limit int, p_offset int)
returns table (id uuid, username text, display_name text, email text, role public.user_role, is_suspended boolean, suspended_reason text, created_at timestamptz, total bigint)
language plpgsql stable security definer set search_path = '' as $$
declare v_q text := nullif(lower(btrim(coalesce(p_query, ''))), '');
begin
  perform public.assert_staff();
  return query
  select p.id, p.username::text, p.display_name, case when public.is_admin() then u.email::text end, p.role, p.is_suspended, p.suspended_reason, p.created_at, count(*) over ()
    from public.profiles p join auth.users u on u.id = p.id
   where v_q is null or position(v_q in lower(p.username::text)) > 0 or position(v_q in lower(p.display_name)) > 0
         or (public.is_admin() and position(v_q in lower(u.email::text)) > 0)
   order by p.created_at desc, p.id
   limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0);
end $$;

-- ---------- verification ----------
create function public.review_verification(p_request uuid, p_decision text, p_note text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare v public.verification_requests%rowtype; v_name text;
begin
  perform public.assert_admin();
  select * into v from public.verification_requests where id = p_request for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if v.status <> 'pending' then raise exception 'invalid_state' using errcode = '55000'; end if;
  select name into v_name from public.startups where id = v.startup_id;
  if p_decision = 'approve' then
    update public.verification_requests set status = 'verified', reviewed_by = auth.uid(), reviewed_at = now(), decision_note = left(p_note, 500) where id = p_request;
    update public.startups set verification_status = 'verified', verified_at = now() where id = v.startup_id;
    perform public.notify_startup_managers(v.startup_id, 'verification', v_name || ' is now verified', left(p_note, 300), 'verification:' || p_request);
  elsif p_decision = 'reject' then
    if coalesce(btrim(p_note), '') = '' then raise exception 'note_required' using errcode = '23514'; end if;
    update public.verification_requests set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), decision_note = left(p_note, 500) where id = p_request;
    update public.startups set verification_status = 'rejected' where id = v.startup_id and verification_status <> 'verified';
    perform public.notify_startup_managers(v.startup_id, 'verification', 'Verification for ' || v_name || ' wasn’t approved', left(p_note, 300), 'verification:' || p_request);
  else raise exception 'unknown_action' using errcode = '22023'; end if;
  perform public.audit('verification.' || p_decision, 'startup', v.startup_id::text, jsonb_build_object('request', p_request, 'note', p_note));
end $$;

create function public.revoke_verification(p_startup uuid, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_name text;
begin
  perform public.assert_admin();
  if coalesce(btrim(p_note), '') = '' then raise exception 'note_required' using errcode = '23514'; end if;
  select name into v_name from public.startups where id = p_startup and verification_status = 'verified';
  if not found then raise exception 'invalid_state' using errcode = '55000'; end if;
  update public.startups set verification_status = 'revoked', verified_at = null where id = p_startup;
  perform public.notify_startup_managers(p_startup, 'verification', 'Verification for ' || v_name || ' was withdrawn', left(p_note, 300), 'verification-revoked:' || p_startup || ':' || extract(epoch from now())::bigint);
  perform public.audit('verification.revoke', 'startup', p_startup::text, jsonb_build_object('note', p_note));
end $$;

-- a team owner/admin can withdraw their own pending request
create function public.withdraw_verification_request(p_request uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v public.verification_requests%rowtype;
begin
  select * into v from public.verification_requests where id = p_request for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if auth.uid() is null or coalesce(public.my_member_role(v.startup_id), 'viewer') not in ('owner', 'admin') then raise exception 'forbidden' using errcode = '42501'; end if;
  if v.status <> 'pending' then raise exception 'invalid_state' using errcode = '55000'; end if;
  update public.verification_requests set status = 'rejected', decision_note = 'Withdrawn by the requester', reviewed_at = now() where id = p_request;
  update public.startups set verification_status = 'unverified' where id = v.startup_id and verification_status = 'pending';
  perform public.audit('verification.withdraw', 'startup', v.startup_id::text, jsonb_build_object('request', p_request));
end $$;

-- ---------- settings ----------
create function public.get_platform_settings() returns table (key text, value jsonb, updated_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.assert_admin();
  return query select s.key, s.value, s.updated_at from public.platform_settings s order by s.key;
end $$;

create function public.set_platform_setting(p_key text, p_value jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.assert_admin();
  if p_key not in ('startups_require_review', 'launches_require_review') then raise exception 'unknown_setting' using errcode = '22023'; end if;
  if jsonb_typeof(p_value) <> 'boolean' then raise exception 'invalid_value' using errcode = '22023'; end if;
  insert into public.platform_settings (key, value, updated_by, updated_at) values (p_key, p_value, auth.uid(), now())
  on conflict (key) do update set value = excluded.value, updated_by = excluded.updated_by, updated_at = now();
  perform public.audit('settings.change', 'setting', p_key, jsonb_build_object('value', p_value));
end $$;

-- ---------- overview ----------
create function public.admin_overview() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.assert_staff();
  return jsonb_build_object(
    'users', (select count(*) from public.profiles),
    'users_suspended', (select count(*) from public.profiles where is_suspended),
    'startups_published', (select count(*) from public.startups where status = 'published'),
    'startups_pending', (select count(*) from public.startups where status = 'pending_review'),
    'launches_pending', (select count(*) from public.launches where status = 'pending_review'),
    'verifications_pending', (select count(*) from public.verification_requests where status = 'pending'),
    'reports_open', (select count(*) from public.reports where status in ('open', 'reviewing')),
    'messages_new', (select count(*) from public.platform_messages where status = 'new'),
    'opportunities_stale', (select count(*) from public.opportunities where status = 'published' and (last_checked_at is null or last_checked_at < now() - interval '30 days'))
  );
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'moderate_startup(uuid, text, text)', 'moderate_comment(uuid, text, text)', 'resolve_report(uuid, public.report_status, text)',
    'admin_list_reports(text, int, int)', 'set_user_suspension(uuid, boolean, text)', 'set_user_role(uuid, public.user_role)',
    'admin_search_users(text, int, int)', 'review_verification(uuid, text, text)', 'revoke_verification(uuid, text)',
    'withdraw_verification_request(uuid)', 'get_platform_settings()', 'set_platform_setting(text, jsonb)', 'admin_overview()'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- evidence for reviewers: staff may read verification documents (policy already allows it); keep requests readable by staff only through RLS.
create index if not exists verification_requests_startup_idx on public.verification_requests (startup_id, created_at desc);
create index if not exists reports_target_status_idx on public.reports (target_type, target_id, status);

-- Buna 0010 — opportunities, founder discovery, inquiries, team invitations, contact inbox,
-- terms acceptance, account deletion.

-- ---------- profiles: connection preferences + terms acceptance ----------
alter table public.profiles
  add column open_to text[] not null default '{}',
  add column terms_accepted_at timestamptz,
  add column terms_version text,
  add constraint profiles_open_to_chk check (open_to <@ array['cofounding', 'mentoring', 'hiring', 'investing', 'partnerships', 'advice']::text[]);
grant update (open_to) on public.profiles to authenticated;

-- terms acceptance is recorded by the signup trigger from the signup metadata (never client-writable afterwards)
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_username text;
  v_try int := 0;
begin
  loop
    v_username := 'user-' || substr(md5(random()::text || clock_timestamp()::text || new.id::text), 1, 10);
    exit when v_try >= 5 or not exists (select 1 from public.profiles p where p.username = v_username);
    v_try := v_try + 1;
  end loop;

  insert into public.profiles (id, username, display_name, terms_accepted_at, terms_version)
  values (new.id, v_username, left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 80),
          case when coalesce(new.raw_user_meta_data ->> 'terms_version', '') <> '' then now() end,
          nullif(left(new.raw_user_meta_data ->> 'terms_version', 40), ''));
  insert into public.notification_preferences (user_id) values (new.id);
  return new;
end $$;

-- founder directory exposes connection preferences only for discoverable, public founders
create or replace view public.public_profiles as
select
  p.id, p.username, p.display_name, p.avatar_url,
  case when p.is_public_profile then p.headline end as headline,
  case when p.is_public_profile then p.bio end as bio,
  case when p.is_public_profile and p.show_location then p.country end as country,
  case when p.is_public_profile and p.show_location then p.city end as city,
  case when p.is_public_profile then p.website_url end as website_url,
  case when p.is_public_profile then p.expertise else '{}'::text[] end as expertise,
  case when p.is_public_profile then p.interests else '{}'::text[] end as interests,
  (p.is_public_profile and p.is_discoverable_founder) as is_discoverable_founder,
  p.is_public_profile,
  case when p.is_public_profile and p.is_discoverable_founder then p.open_to else '{}'::text[] end as open_to
from public.profiles p
where not p.is_suspended;

-- ---------- demo flags ----------
alter table public.opportunities add column is_demo boolean not null default false;
alter table public.investors add column is_demo boolean not null default false;

-- ---------- notifications: add the deadline preference ----------
create or replace function public.create_notification(p_user uuid, p_type text, p_title text, p_body text, p_url text, p_dedupe text, p_pref text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_email boolean := false;
begin
  if p_user is null then return; end if;
  select case p_pref
           when 'comments' then np.email_comments
           when 'replies' then np.email_replies
           when 'inquiries' then np.email_inquiries
           when 'moderation' then np.email_moderation
           when 'deadlines' then np.email_opportunity_deadlines
           else false end
    into v_email from public.notification_preferences np where np.user_id = p_user;
  insert into public.notifications (user_id, type, title, body, url, dedupe_key, email_status)
  values (p_user, p_type, p_title, p_body, p_url, p_dedupe, case when coalesce(v_email, false) then 'pending'::public.email_delivery_status end)
  on conflict (user_id, dedupe_key) do nothing;
end $$;

-- Saved opportunities closing within 3 days → one reminder per person per opportunity (in-app; email only if opted in).
create function public.queue_deadline_reminders() returns int
language plpgsql security definer set search_path = '' as $$
declare r record; v_count int := 0;
begin
  for r in
    select so.user_id, o.id, o.slug, o.title, o.deadline
      from public.saved_opportunities so join public.opportunities o on o.id = so.opportunity_id
     where o.status = 'published' and o.deadline > now() and o.deadline <= now() + interval '3 days'
  loop
    perform public.create_notification(r.user_id, 'deadline', r.title || ' closes soon',
      'Deadline: ' || to_char(r.deadline at time zone 'utc', 'DD Mon YYYY HH24:MI') || ' UTC',
      '/opportunities/' || r.slug, 'deadline:' || r.id, 'deadlines');
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;
revoke all on function public.queue_deadline_reminders() from public, anon, authenticated;
grant execute on function public.queue_deadline_reminders() to service_role;

-- ---------- inquiries ----------
-- Created only by the server (validated + rate limited) through this function; de-duplicated; team notified in-app.
create function public.create_inquiry(
  p_startup uuid, p_sender uuid, p_name text, p_email text, p_category text, p_subject text, p_message text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_slug text; v_name text; r record;
begin
  select s.slug, s.name into v_slug, v_name from public.startups s where s.id = p_startup and s.status = 'published';
  if not found then raise exception 'startup_unavailable' using errcode = 'P0002'; end if;

  select i.id into v_id from public.inquiries i
   where i.startup_id = p_startup and lower(i.sender_email) = lower(p_email) and md5(i.message) = md5(p_message)
     and i.created_at > now() - interval '24 hours' limit 1;
  if v_id is not null then return v_id; end if;   -- a retried/double-clicked submission

  insert into public.inquiries (startup_id, sender_id, sender_name, sender_email, category, subject, message)
  values (p_startup, p_sender, p_name, lower(p_email), p_category, p_subject, p_message) returning id into v_id;

  for r in select m.user_id from public.startup_members m where m.startup_id = p_startup and m.role in ('owner', 'admin', 'editor') loop
    perform public.create_notification(r.user_id, 'inquiry', 'New inquiry for ' || v_name || ': ' || left(p_subject, 80),
      'From ' || left(p_name, 80), '/dashboard/inquiries/' || v_id, 'inquiry:' || v_id, null);
  end loop;
  return v_id;
end $$;
revoke all on function public.create_inquiry(uuid, uuid, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.create_inquiry(uuid, uuid, text, text, text, text, text) to service_role;

-- Who should receive the email for an inquiry: owners/admins/editors who have inquiry emails on.
create function public.inquiry_recipients(p_inquiry uuid) returns table (user_id uuid, email text)
language sql stable security definer set search_path = '' as $$
  select m.user_id, u.email::text
    from public.inquiries i
    join public.startup_members m on m.startup_id = i.startup_id and m.role in ('owner', 'admin', 'editor')
    join public.notification_preferences np on np.user_id = m.user_id and np.email_inquiries
    join auth.users u on u.id = m.user_id
   where i.id = p_inquiry and u.email is not null
$$;

create function public.mark_inquiry_email(p_id uuid, p_status public.email_delivery_status, p_error text default null) returns void
language sql security definer set search_path = '' as $$
  update public.inquiries set email_status = p_status, email_error = left(p_error, 300), email_attempts = email_attempts + 1 where id = p_id
$$;

create function public.pending_inquiry_emails(p_limit int) returns table (id uuid)
language sql stable security definer set search_path = '' as $$
  select i.id from public.inquiries i
   where i.email_status in ('pending', 'failed') and i.email_attempts < 5 and i.created_at > now() - interval '7 days'
   order by i.created_at limit greatest(p_limit, 1)
$$;
revoke all on function public.inquiry_recipients(uuid) from public, anon, authenticated;
revoke all on function public.mark_inquiry_email(uuid, public.email_delivery_status, text) from public, anon, authenticated;
revoke all on function public.pending_inquiry_emails(int) from public, anon, authenticated;
grant execute on function public.inquiry_recipients(uuid) to service_role;
grant execute on function public.mark_inquiry_email(uuid, public.email_delivery_status, text) to service_role;
grant execute on function public.pending_inquiry_emails(int) to service_role;

-- ---------- team: self-service visibility, invitations, role changes ----------
grant update (is_public, public_title) on public.startup_members to authenticated;
create policy members_update_self on public.startup_members for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_active_user());

-- A startup can never be left without an owner (except when its last member deletes their account:
-- prepare_account_deletion sets a transaction-local flag for that one case).
create function public.startup_members_owner_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if current_setting('buna.account_deletion', true) = 'on' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if old.role = 'owner' and (tg_op = 'DELETE' or new.role <> 'owner')
     and exists (select 1 from public.startups s where s.id = old.startup_id)
     and not exists (select 1 from public.startup_members m where m.startup_id = old.startup_id and m.role = 'owner' and m.user_id <> old.user_id) then
    raise exception 'last_owner' using errcode = '23514';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
create trigger startup_members_owner_guard_trg before update of role or delete on public.startup_members
  for each row execute function public.startup_members_owner_guard();

create function public.my_member_role(p_startup uuid) returns public.member_role
language sql stable security definer set search_path = '' as $$
  select m.role from public.startup_members m where m.startup_id = p_startup and m.user_id = auth.uid()
$$;

create function public.create_team_invitation(p_startup uuid, p_email text, p_role public.member_role, p_token_hash text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_actor public.member_role; v_id uuid; v_email text := lower(btrim(p_email));
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if not public.is_active_user() then raise exception 'account_suspended' using errcode = '42501'; end if;
  v_actor := public.my_member_role(p_startup);
  if v_actor is null or not (
       (v_actor = 'owner' and p_role in ('admin', 'editor', 'viewer')) or (v_actor = 'admin' and p_role in ('editor', 'viewer'))) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'invalid_email' using errcode = '22023'; end if;
  if exists (select 1 from public.startup_members m join auth.users u on u.id = m.user_id where m.startup_id = p_startup and lower(u.email) = v_email) then
    raise exception 'already_member' using errcode = '23505';
  end if;
  update public.team_invitations set status = 'expired' where startup_id = p_startup and email = v_email and status = 'pending' and expires_at < now();
  insert into public.team_invitations (startup_id, email, role, token_hash, invited_by) values (p_startup, v_email, p_role, p_token_hash, auth.uid()) returning id into v_id;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'team.invite', 'startup', p_startup::text, jsonb_build_object('role', p_role, 'invitation', v_id));
  return v_id;
end $$;

create function public.revoke_team_invitation(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_startup uuid;
begin
  select startup_id into v_startup from public.team_invitations where id = p_id and status = 'pending';
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if auth.uid() is null or coalesce(public.my_member_role(v_startup), 'viewer') not in ('owner', 'admin') then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.team_invitations set status = 'revoked' where id = p_id;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata) values (auth.uid(), 'team.revoke_invite', 'startup', v_startup::text, jsonb_build_object('invitation', p_id));
end $$;

-- Safe preview for the invitation landing page (callable before sign-in): no email address, no ids.
create function public.get_invitation_preview(p_token_hash text)
returns table (startup_name text, startup_slug text, role public.member_role, status public.invitation_status, expired boolean, email_hint text)
language sql stable security definer set search_path = '' as $$
  select s.name, s.slug, i.role, i.status, (i.expires_at < now()), left(i.email::text, 1) || '***@' || split_part(i.email::text, '@', 2)
    from public.team_invitations i join public.startups s on s.id = i.startup_id where i.token_hash = p_token_hash
$$;

create function public.accept_team_invitation(p_token_hash text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v public.team_invitations%rowtype; v_email text; v_name text;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if not public.is_active_user() then raise exception 'account_suspended' using errcode = '42501'; end if;
  if not public.has_verified_email() then raise exception 'email_not_verified' using errcode = '42501'; end if;
  select * into v from public.team_invitations where token_hash = p_token_hash for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if v.status <> 'pending' then raise exception 'invitation_used' using errcode = '55000'; end if;
  if v.expires_at < now() then
    update public.team_invitations set status = 'expired' where id = v.id;
    raise exception 'invitation_expired' using errcode = '55000';
  end if;
  select lower(u.email) into v_email from auth.users u where u.id = auth.uid();
  if v_email is distinct from lower(v.email::text) then raise exception 'email_mismatch' using errcode = '42501'; end if;

  insert into public.startup_members (startup_id, user_id, role, is_public) values (v.startup_id, auth.uid(), v.role, false) on conflict do nothing;
  update public.team_invitations set status = 'accepted', accepted_by = auth.uid() where id = v.id;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata) values (auth.uid(), 'team.accept_invite', 'startup', v.startup_id::text, jsonb_build_object('role', v.role));
  select coalesce(nullif(p.display_name, ''), '@' || p.username) into v_name from public.profiles p where p.id = auth.uid();
  perform public.create_notification(v.invited_by, 'team', coalesce(v_name, 'Someone') || ' joined your team', null,
    '/dashboard/startup/' || v.startup_id || '/team', 'team:' || v.id, null);
  return v.startup_id;
end $$;

create function public.change_member_role(p_startup uuid, p_user uuid, p_role public.member_role) returns void
language plpgsql security definer set search_path = '' as $$
declare v_actor public.member_role; v_target public.member_role;
begin
  if auth.uid() is null or not public.is_active_user() then raise exception 'forbidden' using errcode = '42501'; end if;
  v_actor := public.my_member_role(p_startup);
  select m.role into v_target from public.startup_members m where m.startup_id = p_startup and m.user_id = p_user;
  if v_actor is null or v_target is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if p_user = auth.uid() then raise exception 'forbidden' using errcode = '42501'; end if;   -- no changing your own role
  if not (
       v_actor = 'owner'
       or (v_actor = 'admin' and v_target in ('editor', 'viewer') and p_role in ('editor', 'viewer'))) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.startup_members set role = p_role where startup_id = p_startup and user_id = p_user;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'team.change_role', 'startup', p_startup::text, jsonb_build_object('user', p_user, 'from', v_target, 'to', p_role));
end $$;

create function public.remove_member(p_startup uuid, p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_actor public.member_role; v_target public.member_role;
begin
  if auth.uid() is null then raise exception 'forbidden' using errcode = '42501'; end if;
  v_actor := public.my_member_role(p_startup);
  select m.role into v_target from public.startup_members m where m.startup_id = p_startup and m.user_id = p_user;
  if v_actor is null or v_target is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if not (
       p_user = auth.uid()                                         -- leaving is always allowed (owner guard still applies)
       or v_actor = 'owner'
       or (v_actor = 'admin' and v_target in ('editor', 'viewer'))) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from public.startup_members where startup_id = p_startup and user_id = p_user;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'team.remove', 'startup', p_startup::text, jsonb_build_object('user', p_user, 'role', v_target));
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'create_team_invitation(uuid, text, public.member_role, text)', 'revoke_team_invitation(uuid)',
    'accept_team_invitation(text)', 'change_member_role(uuid, uuid, public.member_role)', 'remove_member(uuid, uuid)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
revoke all on function public.get_invitation_preview(text) from public;
grant execute on function public.get_invitation_preview(text) to anon, authenticated;
revoke all on function public.my_member_role(uuid) from public, anon;
grant execute on function public.my_member_role(uuid) to authenticated;

-- ---------- contact inbox (messages to the Buna team) ----------
create table public.platform_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid references public.profiles (id) on delete set null,
  sender_name text not null,
  sender_email text not null,
  topic text not null default 'general',
  message text not null,
  status text not null default 'new',
  handled_by uuid references public.profiles (id) on delete set null,
  handled_at timestamptz,
  email_status public.email_delivery_status not null default 'pending',
  created_at timestamptz not null default now(),
  constraint platform_messages_name_len check (char_length(sender_name) between 1 and 100),
  constraint platform_messages_email_fmt check (sender_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  constraint platform_messages_topic_chk check (topic in ('general', 'support', 'report', 'partnership', 'press', 'privacy')),
  constraint platform_messages_message_len check (char_length(message) between 10 and 4000),
  constraint platform_messages_status_chk check (status in ('new', 'handled', 'spam'))
);
create index platform_messages_status_idx on public.platform_messages (status, created_at desc);
alter table public.platform_messages enable row level security;
grant select on public.platform_messages to authenticated;
grant update (status, handled_by, handled_at) on public.platform_messages to authenticated;
create policy platform_messages_staff_select on public.platform_messages for select to authenticated using (public.is_staff());
create policy platform_messages_staff_update on public.platform_messages for update to authenticated using (public.is_staff()) with check (public.is_staff());

create function public.create_platform_message(p_sender uuid, p_name text, p_email text, p_topic text, p_message text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  select id into v_id from public.platform_messages
   where lower(sender_email) = lower(p_email) and md5(message) = md5(p_message) and created_at > now() - interval '24 hours' limit 1;
  if v_id is not null then return v_id; end if;
  insert into public.platform_messages (sender_id, sender_name, sender_email, topic, message) values (p_sender, p_name, lower(p_email), p_topic, p_message) returning id into v_id;
  return v_id;
end $$;
revoke all on function public.create_platform_message(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.create_platform_message(uuid, text, text, text, text) to service_role;

-- ---------- account deletion ----------
-- Step 1 (service role): detach and anonymise everything that must outlive the account, or report blockers.
-- Step 2 (app, service role): delete the auth user, which cascades the profile, votes, follows and notifications.
-- Companies are never deleted with a person: a startup with other members keeps them (ownership must be
-- transferred first); a startup the person alone ran is unpublished and kept, unowned, for staff to review.
create function public.prepare_account_deletion(p_user uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_blockers jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name)), '[]'::jsonb) into v_blockers
    from public.startup_members m join public.startups s on s.id = m.startup_id
   where m.user_id = p_user and m.role = 'owner'
     and not exists (select 1 from public.startup_members o where o.startup_id = m.startup_id and o.role = 'owner' and o.user_id <> p_user)
     and exists (select 1 from public.startup_members x where x.startup_id = m.startup_id and x.user_id <> p_user);
  if jsonb_array_length(v_blockers) > 0 then
    return jsonb_build_object('blocked', true, 'startups', v_blockers);
  end if;

  perform set_config('buna.account_deletion', 'on', true);
  update public.startups s set status = case when s.status in ('published', 'pending_review') then 'unpublished' else s.status end, created_by = null
   where s.id in (select m.startup_id from public.startup_members m where m.user_id = p_user and m.role = 'owner'
                  and not exists (select 1 from public.startup_members x where x.startup_id = m.startup_id and x.user_id <> p_user));
  delete from public.startup_members where user_id = p_user;
  update public.startups set created_by = null where created_by = p_user;

  update public.comments set status = 'deleted' where author_id = p_user and status <> 'deleted';
  update public.launches set status = 'removed', moderation_note = 'Removed with its maker''s account.', submitted_by = null where submitted_by = p_user and startup_id is null;
  update public.launches set submitted_by = null where submitted_by = p_user;
  update public.inquiries set sender_id = null, sender_name = 'Deleted user', sender_email = 'deleted@invalid.example' where sender_id = p_user;
  update public.platform_messages set sender_id = null, sender_name = 'Deleted user', sender_email = 'deleted@invalid.example' where sender_id = p_user;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id) values (null, 'account.delete', 'user', p_user::text);
  return jsonb_build_object('blocked', false);
end $$;
revoke all on function public.prepare_account_deletion(uuid) from public, anon, authenticated;
grant execute on function public.prepare_account_deletion(uuid) to service_role;

-- Retried inquiry emails are looked up by the app; keep delivery columns private to the team views.
revoke select on public.inquiries from authenticated;
grant select (id, startup_id, sender_id, sender_name, sender_email, category, subject, message, status, read_at, email_status, created_at) on public.inquiries to authenticated;

-- ---------- opportunity listing ----------
-- "Open" means published and not past its deadline; "closed" covers expired and past-deadline listings, so an expired
-- opportunity can never be presented as open even if the nightly expiry job hasn't run yet.
-- SECURITY INVOKER: row-level security still decides what the caller may see.
create function public.list_opportunities(
  p_when text, p_category text, p_country text, p_query text, p_sort text, p_limit int, p_offset int
) returns table (id uuid, total bigint)
language plpgsql stable set search_path = '' as $$
declare v_q text := nullif(btrim(coalesce(p_query, '')), '');
begin
  return query
  select o.id, count(*) over ()
    from public.opportunities o
   where (
          (p_when = 'open' and o.status = 'published' and (o.deadline is null or o.deadline > now()))
       or (p_when = 'soon' and o.status = 'published' and o.deadline > now() and o.deadline <= now() + interval '14 days')
       or (p_when = 'rolling' and o.status = 'published' and o.deadline is null)
       or (p_when = 'closed' and (o.status = 'expired' or (o.status = 'published' and o.deadline <= now())))
       or (p_when = 'all' and o.status in ('published', 'expired'))
         )
     and (p_category is null or o.category::text = p_category)
     and (p_country is null or cardinality(o.countries) = 0 or p_country = any (o.countries))
     and (v_q is null or o.search @@ websearch_to_tsquery('english', v_q) or position(lower(v_q) in lower(o.title)) > 0
          or position(lower(v_q) in lower(o.organization)) > 0)
   order by
     case when p_sort = 'deadline' and p_when in ('open', 'soon') then o.deadline end asc nulls last,
     o.published_date desc nulls last, o.created_at desc, o.id
   limit least(greatest(p_limit, 1), 50) offset greatest(p_offset, 0);
end $$;
revoke all on function public.list_opportunities(text, text, text, text, text, int, int) from public;
grant execute on function public.list_opportunities(text, text, text, text, text, int, int) to anon, authenticated, service_role;

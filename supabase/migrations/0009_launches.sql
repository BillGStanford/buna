-- Buna 0009 — launches & community: media, moderation, scheduling, trending/listing, threaded comments,
-- follower counts, and the notification outbox (in-app + email).

-- ---------- helpers ----------
create function public.can_edit_launch(p_launch_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.launches l
     where l.id = p_launch_id
       and (l.submitted_by = auth.uid() or (l.startup_id is not null and public.can_edit_startup(l.startup_id)))
  )
$$;

create function public.launch_is_visible(p_launch_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.launches l where l.id = p_launch_id and l.status in ('published', 'scheduled'))
$$;

-- Parses the first path segment of a storage object name as a uuid (null on junk).
create function public.storage_folder_uuid(p_name text) returns uuid
language plpgsql immutable set search_path = '' as $$
declare v text := (storage.foldername(p_name))[1];
begin
  if v ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return v::uuid; end if;
  return null;
end $$;

-- demo launches (local/preview data only) are flagged so they can be labelled, hidden from the sitemap and removed
alter table public.launches add column is_demo boolean not null default false;

-- ---------- scheduled launches are public ("upcoming"); drafts, pending and rejected are not ----------
drop policy launches_select_public on public.launches;
create policy launches_select_public on public.launches for select to anon, authenticated
  using (status in ('published', 'scheduled'));

-- ---------- launch screenshots ----------
create table public.launch_media (
  id uuid primary key default gen_random_uuid(),
  launch_id uuid not null references public.launches (id) on delete cascade,
  storage_path text not null,
  url text not null,
  alt_text text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  constraint launch_media_alt_len check (alt_text is null or char_length(alt_text) <= 200)
);
create index launch_media_launch_idx on public.launch_media (launch_id, sort_order);
alter table public.launch_media enable row level security;
grant select on public.launch_media to anon, authenticated;
grant insert, update, delete on public.launch_media to authenticated;
create policy launch_media_select on public.launch_media for select to anon, authenticated
  using (public.launch_is_visible(launch_id) or public.can_edit_launch(launch_id) or public.is_staff());
create policy launch_media_insert on public.launch_media for insert to authenticated
  with check (public.can_edit_launch(launch_id) and public.is_active_user());
create policy launch_media_update on public.launch_media for update to authenticated
  using (public.can_edit_launch(launch_id)) with check (public.can_edit_launch(launch_id) and public.is_active_user());
create policy launch_media_delete on public.launch_media for delete to authenticated
  using (public.can_edit_launch(launch_id));

create function public.enforce_launch_media_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and not public.can_edit_launch(new.launch_id) then return new; end if;
  if (select count(*) from public.launch_media where launch_id = new.launch_id) >= 6 then
    raise exception 'limit_reached' using errcode = '54000';
  end if;
  return new;
end $$;
create trigger launch_media_limit before insert on public.launch_media
  for each row execute function public.enforce_launch_media_limit();

-- storage bucket: path {launch_id}/{file}
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('launch-media', 'launch-media', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
create policy launch_media_obj_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'launch-media' and public.is_active_user() and public.can_edit_launch(public.storage_folder_uuid(name)));
create policy launch_media_obj_update on storage.objects for update to authenticated
  using (bucket_id = 'launch-media' and public.can_edit_launch(public.storage_folder_uuid(name)));
create policy launch_media_obj_delete on storage.objects for delete to authenticated
  using (bucket_id = 'launch-media' and public.can_edit_launch(public.storage_folder_uuid(name)));

-- ---------- comments: replies are one level deep and stay inside the thread ----------
create or replace function public.comments_parent_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_launch uuid; v_grand uuid;
begin
  if new.parent_id is not null then
    select c.launch_id, c.parent_id into v_launch, v_grand from public.comments c where c.id = new.parent_id;
    if not found or v_launch <> new.launch_id or v_grand is not null then
      raise exception 'invalid_parent_comment' using errcode = '23514';
    end if;
  end if;
  return new;
end $$;

-- ---------- notifications: outbox for in-app rows and email ----------
alter table public.notifications
  add column email_status public.email_delivery_status,   -- null: no email wanted
  add column email_error text,
  add column email_attempts int not null default 0,
  add column emailed_at timestamptz;
create index notifications_email_idx on public.notifications (created_at) where email_status in ('pending', 'failed');

-- clients read their own rows but never the delivery internals
revoke select on public.notifications from authenticated;
grant select (id, user_id, type, title, body, url, data, read_at, created_at) on public.notifications to authenticated;

-- Internal: inserts an in-app notification (idempotent via dedupe key) and queues an email if the user's preference allows.
create function public.create_notification(p_user uuid, p_type text, p_title text, p_body text, p_url text, p_dedupe text, p_pref text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_email boolean := false;
begin
  if p_user is null then return; end if;
  select case p_pref
           when 'comments' then np.email_comments
           when 'replies' then np.email_replies
           when 'inquiries' then np.email_inquiries
           when 'moderation' then np.email_moderation
           else false end
    into v_email from public.notification_preferences np where np.user_id = p_user;
  insert into public.notifications (user_id, type, title, body, url, dedupe_key, email_status)
  values (p_user, p_type, p_title, p_body, p_url, p_dedupe, case when coalesce(v_email, false) then 'pending'::public.email_delivery_status end)
  on conflict (user_id, dedupe_key) do nothing;
end $$;
revoke all on function public.create_notification(uuid, text, text, text, text, text, text) from public, anon, authenticated;

-- Email dispatcher API (service role only): claim a batch, then report the outcome.
create function public.claim_notification_emails(p_limit int)
returns table (id uuid, email text, title text, body text, url text, attempts int)
language plpgsql security definer set search_path = '' as $$
begin
  return query
  with picked as (
    select n.id from public.notifications n
     where n.email_status in ('pending', 'failed') and n.email_attempts < 5
     order by n.created_at limit greatest(p_limit, 1) for update skip locked
  ), upd as (
    update public.notifications n set email_attempts = n.email_attempts + 1
      from picked where n.id = picked.id
    returning n.id, n.user_id, n.title, n.body, n.url, n.email_attempts
  )
  select upd.id, u.email::text, upd.title, upd.body, upd.url, upd.email_attempts
    from upd join auth.users u on u.id = upd.user_id;
end $$;

create function public.finish_notification_email(p_id uuid, p_status public.email_delivery_status, p_error text default null)
returns void language sql security definer set search_path = '' as $$
  update public.notifications
     set email_status = p_status, email_error = left(p_error, 300),
         emailed_at = case when p_status = 'sent' then now() else emailed_at end
   where id = p_id
$$;
revoke all on function public.claim_notification_emails(int) from public, anon, authenticated;
revoke all on function public.finish_notification_email(uuid, public.email_delivery_status, text) from public, anon, authenticated;
grant execute on function public.claim_notification_emails(int) to service_role;
grant execute on function public.finish_notification_email(uuid, public.email_delivery_status, text) to service_role;

-- New comment → notify the launch owner and, for replies, the parent author (never the author themself).
create function public.comments_notify() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_launch record;
  v_parent_author uuid;
  v_who text;
begin
  select l.slug, l.name, l.submitted_by into v_launch from public.launches l where l.id = new.launch_id;
  select coalesce(nullif(p.display_name, ''), '@' || p.username) into v_who from public.profiles p where p.id = new.author_id;
  if new.parent_id is not null then
    select c.author_id into v_parent_author from public.comments c where c.id = new.parent_id;
    if v_parent_author is not null and v_parent_author is distinct from new.author_id then
      perform public.create_notification(v_parent_author, 'reply', coalesce(v_who, 'Someone') || ' replied to your comment on ' || v_launch.name,
        left(new.body, 140), '/launches/' || v_launch.slug || '#comment-' || new.id, 'comment:' || new.id, 'replies');
    end if;
  end if;
  if v_launch.submitted_by is not null and v_launch.submitted_by is distinct from new.author_id
     and v_launch.submitted_by is distinct from v_parent_author then
    perform public.create_notification(v_launch.submitted_by, 'comment', coalesce(v_who, 'Someone') || ' commented on ' || v_launch.name,
      left(new.body, 140), '/launches/' || v_launch.slug || '#comment-' || new.id, 'comment:' || new.id, 'comments');
  end if;
  return new;
end $$;
create trigger comments_notify_trg after insert on public.comments
  for each row execute function public.comments_notify();

-- ---------- submit for review ----------
create function public.submit_launch(p_launch_id uuid) returns public.launch_status
language plpgsql security definer set search_path = '' as $$
declare
  v public.launches%rowtype;
  v_review boolean;
  v_new public.launch_status;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if not public.is_active_user() then raise exception 'account_suspended' using errcode = '42501'; end if;
  select * into v from public.launches where id = p_launch_id for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if not public.can_edit_launch(p_launch_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  if v.status not in ('draft', 'rejected') then raise exception 'invalid_state' using errcode = '55000'; end if;
  if not public.has_verified_email() then raise exception 'email_not_verified' using errcode = '42501'; end if;
  if v.category_id is null or coalesce(btrim(v.description), '') = '' then
    raise exception 'launch_incomplete' using errcode = '23514';
  end if;

  select coalesce((s.value #>> '{}')::boolean, true) into v_review from public.platform_settings s where s.key = 'launches_require_review';
  v_new := case
    when coalesce(v_review, true) then 'pending_review'
    when v.launch_date is not null and v.launch_date > current_date then 'scheduled'
    else 'published' end;

  update public.launches
     set status = v_new, moderation_note = null,
         published_at = case when v_new = 'published' then coalesce(published_at, now()) else published_at end
   where id = p_launch_id;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'launch.submit', 'launch', p_launch_id::text, jsonb_build_object('resulting_status', v_new));
  return v_new;
end $$;
revoke all on function public.submit_launch(uuid) from public, anon;
grant execute on function public.submit_launch(uuid) to authenticated;

-- ---------- moderation (staff only) ----------
create function public.moderate_launch(p_launch_id uuid, p_action text, p_note text default null)
returns public.launch_status language plpgsql security definer set search_path = '' as $$
declare
  v public.launches%rowtype;
  v_new public.launch_status;
begin
  if auth.uid() is null or not public.is_staff() then raise exception 'forbidden' using errcode = '42501'; end if;
  if not public.is_active_user() then raise exception 'account_suspended' using errcode = '42501'; end if;
  select * into v from public.launches where id = p_launch_id for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  v_new := v.status;

  if p_action = 'approve' then
    if v.status <> 'pending_review' then raise exception 'invalid_state' using errcode = '55000'; end if;
    v_new := case when v.launch_date is not null and v.launch_date > current_date then 'scheduled' else 'published' end;
    update public.launches set status = v_new, moderation_note = null,
           published_at = case when v_new = 'published' then coalesce(published_at, now()) else published_at end
     where id = p_launch_id;
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
  else
    raise exception 'unknown_action' using errcode = '22023';
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'launch.' || p_action, 'launch', p_launch_id::text, jsonb_build_object('note', p_note, 'resulting_status', v_new));
  return v_new;
end $$;
revoke all on function public.moderate_launch(uuid, text, text) from public, anon;
grant execute on function public.moderate_launch(uuid, text, text) to authenticated;

-- Scheduled launches go live on their date. Run daily (cron route in the app).
create function public.publish_due_launches() returns int
language plpgsql security definer set search_path = '' as $$
declare v_count int := 0; r record;
begin
  for r in
    update public.launches set status = 'published', published_at = now()
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

-- ---------- listing and trending ----------
-- Trending score = Σ over votes of 0.5^(age_in_hours / 24): a vote loses half its weight every 24 hours,
-- so a launch needs a steady stream of votes to stay on top. Ties break on lifetime votes, then recency.
-- SECURITY DEFINER because individual votes are private; only ids, a score and a total are returned.
create function public.list_launches(
  p_sort text, p_category uuid, p_tag text, p_query text, p_since timestamptz, p_limit int, p_offset int
) returns table (id uuid, score double precision, total bigint)
language plpgsql stable security definer set search_path = '' as $$
declare v_q text := nullif(btrim(coalesce(p_query, '')), '');
begin
  if p_sort = 'upcoming' then
    return query
      select l.id, 0::double precision, count(*) over ()
        from public.launches l
       where l.status = 'scheduled'
         and (p_category is null or l.category_id = p_category)
         and (p_tag is null or p_tag = any (l.tags))
         and (v_q is null or l.search @@ websearch_to_tsquery('english', v_q) or position(lower(v_q) in lower(l.name)) > 0)
       order by l.launch_date asc, l.id
       limit least(greatest(p_limit, 1), 50) offset greatest(p_offset, 0);
  elsif p_sort = 'trending' then
    return query
      select l.id, coalesce(sum(power(0.5::double precision, extract(epoch from (now() - v.created_at)) / 3600.0 / 24.0)), 0)::double precision as score,
             count(*) over ()
        from public.launches l
        left join public.launch_votes v on v.launch_id = l.id
       where l.status = 'published'
         and (p_category is null or l.category_id = p_category)
         and (p_tag is null or p_tag = any (l.tags))
         and (p_since is null or l.published_at >= p_since)
         and (v_q is null or l.search @@ websearch_to_tsquery('english', v_q) or position(lower(v_q) in lower(l.name)) > 0)
       group by l.id
       order by score desc, l.vote_count desc, l.published_at desc nulls last, l.id
       limit least(greatest(p_limit, 1), 50) offset greatest(p_offset, 0);
  else
    return query
      select l.id, 0::double precision, count(*) over ()
        from public.launches l
       where l.status = 'published'
         and (p_sort <> 'featured' or l.is_featured)
         and (p_category is null or l.category_id = p_category)
         and (p_tag is null or p_tag = any (l.tags))
         and (p_since is null or l.published_at >= p_since)
         and (v_q is null or l.search @@ websearch_to_tsquery('english', v_q) or position(lower(v_q) in lower(l.name)) > 0)
       order by
         case when p_sort = 'top' then l.vote_count end desc nulls last,
         l.published_at desc nulls last, l.id
       limit least(greatest(p_limit, 1), 50) offset greatest(p_offset, 0);
  end if;
end $$;
revoke all on function public.list_launches(text, uuid, text, text, timestamptz, int, int) from public;
grant execute on function public.list_launches(text, uuid, text, text, timestamptz, int, int) to anon, authenticated, service_role;

-- ---------- comment threads (includes placeholders for removed comments that still have visible replies) ----------
create function public.get_launch_comments(p_launch_id uuid)
returns table (id uuid, parent_id uuid, body text, status public.comment_status, author_id uuid,
               username text, display_name text, avatar_url text, created_at timestamptz, edited_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select c.id, c.parent_id,
         case when c.status = 'visible' then c.body end,
         c.status,
         case when c.status = 'visible' then c.author_id end,
         case when c.status = 'visible' then p.username::text end,
         case when c.status = 'visible' then p.display_name end,
         case when c.status = 'visible' then p.avatar_url end,
         c.created_at, c.edited_at
    from public.comments c
    left join public.profiles p on p.id = c.author_id
   where c.launch_id = p_launch_id
     and (public.launch_is_visible(p_launch_id) or public.can_edit_launch(p_launch_id) or public.is_staff())
     and (c.status = 'visible'
          or exists (select 1 from public.comments r where r.parent_id = c.id and r.status = 'visible'))
   order by c.created_at, c.id
$$;
revoke all on function public.get_launch_comments(uuid) from public;
grant execute on function public.get_launch_comments(uuid) to anon, authenticated, service_role;

-- ---------- follower counts (counts only; who follows whom stays private) ----------
create function public.follower_count(p_type text, p_id uuid) returns bigint
language sql stable security definer set search_path = '' as $$
  select count(*) from public.follows f where f.target_type = p_type and f.target_id = p_id
$$;
revoke all on function public.follower_count(text, uuid) from public;
grant execute on function public.follower_count(text, uuid) to anon, authenticated, service_role;

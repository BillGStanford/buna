-- Buna 0012 — expose only public profile social links through a narrow RPC.
-- The profiles.social_links column already exists; this migration adds a safe read path
-- without widening the public_profiles view or exposing any other profile columns.

create or replace function public.get_public_profile_social_links(p_user uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(p.social_links, '{}'::jsonb)
    from public.profiles p
   where p.id = p_user
     and not p.is_suspended
     and (p.is_public_profile or p.id = auth.uid())
$$;

revoke all on function public.get_public_profile_social_links(uuid) from public;
grant execute on function public.get_public_profile_social_links(uuid) to anon, authenticated;

-- Inquiry email delivery is tracked per recipient. A partial failure must not resend
-- to recipients who already received the message on the next retry.
create table public.inquiry_email_deliveries (
  inquiry_id uuid not null references public.inquiries(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  recipient_email text not null,
  status text not null default 'sending' check (status in ('sending', 'sent', 'failed')),
  claimed_at timestamptz not null default now(),
  sent_at timestamptz,
  last_error text,
  primary key (inquiry_id, recipient_id)
);
alter table public.inquiry_email_deliveries enable row level security;
revoke all on public.inquiry_email_deliveries from public, anon, authenticated;
grant all on public.inquiry_email_deliveries to service_role;

create or replace function public.claim_inquiry_email_recipient(
  p_inquiry uuid, p_recipient uuid, p_email text
) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare v_result text; v_status text;
begin
  if p_inquiry is null or p_recipient is null or p_email is null or length(p_email) > 254 then
    return 'busy';
  end if;
  insert into public.inquiry_email_deliveries as d
    (inquiry_id, recipient_id, recipient_email, status, claimed_at)
  values (p_inquiry, p_recipient, p_email, 'sending', now())
  on conflict (inquiry_id, recipient_id) do update
    set recipient_email = excluded.recipient_email,
        status = 'sending',
        claimed_at = now(),
        last_error = null
    where d.status <> 'sent'
      and (d.status <> 'sending' or d.claimed_at < now() - interval '10 minutes')
  returning 'claimed' into v_result;
  if v_result is not null then return v_result; end if;

  select d.status into v_status
    from public.inquiry_email_deliveries d
   where d.inquiry_id = p_inquiry and d.recipient_id = p_recipient;
  return case when v_status = 'sent' then 'sent' else 'busy' end;
end
$$;

create or replace function public.finish_inquiry_email_recipient(
  p_inquiry uuid, p_recipient uuid, p_status text, p_error text default null
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_status not in ('sent', 'failed') then
    raise exception 'invalid_delivery_status' using errcode = '22023';
  end if;
  update public.inquiry_email_deliveries
     set status = p_status,
         sent_at = case when p_status = 'sent' then now() else sent_at end,
         last_error = left(p_error, 300)
   where inquiry_id = p_inquiry and recipient_id = p_recipient;
end
$$;

revoke all on function public.claim_inquiry_email_recipient(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.finish_inquiry_email_recipient(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.claim_inquiry_email_recipient(uuid, uuid, text) to service_role;
grant execute on function public.finish_inquiry_email_recipient(uuid, uuid, text, text) to service_role;

-- Keep the most recently featured startup in the homepage's featured window.
create or replace function public.moderate_startup(p_startup uuid, p_action text, p_note text default null)
returns public.startup_status
language plpgsql
security definer
set search_path = ''
as $$
declare v public.startups%rowtype; v_new public.startup_status;
begin
  perform public.assert_staff();
  select * into v from public.startups where id = p_startup for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  v_new := v.status;

  if p_action = 'approve' then
    if v.status <> 'pending_review' then raise exception 'invalid_state' using errcode = '55000'; end if;
    v_new := 'published';
    update public.startups set status = v_new, published_at = coalesce(published_at, now()), updated_at = now() where id = p_startup;
    perform public.notify_startup_managers(p_startup, 'startup_approved', v.name || ' is live', null, 'startup:' || p_startup || ':approved:' || extract(epoch from now())::bigint);
  elsif p_action = 'reject' then
    if v.status <> 'pending_review' then raise exception 'invalid_state' using errcode = '55000'; end if;
    if coalesce(btrim(p_note), '') = '' then raise exception 'note_required' using errcode = '23514'; end if;
    v_new := 'rejected';
    update public.startups set status = v_new, updated_at = now() where id = p_startup;
    perform public.notify_startup_managers(p_startup, 'startup_rejected', v.name || ' needs changes', left(p_note, 300), 'startup:' || p_startup || ':rejected:' || extract(epoch from now())::bigint);
  elsif p_action = 'unpublish' then
    if v.status not in ('published', 'pending_review') then raise exception 'invalid_state' using errcode = '55000'; end if;
    v_new := 'unpublished';
    update public.startups set status = v_new, is_featured = false, updated_at = now() where id = p_startup;
  elsif p_action = 'remove' then
    if v.status = 'removed' then raise exception 'invalid_state' using errcode = '55000'; end if;
    v_new := 'removed';
    update public.startups set status = v_new, is_featured = false, updated_at = now() where id = p_startup;
    perform public.notify_startup_managers(p_startup, 'startup_removed', v.name || ' was removed', left(coalesce(p_note, ''), 300), 'startup:' || p_startup || ':removed:' || extract(epoch from now())::bigint);
  elsif p_action = 'restore' then
    if v.status not in ('removed', 'rejected') then raise exception 'invalid_state' using errcode = '55000'; end if;
    v_new := 'unpublished';
    update public.startups set status = v_new, updated_at = now() where id = p_startup;
  elsif p_action in ('feature', 'unfeature') then
    if v.status <> 'published' then raise exception 'invalid_state' using errcode = '55000'; end if;
    update public.startups set is_featured = (p_action = 'feature'), updated_at = now() where id = p_startup;
  else
    raise exception 'unknown_action' using errcode = '22023';
  end if;
  perform public.audit('startup.' || p_action, 'startup', p_startup::text, jsonb_build_object('note', p_note, 'resulting_status', v_new));
  return v_new;
end
$$;

-- Keep the withdrawal reason on the verified request as well as in the notification,
-- so the startup team can see the actual reason on its verification page.
create or replace function public.revoke_verification(p_startup uuid, p_note text) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_name text;
begin
  perform public.assert_admin();
  if coalesce(btrim(p_note), '') = '' then raise exception 'note_required' using errcode = '23514'; end if;
  select name into v_name from public.startups where id = p_startup and verification_status = 'verified';
  if not found then raise exception 'invalid_state' using errcode = '55000'; end if;
  update public.startups set verification_status = 'revoked', verified_at = null, updated_at = now() where id = p_startup;
  update public.verification_requests
     set decision_note = left(p_note, 500), reviewed_by = auth.uid(), reviewed_at = now()
   where id = (
     select vr.id from public.verification_requests vr
      where vr.startup_id = p_startup and vr.status = 'verified'
      order by vr.reviewed_at desc nulls last, vr.created_at desc
      limit 1
   );
  perform public.notify_startup_managers(p_startup, 'verification', 'Verification for ' || v_name || ' was withdrawn', left(p_note, 300), 'verification-revoked:' || p_startup || ':' || extract(epoch from now())::bigint);
  perform public.audit('verification.revoke', 'startup', p_startup::text, jsonb_build_object('note', p_note));
end
$$;

-- Submission and startup status change are atomic; a new request must put the startup back into pending.
create function public.submit_verification_request(
  p_startup uuid, p_notes text, p_evidence_paths text[] default '{}'
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_status text; v_request uuid; v_role public.member_role;
begin
  if auth.uid() is null or not public.is_active_user() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  v_role := public.my_member_role(p_startup);
  if v_role not in ('owner', 'admin') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_notes is null or length(btrim(p_notes)) < 10 or length(p_notes) > 2000 then
    raise exception 'invalid_notes' using errcode = '22023';
  end if;
  if coalesce(array_length(p_evidence_paths, 1), 0) > 3
     or exists (
       select 1 from unnest(coalesce(p_evidence_paths, '{}'::text[])) as item(path)
        where item.path !~ ('^' || p_startup::text || '/[0-9a-fA-F-]+\.(pdf|jpg|png|webp)$')
     ) then
    raise exception 'invalid_evidence' using errcode = '22023';
  end if;

  select s.verification_status::text into v_status
    from public.startups s where s.id = p_startup for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if v_status = 'verified' then raise exception 'already_verified' using errcode = '55000'; end if;
  if v_status = 'pending' then raise exception 'invalid_state' using errcode = '55000'; end if;

  insert into public.verification_requests (startup_id, requested_by, notes, evidence_paths)
  values (p_startup, auth.uid(), btrim(p_notes), coalesce(p_evidence_paths, '{}'::text[]))
  returning id into v_request;
  update public.startups set verification_status = 'pending', verified_at = null, updated_at = now() where id = p_startup;
  perform public.audit('verification.request', 'startup', p_startup::text, jsonb_build_object('request', v_request));
  return v_request;
end
$$;
revoke all on function public.submit_verification_request(uuid, text, text[]) from public, anon;
grant execute on function public.submit_verification_request(uuid, text, text[]) to authenticated;

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

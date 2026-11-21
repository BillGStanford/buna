-- 0042: restore safe member access to notification preferences and preserve every email preference.
-- regression-test: supabase/tests/notification_preferences.sql

alter table public.notification_preferences enable row level security;

-- PostgREST needs SELECT on the returned user_id and preference columns, plus
-- UPDATE on exactly the preference columns accepted by the settings action.
revoke all on table public.notification_preferences from anon;
grant select (
  user_id,
  email_comments,
  email_replies,
  email_inquiries,
  email_moderation,
  email_referrals,
  email_launch_reminders
) on public.notification_preferences to authenticated;
grant update (
  email_comments,
  email_replies,
  email_inquiries,
  email_moderation,
  email_referrals,
  email_launch_reminders
) on public.notification_preferences to authenticated;

-- A member can read and change only their own preference row. The restrictive
-- guards keep this true even if another permissive policy is added later.
drop policy if exists notification_preferences_0042_select_own on public.notification_preferences;
create policy notification_preferences_0042_select_own
  on public.notification_preferences for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists notification_preferences_0042_select_guard on public.notification_preferences;
create policy notification_preferences_0042_select_guard
  on public.notification_preferences as restrictive for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists notification_preferences_0042_update_own on public.notification_preferences;
create policy notification_preferences_0042_update_own
  on public.notification_preferences for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists notification_preferences_0042_update_guard on public.notification_preferences;
create policy notification_preferences_0042_update_guard
  on public.notification_preferences as restrictive for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Keep the preference dispatch table explicit. In particular, referrals must
-- not fall through to the default false branch (a regression in earlier edits).
create or replace function public.create_notification(
  p_user uuid,
  p_type text,
  p_title text,
  p_body text,
  p_url text,
  p_dedupe text,
  p_pref text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email boolean := false;
begin
  if p_user is null then
    return;
  end if;

  select case p_pref
    when 'comments' then coalesce(np.email_comments, false)
    when 'replies' then coalesce(np.email_replies, false)
    when 'inquiries' then coalesce(np.email_inquiries, false)
    when 'moderation' then coalesce(np.email_moderation, false)
    when 'referrals' then coalesce(np.email_referrals, false)
    when 'launch_reminders' then coalesce(np.email_launch_reminders, false)
    else false
  end
    into v_email
    from public.notification_preferences np
   where np.user_id = p_user;

  insert into public.notifications
    (user_id, type, title, body, url, dedupe_key, email_status)
  values
    (p_user, p_type, p_title, p_body, p_url, p_dedupe,
     case when coalesce(v_email, false) then 'pending'::public.email_delivery_status end)
  on conflict (user_id, dedupe_key) do nothing;
end;
$$;

revoke all on function public.create_notification(uuid, text, text, text, text, text, text)
  from public, anon, authenticated;

-- Regression coverage for migration 0042.
\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
values
  ('00000000-0000-4000-8000-000000004201', 'notification-pref-a@test.dev', now(), '{"display_name":"Notification Preference A"}'),
  ('00000000-0000-4000-8000-000000004202', 'notification-pref-b@test.dev', now(), '{"display_name":"Notification Preference B"}')
on conflict (id) do nothing;

insert into public.notification_preferences (user_id)
values
  ('00000000-0000-4000-8000-000000004201'),
  ('00000000-0000-4000-8000-000000004202')
on conflict (user_id) do nothing;

-- Authenticated members can update their own preferences, but cannot change
-- another member's row. The returned user_id is selectable by PostgREST.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000004201', false);
update public.notification_preferences
   set email_comments = false
 where user_id = '00000000-0000-4000-8000-000000004201';
do $$
declare affected integer;
begin
  assert (select email_comments = false from public.notification_preferences
           where user_id = '00000000-0000-4000-8000-000000004201'),
    'authenticated member can update their own preference';
  update public.notification_preferences
     set email_comments = false
   where user_id = '00000000-0000-4000-8000-000000004202';
  get diagnostics affected = row_count;
  assert affected = 0, 'authenticated member cannot update another member preference';
  assert (select count(user_id) from public.notification_preferences) = 1,
    'authenticated member can only read their own preference row';
end
$$;
reset role;

-- Exercise all 2^7 combinations. Every category must independently honor its
-- own setting; no category may accidentally inherit another category's flag.
do $$
declare
  v_user uuid := '00000000-0000-4000-8000-000000004201';
  v_prefs text[] := array['comments','replies','inquiries','moderation','referrals','launch_reminders','deadlines'];
  v_pref text;
  v_index integer;
  v_mask integer;
  v_expected boolean;
  v_actual text;
  v_dedupe text;
begin
  for v_mask in 0..127 loop
    update public.notification_preferences
       set email_comments = (v_mask & 1) <> 0,
           email_replies = (v_mask & 2) <> 0,
           email_inquiries = (v_mask & 4) <> 0,
           email_moderation = (v_mask & 8) <> 0,
           email_referrals = (v_mask & 16) <> 0,
           email_launch_reminders = (v_mask & 32) <> 0,
           email_opportunity_deadlines = (v_mask & 64) <> 0
     where user_id = v_user;

    foreach v_pref in array v_prefs loop
      v_index := array_position(v_prefs, v_pref) - 1;
      v_expected := (v_mask & (1 << v_index)) <> 0;
      v_dedupe := 'notification-preference-matrix:' || v_mask::text || ':' || v_pref;
      perform public.create_notification(
        v_user, 'reply', 'Preference matrix test', 'Regression test notification',
        '/dashboard/notifications', v_dedupe, v_pref
      );
      select email_status::text into v_actual
        from public.notifications
       where user_id = v_user and dedupe_key = v_dedupe;
      assert found, 'create_notification inserted a notification for ' || v_pref;
      assert coalesce(v_actual = 'pending', false) = v_expected,
        'preference mismatch for ' || v_pref || ' at bitmask ' || v_mask::text;
    end loop;
  end loop;
end
$$;

rollback;

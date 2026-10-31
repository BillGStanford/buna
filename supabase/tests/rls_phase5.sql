-- Phase 5 checks: staff gates, startup/comment moderation, reports queue, suspension and roles, verification, settings, overview.
\set ON_ERROR_STOP on
set search_path = "$user", public, extensions;

create function pg_temp.act_as(p_uid text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', coalesce(p_uid, ''), false); end $$;
create function pg_temp.expect_err(q text, pat text) returns void language plpgsql as $$
begin
  begin execute q;
  exception when others then
    if sqlerrm like '%' || pat || '%' then return; end if;
    raise exception 'FAIL: expected "%" but got "%" for: %', pat, sqlerrm, q;
  end;
  raise exception 'FAIL: no error (expected "%") for: %', pat, q;
end $$;

-- a1 admin, b1 moderator, b2 second moderator, c1 owner, c2 user, c3 user
insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-0000-0000-0000000005a1', 'admin5@test.dev', now()),
  ('00000000-0000-0000-0000-0000000005b1', 'mod5@test.dev', now()),
  ('00000000-0000-0000-0000-0000000005b2', 'mod5b@test.dev', now()),
  ('00000000-0000-0000-0000-0000000005c1', 'owner5@test.dev', now()),
  ('00000000-0000-0000-0000-0000000005c2', 'user5@test.dev', now()),
  ('00000000-0000-0000-0000-0000000005c3', 'user5b@test.dev', now());
update public.profiles set role = 'admin', username = 'adm5' where id = '00000000-0000-0000-0000-0000000005a1';
update public.profiles set role = 'moderator', username = 'mod5' where id = '00000000-0000-0000-0000-0000000005b1';
update public.profiles set role = 'moderator', username = 'mod5b' where id = '00000000-0000-0000-0000-0000000005b2';
update public.profiles set username = 'own5' where id = '00000000-0000-0000-0000-0000000005c1';
update public.profiles set username = 'usr5' where id = '00000000-0000-0000-0000-0000000005c2';
update public.profiles set username = 'usr5b', display_name = 'Una Five' where id = '00000000-0000-0000-0000-0000000005c3';

insert into public.startups (id, name, slug, created_by, tagline, description, country, category_id, status, published_at) values
  ('55550000-0000-4000-8000-000000000001', 'Five Pending', 'five-pending', '00000000-0000-0000-0000-0000000005c1', 't', 'd', 'ET', (select id from public.categories where slug = 'fintech'), 'pending_review', null),
  ('55550000-0000-4000-8000-000000000002', 'Five Live', 'five-live', '00000000-0000-0000-0000-0000000005c1', 't', 'd', 'ET', (select id from public.categories where slug = 'fintech'), 'published', now());

-- ===== staff gates: ordinary users and anonymous callers get nothing =====
set role authenticated; select pg_temp.act_as('00000000-0000-0000-0000-0000000005c2') \gset
select pg_temp.expect_err($q$select public.moderate_startup('55550000-0000-4000-8000-000000000001', 'approve')$q$, 'forbidden');
select pg_temp.expect_err($q$select public.admin_overview()$q$, 'forbidden');
select pg_temp.expect_err($q$select * from public.admin_search_users('', 10, 0)$q$, 'forbidden');
select pg_temp.expect_err($q$select * from public.admin_list_reports('active', 10, 0)$q$, 'forbidden');
select pg_temp.expect_err($q$select public.set_user_suspension('00000000-0000-0000-0000-0000000005c3', true, 'x')$q$, 'forbidden');
select pg_temp.expect_err($q$select public.set_user_role('00000000-0000-0000-0000-0000000005c3', 'admin')$q$, 'forbidden');
select pg_temp.expect_err($q$select public.set_platform_setting('startups_require_review', 'true'::jsonb)$q$, 'forbidden');
select pg_temp.expect_err($q$select * from public.get_platform_settings()$q$, 'forbidden');
select pg_temp.expect_err($q$select public.review_verification(gen_random_uuid(), 'approve')$q$, 'forbidden');
select pg_temp.expect_err($q$update public.profiles set role = 'admin' where id = auth.uid()$q$, 'permission denied');
reset role; set role anon; select pg_temp.act_as('') \gset
select pg_temp.expect_err($q$select public.admin_overview()$q$, 'permission denied');
reset role;

-- ===== startup moderation state machine =====
set role authenticated; select pg_temp.act_as('00000000-0000-0000-0000-0000000005b1') \gset
select pg_temp.expect_err($q$select public.moderate_startup('55550000-0000-4000-8000-000000000001', 'reject')$q$, 'note_required');
select pg_temp.expect_err($q$select public.moderate_startup('55550000-0000-4000-8000-000000000001', 'feature')$q$, 'invalid_state');
select pg_temp.expect_err($q$select public.moderate_startup('55550000-0000-4000-8000-000000000001', 'explode')$q$, 'unknown_action');
select pg_temp.expect_err($q$select public.moderate_startup(gen_random_uuid(), 'approve')$q$, 'not_found');
do $$ begin
  assert public.moderate_startup('55550000-0000-4000-8000-000000000001', 'approve') = 'published', 'approval publishes';
  assert (select published_at is not null from public.startups where slug = 'five-pending'), 'published_at set';
end $$;
select pg_temp.expect_err($q$select public.moderate_startup('55550000-0000-4000-8000-000000000001', 'approve')$q$, 'invalid_state');
select public.moderate_startup('55550000-0000-4000-8000-000000000002', 'feature') \gset
do $$ begin
  assert (select is_featured from public.startups where slug = 'five-live'), 'featured';
  assert public.moderate_startup('55550000-0000-4000-8000-000000000002', 'remove', 'spam') = 'removed', 'removed';
  assert not (select is_featured from public.startups where slug = 'five-live'), 'removal clears featured';
  assert public.moderate_startup('55550000-0000-4000-8000-000000000002', 'restore') = 'unpublished', 'restore returns it to the owner as unpublished';
end $$;
reset role;
do $$ begin
  assert (select count(*) from public.notifications where user_id = '00000000-0000-0000-0000-0000000005c1' and type in ('startup_approved', 'startup_removed')) = 2, 'owner told about the decisions';
  assert (select count(*) from public.audit_logs where action like 'startup.%' and actor_id = '00000000-0000-0000-0000-0000000005b1') >= 4, 'every decision audited with the actor';
end $$;
-- a removed startup cannot be republished by its owner
update public.startups set status = 'removed' where slug = 'five-live';
set role authenticated; select pg_temp.act_as('00000000-0000-0000-0000-0000000005c1') \gset
select pg_temp.expect_err($q$select public.set_startup_publication('55550000-0000-4000-8000-000000000002', true)$q$, 'blocked_by_moderation');
reset role;

-- ===== comments =====
insert into public.launches (id, slug, name, tagline, product_url, status, published_at, submitted_by) values
  ('55550000-0000-4000-8000-0000000000a1', 'five-launch', 'Five Launch', 'A launch for five', 'https://five.example', 'published', now(), '00000000-0000-0000-0000-0000000005c1');
insert into public.comments (id, launch_id, author_id, body) values
  ('55550000-0000-4000-8000-0000000000b1', '55550000-0000-4000-8000-0000000000a1', '00000000-0000-0000-0000-0000000005c2', 'Rude comment'),
  ('55550000-0000-4000-8000-0000000000b2', '55550000-0000-4000-8000-0000000000a1', '00000000-0000-0000-0000-0000000005c2', 'Own deleted comment');
update public.comments set status = 'deleted' where id = '55550000-0000-4000-8000-0000000000b2';
set role authenticated; select pg_temp.act_as('00000000-0000-0000-0000-0000000005c3') \gset
select pg_temp.expect_err($q$select public.moderate_comment('55550000-0000-4000-8000-0000000000b1', 'hide')$q$, 'forbidden');
select pg_temp.act_as('00000000-0000-0000-0000-0000000005b1') \gset
select public.moderate_comment('55550000-0000-4000-8000-0000000000b1', 'hide', 'abusive') \gset
select pg_temp.expect_err($q$select public.moderate_comment('55550000-0000-4000-8000-0000000000b2', 'restore')$q$, 'invalid_state');
reset role;
do $$ begin
  assert (select comment_count from public.launches where slug = 'five-launch') = 0, 'hiding removes it from the count';
  assert (select count(*) from public.audit_logs where action = 'comment.hide') = 1, 'hiding audited';
end $$;
set role anon; select pg_temp.act_as('') \gset
do $$ begin assert (select count(*) from public.get_launch_comments('55550000-0000-4000-8000-0000000000a1')) = 0, 'hidden comments disappear from the public thread'; end $$;
reset role; set role authenticated; select pg_temp.act_as('00000000-0000-0000-0000-0000000005b1') \gset
select public.moderate_comment('55550000-0000-4000-8000-0000000000b1', 'restore') \gset
reset role;
do $$ begin assert (select comment_count from public.launches where slug = 'five-launch') = 1, 'restoring brings it back'; end $$;

-- ===== reports queue =====
insert into public.reports (id, reporter_id, target_type, target_id, reason, details) values
  ('55550000-0000-4000-8000-0000000000c1', '00000000-0000-0000-0000-0000000005c3', 'comment', '55550000-0000-4000-8000-0000000000b1', 'abusive', 'rude'),
  ('55550000-0000-4000-8000-0000000000c2', '00000000-0000-0000-0000-0000000005c1', 'comment', '55550000-0000-4000-8000-0000000000b1', 'abusive', null),
  ('55550000-0000-4000-8000-0000000000c3', '00000000-0000-0000-0000-0000000005c3', 'user', '00000000-0000-0000-0000-0000000005c2', 'spam', null),
  ('55550000-0000-4000-8000-0000000000c4', '00000000-0000-0000-0000-0000000005c3', 'startup', '55550000-0000-4000-8000-000000000001', 'misleading', null);
set role authenticated; select pg_temp.act_as('00000000-0000-0000-0000-0000000005b1') \gset
do $$ declare r record; begin
  select * into r from public.admin_list_reports('active', 20, 0) where id = '55550000-0000-4000-8000-0000000000c1';
  assert r.target_label = 'Rude comment' and r.target_url = '/launches/five-launch#comment-55550000-0000-4000-8000-0000000000b1' and r.target_state = 'visible', 'comment report resolves its target';
  assert r.same_target_count = 2, 'repeat reports on one target are grouped';
  assert r.reporter_username = 'usr5b', 'reporter shown to staff';
  assert (select target_label from public.admin_list_reports('active', 20, 0) where id = '55550000-0000-4000-8000-0000000000c3') = '@usr5', 'user report resolves';
  assert (select target_label from public.admin_list_reports('active', 20, 0) where id = '55550000-0000-4000-8000-0000000000c4') = 'Five Pending', 'startup report resolves';
  assert (select count(*) from public.admin_list_reports('active', 1, 0)) = 1 and (select total from public.admin_list_reports('active', 1, 0)) >= 4, 'pagination reports the total';
end $$;
select public.resolve_report('55550000-0000-4000-8000-0000000000c1', 'actioned', 'comment hidden') \gset
select pg_temp.expect_err($q$select public.resolve_report('55550000-0000-4000-8000-0000000000c1', 'open')$q$, 'invalid_state');
select pg_temp.expect_err($q$select public.resolve_report(gen_random_uuid(), 'dismissed')$q$, 'not_found');
do $$ begin
  assert (select count(*) from public.admin_list_reports('actioned', 20, 0) where id = '55550000-0000-4000-8000-0000000000c1') = 1, 'resolved reports leave the active queue';
  assert (select count(*) from public.admin_list_reports('active', 20, 0) where id = '55550000-0000-4000-8000-0000000000c1') = 0;
  assert (select handled_by from public.reports where id = '55550000-0000-4000-8000-0000000000c1') = auth.uid(), 'handler recorded';
end $$;
reset role;

-- ===== suspension and roles =====
set role authenticated; select pg_temp.act_as('00000000-0000-0000-0000-0000000005b1') \gset
select pg_temp.expect_err($q$select public.set_user_suspension(auth.uid(), true, 'self')$q$, 'forbidden');
select pg_temp.expect_err($q$select public.set_user_suspension('00000000-0000-0000-0000-0000000005a1', true, 'coup')$q$, 'forbidden');
select pg_temp.expect_err($q$select public.set_user_suspension('00000000-0000-0000-0000-0000000005b2', true, 'rivalry')$q$, 'forbidden');
select pg_temp.expect_err($q$select public.set_user_suspension('00000000-0000-0000-0000-0000000005c2', true, '')$q$, 'note_required');
select public.set_user_suspension('00000000-0000-0000-0000-0000000005c2', true, 'Repeated spam') \gset
reset role;
do $$ begin
  assert (select is_suspended and suspended_reason = 'Repeated spam' from public.profiles where id = '00000000-0000-0000-0000-0000000005c2'), 'suspended with a reason';
  assert (select count(*) from public.notifications where user_id = '00000000-0000-0000-0000-0000000005c2' and type = 'account') = 1, 'the person is told';
end $$;
set role authenticated; select pg_temp.act_as('00000000-0000-0000-0000-0000000005c2') \gset
select pg_temp.expect_err($q$insert into public.comments (launch_id, author_id, body) values ('55550000-0000-4000-8000-0000000000a1', auth.uid(), 'still posting')$q$, 'row-level security');
select pg_temp.expect_err($q$insert into public.launch_votes (launch_id, user_id) values ('55550000-0000-4000-8000-0000000000a1', auth.uid())$q$, 'row-level security');
select pg_temp.expect_err($q$insert into public.follows (follower_id, target_type, target_id) values (auth.uid(), 'startup', '55550000-0000-4000-8000-000000000001')$q$, 'row-level security');
do $$ begin assert (select count(*) from public.public_profiles where id = auth.uid()) = 0, 'suspended members vanish from public listings'; end $$;
select pg_temp.act_as('00000000-0000-0000-0000-0000000005a1') \gset
select public.set_user_suspension('00000000-0000-0000-0000-0000000005b2', true, 'Policy breach') \gset
select public.set_user_suspension('00000000-0000-0000-0000-0000000005b2', false) \gset
select public.set_user_suspension('00000000-0000-0000-0000-0000000005c2', false) \gset
select pg_temp.expect_err($q$select public.set_user_role(auth.uid(), 'user')$q$, 'forbidden');
select public.set_user_role('00000000-0000-0000-0000-0000000005c3', 'moderator') \gset
select pg_temp.act_as('00000000-0000-0000-0000-0000000005b1') \gset
select pg_temp.expect_err($q$select public.set_user_role('00000000-0000-0000-0000-0000000005c3', 'admin')$q$, 'forbidden');
reset role;
do $$ begin
  assert (select role from public.profiles where id = '00000000-0000-0000-0000-0000000005c3') = 'moderator', 'admin promoted a user';
  assert not (select is_suspended from public.profiles where id = '00000000-0000-0000-0000-0000000005c2'), 'reinstated';
  assert (select count(*) from public.audit_logs where action = 'user.role_change') = 1 and (select count(*) from public.audit_logs where action in ('user.suspend', 'user.reinstate')) = 4, 'role changes and suspensions are audited';
end $$;
update public.profiles set role = 'user' where id = '00000000-0000-0000-0000-0000000005c3';

-- ===== user search: emails only for admins =====
set role authenticated; select pg_temp.act_as('00000000-0000-0000-0000-0000000005b1') \gset
do $$ begin
  assert (select count(*) from public.admin_search_users('usr5', 10, 0)) = 2, 'staff can search by username';
  assert (select count(*) from public.admin_search_users('una five', 10, 0)) = 1, 'and by display name';
  assert (select count(*) from public.admin_search_users('admin5@', 10, 0)) = 0, 'moderators cannot search by email';
  assert (select count(*) from public.admin_search_users('usr5', 10, 0) where email is not null) = 0, 'moderators never see email addresses';
  assert (select count(*) from public.admin_search_users('%', 10, 0)) = 0, 'wildcards are literal';
end $$;
select pg_temp.act_as('00000000-0000-0000-0000-0000000005a1') \gset
do $$ begin
  assert (select email from public.admin_search_users('usr5b', 10, 0)) = 'user5b@test.dev', 'admins see the address';
  assert (select count(*) from public.admin_search_users('user5b@test', 10, 0)) = 1, 'and can search by email';
end $$;
reset role;

-- ===== verification =====
insert into public.verification_requests (id, startup_id, requested_by, notes, evidence_paths) values
  ('55550000-0000-4000-8000-0000000000d1', '55550000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-0000000005c1', 'Registered company', array['55550000-0000-4000-8000-000000000001/reg.pdf']);
do $$ begin assert (select verification_status from public.startups where slug = 'five-pending') = 'pending', 'a request moves the startup to pending, not verified'; end $$;
set role authenticated; select pg_temp.act_as('00000000-0000-0000-0000-0000000005b1') \gset
select pg_temp.expect_err($q$select public.review_verification('55550000-0000-4000-8000-0000000000d1', 'approve')$q$, 'forbidden');
select pg_temp.act_as('00000000-0000-0000-0000-0000000005a1') \gset
select pg_temp.expect_err($q$select public.review_verification('55550000-0000-4000-8000-0000000000d1', 'reject')$q$, 'note_required');
select public.review_verification('55550000-0000-4000-8000-0000000000d1', 'approve', 'Registration checked') \gset
select pg_temp.expect_err($q$select public.review_verification('55550000-0000-4000-8000-0000000000d1', 'approve')$q$, 'invalid_state');
reset role;
do $$ begin
  assert (select verification_status || '|' || (verified_at is not null)::text from public.startups where slug = 'five-pending') = 'verified|true', 'approval verifies the startup';
  assert (select status from public.verification_requests where id = '55550000-0000-4000-8000-0000000000d1') = 'verified', 'request closed';
  assert (select count(*) from public.notifications where type = 'verification' and user_id = '00000000-0000-0000-0000-0000000005c1') = 1, 'owner told';
end $$;
set role authenticated; select pg_temp.act_as('00000000-0000-0000-0000-0000000005a1') \gset
select pg_temp.expect_err($q$select public.revoke_verification('55550000-0000-4000-8000-000000000001', '')$q$, 'note_required');
select public.revoke_verification('55550000-0000-4000-8000-000000000001', 'Documents were forged') \gset
select pg_temp.expect_err($q$select public.revoke_verification('55550000-0000-4000-8000-000000000001', 'again')$q$, 'invalid_state');
reset role;
do $$ begin assert (select verification_status || '|' || coalesce(verified_at::text, 'null') from public.startups where slug = 'five-pending') = 'revoked|null', 'revocation clears the badge'; end $$;
-- founders cannot verify themselves, and can withdraw a pending request
set role authenticated; select pg_temp.act_as('00000000-0000-0000-0000-0000000005c1') \gset
select pg_temp.expect_err($q$update public.startups set verification_status = 'verified' where id = '55550000-0000-4000-8000-000000000001'$q$, 'permission denied');
insert into public.verification_requests (startup_id, requested_by, notes) values ('55550000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-0000000005c1', 'Second try');
select public.withdraw_verification_request((select id from public.verification_requests where notes = 'Second try')) \gset
reset role;
select id as wid from public.verification_requests where notes = 'Second try' \gset
set role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-0000000005c3') \gset
select pg_temp.expect_err(format('select public.withdraw_verification_request(%L)', :'wid'), 'forbidden');
reset role;
do $$ begin assert (select verification_status from public.startups where slug = 'five-pending') = 'unverified' or (select verification_status from public.startups where slug = 'five-pending') = 'revoked', 'withdrawing never grants verification'; end $$;

-- ===== settings change real behaviour =====
set role authenticated; select pg_temp.act_as('00000000-0000-0000-0000-0000000005b1') \gset
select pg_temp.expect_err($q$select public.set_platform_setting('startups_require_review', 'true'::jsonb)$q$, 'forbidden');
select pg_temp.act_as('00000000-0000-0000-0000-0000000005a1') \gset
select pg_temp.expect_err($q$select public.set_platform_setting('secret_flag', 'true'::jsonb)$q$, 'unknown_setting');
select pg_temp.expect_err($q$select public.set_platform_setting('startups_require_review', '"yes"'::jsonb)$q$, 'invalid_value');
select public.set_platform_setting('startups_require_review', 'true'::jsonb) \gset
do $$ begin assert (select (value #>> '{}')::boolean from public.get_platform_settings() where key = 'startups_require_review'), 'setting stored'; end $$;
select pg_temp.act_as('00000000-0000-0000-0000-0000000005c1') \gset
do $$ begin assert public.set_startup_publication('55550000-0000-4000-8000-000000000001', true) = 'pending_review', 'with review required, publishing sends the startup to the queue'; end $$;
select pg_temp.act_as('00000000-0000-0000-0000-0000000005a1') \gset
select public.set_platform_setting('startups_require_review', 'false'::jsonb) \gset
reset role;
do $$ begin assert (select count(*) from public.audit_logs where action = 'settings.change') = 2, 'settings changes audited'; end $$;

-- ===== overview =====
set role authenticated; select pg_temp.act_as('00000000-0000-0000-0000-0000000005b1') \gset
do $$ declare o jsonb; begin
  o := public.admin_overview();
  assert (o ->> 'startups_pending')::int >= 1 and (o ->> 'reports_open')::int >= 2 and (o ->> 'users')::int >= 6, 'overview counts real rows';
  assert o ? 'verifications_pending' and o ? 'messages_new' and o ? 'opportunities_stale' and o ? 'launches_pending';
end $$;
reset role;

-- ===== categories: only admins manage them =====
set role authenticated; select pg_temp.act_as('00000000-0000-0000-0000-0000000005b1') \gset
select pg_temp.expect_err($q$insert into public.categories (slug, name) values ('mod-made', 'Mod made')$q$, 'row-level security');
select pg_temp.act_as('00000000-0000-0000-0000-0000000005a1') \gset
insert into public.categories (slug, name, sort_order) values ('admin-made', 'Admin made', 500);
select pg_temp.expect_err($q$insert into public.categories (slug, name) values ('admin-made', 'Duplicate')$q$, 'duplicate key');
update public.categories set is_active = false where slug = 'admin-made';
reset role; set role anon; select pg_temp.act_as('') \gset
do $$ begin assert (select count(*) from public.categories where slug = 'admin-made') = 0, 'inactive categories are hidden from visitors'; end $$;
reset role;

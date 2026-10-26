-- Phase 4 checks: terms, founders view, opportunities, inquiries, team, contact inbox, account deletion.
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

-- ids: p1 owner, q1 invitee, r1 stranger, s1 unverified, t1 admin, u1 second owner/editor, v1 deleter, w1 viewer
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000004a1', 'p@test.dev', now(), '{"display_name":"Pia Owner","terms_version":"2026-10-20"}'),
  ('00000000-0000-0000-0000-0000000004b1', 'q@test.dev', now(), '{}'),
  ('00000000-0000-0000-0000-0000000004c1', 'r@test.dev', now(), '{}'),
  ('00000000-0000-0000-0000-0000000004d1', 's@test.dev', null, '{}'),
  ('00000000-0000-0000-0000-0000000004e1', 't@test.dev', now(), '{}'),
  ('00000000-0000-0000-0000-0000000004f1', 'u@test.dev', now(), '{}'),
  ('00000000-0000-0000-0000-0000000004a2', 'v@test.dev', now(), '{}'),
  ('00000000-0000-0000-0000-0000000004b2', 'w@test.dev', now(), '{}');
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000004e1';

-- ===== terms acceptance is recorded at signup and is not client-writable =====
do $$ begin
  assert (select terms_version from public.profiles where id = '00000000-0000-0000-0000-0000000004a1') = '2026-10-20', 'terms version recorded from signup metadata';
  assert (select terms_accepted_at is not null from public.profiles where id = '00000000-0000-0000-0000-0000000004a1'), 'acceptance time recorded';
  assert (select terms_accepted_at is null from public.profiles where id = '00000000-0000-0000-0000-0000000004b1'), 'no acceptance recorded without the flag';
end $$;
set role authenticated; select pg_temp.act_as('00000000-0000-0000-0000-0000000004a1') \gset
select pg_temp.expect_err($q$update public.profiles set terms_accepted_at = null where id = auth.uid()$q$, 'permission denied');

-- ===== founder directory visibility =====
update public.profiles set open_to = array['mentoring', 'advice'] where id = '00000000-0000-0000-0000-0000000004a1';
select pg_temp.expect_err($q$update public.profiles set open_to = array['stealing'] where id = auth.uid()$q$, 'violates check constraint');
reset role;
update public.profiles set is_public_profile = true, is_discoverable_founder = true, display_name = 'Pia Owner' where id = '00000000-0000-0000-0000-0000000004a1';
set role anon; select pg_temp.act_as('') \gset
do $$ begin
  assert (select open_to from public.public_profiles where id = '00000000-0000-0000-0000-0000000004a1') = array['mentoring', 'advice'], 'discoverable founders expose what they are open to';
end $$;
reset role;
update public.profiles set is_discoverable_founder = false where id = '00000000-0000-0000-0000-0000000004a1';
set role anon; select pg_temp.act_as('') \gset
do $$ begin
  assert (select open_to from public.public_profiles where id = '00000000-0000-0000-0000-0000000004a1') = '{}', 'open_to is hidden once the founder opts out';
  assert not (select is_discoverable_founder from public.public_profiles where id = '00000000-0000-0000-0000-0000000004a1'), 'opt-out respected';
end $$;
reset role;
update public.profiles set is_suspended = true where id = '00000000-0000-0000-0000-0000000004b2';
set role anon; select pg_temp.act_as('') \gset
do $$ begin assert (select count(*) from public.public_profiles where id = '00000000-0000-0000-0000-0000000004b2') = 0, 'suspended members are not listed'; end $$;
reset role;
update public.profiles set is_suspended = false where id = '00000000-0000-0000-0000-0000000004b2';

-- ===== opportunities: staff manage, anyone reads open/expired, saves are private, reminders, expiry =====
set role authenticated; select pg_temp.act_as('00000000-0000-0000-0000-0000000004c1') \gset
select pg_temp.expect_err($q$insert into public.opportunities (slug, title, organization, category, status) values ('hack-grant', 'Hacked grant', 'Evil', 'grant', 'published')$q$, 'row-level security');
select pg_temp.act_as('00000000-0000-0000-0000-0000000004e1') \gset
insert into public.opportunities (slug, title, organization, category, status, deadline, countries, application_url, source_url, is_demo) values
  ('grant-open', 'Open Grant', 'Org A', 'grant', 'published', now() + interval '2 days', array['ET'], 'https://apply.example', 'https://source.example', false),
  ('grant-rolling', 'Rolling Fellowship', 'Org B', 'fellowship', 'published', null, '{}', null, 'https://source.example', false),
  ('grant-draft', 'Draft Opportunity', 'Org C', 'grant', 'draft', null, '{}', null, null, false),
  ('grant-old', 'Old Competition', 'Org D', 'competition', 'published', now() - interval '3 days', array['KE'], null, 'https://source.example', false);
select pg_temp.expect_err($q$insert into public.opportunities (slug, title, organization, category, status, application_url) values ('bad-link', 'Bad link', 'X', 'grant', 'published', 'javascript:alert(1)')$q$, 'violates check constraint');
reset role; set role anon; select pg_temp.act_as('') \gset
do $$ begin
  assert (select count(*) from public.opportunities where slug in ('grant-open', 'grant-rolling', 'grant-old')) = 3, 'visitors see published opportunities';
  assert (select count(*) from public.opportunities where slug = 'grant-draft') = 0, 'drafts are hidden';
  assert (select count(*) from public.opportunities where slug = 'grant-open' and (countries && array['ET'] or cardinality(countries) = 0)) = 1, 'country filter semantics (specific country)';
  assert (select count(*) from public.opportunities where slug = 'grant-rolling' and (countries && array['NG'] or cardinality(countries) = 0)) = 1, 'country filter semantics (open to all of Africa)';
  assert (select count(*) from public.opportunities where slug = 'grant-open' and (countries && array['NG'] or cardinality(countries) = 0)) = 0, 'country filter excludes other countries';
end $$;
reset role;
-- expiry: the past-deadline listing becomes "expired", the open one is untouched
set role service_role;
do $$ begin
  assert public.expire_past_opportunities() >= 1, 'past-deadline listings are expired';
  assert (select status from public.opportunities where slug = 'grant-old') = 'expired' and (select status from public.opportunities where slug = 'grant-open') = 'published', 'only past-deadline listings expire';
end $$;
reset role;
-- saving is private; reminders are idempotent and respect email preference
set role authenticated; select pg_temp.act_as('00000000-0000-0000-0000-0000000004c1') \gset
insert into public.saved_opportunities (user_id, opportunity_id) values ('00000000-0000-0000-0000-0000000004c1', (select id from public.opportunities where slug = 'grant-open'));
select pg_temp.expect_err($q$insert into public.saved_opportunities (user_id, opportunity_id) values ('00000000-0000-0000-0000-0000000004c1', (select id from public.opportunities where slug = 'grant-open'))$q$, 'duplicate key');
select pg_temp.expect_err($q$insert into public.saved_opportunities (user_id, opportunity_id) values ('00000000-0000-0000-0000-0000000004b1', (select id from public.opportunities where slug = 'grant-open'))$q$, 'row-level security');
select pg_temp.act_as('00000000-0000-0000-0000-0000000004b1') \gset
do $$ begin assert (select count(*) from public.saved_opportunities) = 0, 'saved lists are private'; end $$;
reset role;
update public.notification_preferences set email_opportunity_deadlines = true where user_id = '00000000-0000-0000-0000-0000000004c1';
set role service_role;
do $$ begin perform public.queue_deadline_reminders(); perform public.queue_deadline_reminders(); end $$;
reset role;
do $$ begin
  assert (select count(*) from public.notifications where user_id = '00000000-0000-0000-0000-0000000004c1' and type = 'deadline') = 1, 'one reminder per person per opportunity';
  assert (select email_status from public.notifications where type = 'deadline' and user_id = '00000000-0000-0000-0000-0000000004c1') = 'pending', 'reminder email queued for people who opted in';
end $$;

-- listing function: open / soon / rolling / closed never mix, and expired listings are never "open"
set role anon; select pg_temp.act_as('') \gset
do $$ begin
  assert (select count(*) from public.list_opportunities('open', null, null, null, 'deadline', 20, 0) l join public.opportunities o on o.id = l.id where o.slug in ('grant-open', 'grant-rolling')) = 2, 'open lists live and rolling opportunities';
  assert (select count(*) from public.list_opportunities('open', null, null, null, 'deadline', 20, 0) l join public.opportunities o on o.id = l.id where o.slug = 'grant-old') = 0, 'expired opportunities are never open';
  assert (select count(*) from public.list_opportunities('closed', null, null, null, 'deadline', 20, 0) l join public.opportunities o on o.id = l.id where o.slug = 'grant-old') = 1, 'closed lists them';
  assert (select count(*) from public.list_opportunities('soon', null, null, null, 'deadline', 20, 0) l join public.opportunities o on o.id = l.id where o.slug = 'grant-open') = 1, 'closing soon';
  assert (select count(*) from public.list_opportunities('rolling', null, null, null, 'deadline', 20, 0) l join public.opportunities o on o.id = l.id where o.slug = 'grant-rolling') = 1, 'rolling';
  assert (select count(*) from public.list_opportunities('open', 'grant', 'NG', null, 'deadline', 20, 0) l join public.opportunities o on o.id = l.id where o.slug = 'grant-open') = 0, 'country filter excludes other countries';
  assert (select count(*) from public.list_opportunities('open', 'grant', 'ET', null, 'deadline', 20, 0) l join public.opportunities o on o.id = l.id where o.slug = 'grant-open') = 1, 'country and category filters combine';
  assert (select count(*) from public.list_opportunities('open', null, null, 'fellowship', 'deadline', 20, 0) l join public.opportunities o on o.id = l.id where o.slug = 'grant-rolling') = 1, 'search finds by title';
  assert (select count(*) from public.list_opportunities('all', null, null, '%', 'newest', 20, 0)) = 0, 'wildcards in search are literal';
  assert (select count(*) from public.list_opportunities('open', null, null, null, 'deadline', 20, 0) l join public.opportunities o on o.id = l.id where o.slug = 'grant-draft') = 0, 'drafts are never listed';
end $$;
reset role;

-- ===== a startup with a team, then inquiries =====
insert into public.startups (id, name, slug, created_by, tagline, description, country, category_id, status, published_at)
values ('44444444-4444-4444-8444-444444444441', 'Phase Four Co', 'phase-four-co', '00000000-0000-0000-0000-0000000004a1', 't', 'd', 'ET',
        (select id from public.categories where slug = 'fintech'), 'published', now());
insert into public.startups (id, name, slug, created_by, status) values ('44444444-4444-4444-8444-444444444442', 'Hidden Four', 'hidden-four', '00000000-0000-0000-0000-0000000004a1', 'draft');
insert into public.startup_members (startup_id, user_id, role) values
  ('44444444-4444-4444-8444-444444444441', '00000000-0000-0000-0000-0000000004f1', 'editor'),
  ('44444444-4444-4444-8444-444444444441', '00000000-0000-0000-0000-0000000004b2', 'viewer');
set role authenticated; select pg_temp.act_as('00000000-0000-0000-0000-0000000004c1') \gset
select pg_temp.expect_err($q$select public.create_inquiry('44444444-4444-4444-8444-444444444441', null, 'Sam', 'sam@x.dev', 'customer', 'Hello', 'A message long enough')$q$, 'permission denied');
reset role; set role service_role;
select public.create_inquiry('44444444-4444-4444-8444-444444444441', null, 'Sam Sender', 'Sam@X.dev', 'customer', 'Hello there', 'A message that is long enough') as inquiry_id \gset
do $$ begin
  assert public.create_inquiry('44444444-4444-4444-8444-444444444441', null, 'Sam Sender', 'sam@x.dev', 'customer', 'Hello there', 'A message that is long enough') = (select id from public.inquiries limit 1), 'a repeated submission returns the same inquiry';
  assert (select count(*) from public.inquiries) = 1, 'no duplicate stored';
end $$;
select pg_temp.expect_err($q$select public.create_inquiry('44444444-4444-4444-8444-444444444442', null, 'Sam', 'sam@x.dev', 'customer', 'Hello', 'A message that is long enough')$q$, 'startup_unavailable');
select pg_temp.expect_err($q$select public.create_inquiry('44444444-4444-4444-8444-444444444441', null, 'Sam', 'sam@x.dev', 'customer', 'Hi', 'short')$q$, 'violates check constraint');
reset role;
do $$ begin
  assert (select count(*) from public.notifications where type = 'inquiry' and user_id in ('00000000-0000-0000-0000-0000000004a1', '00000000-0000-0000-0000-0000000004f1')) = 2, 'owner and editor notified';
  assert (select count(*) from public.notifications where type = 'inquiry' and user_id = '00000000-0000-0000-0000-0000000004b2') = 0, 'viewers are not notified';
  assert (select lower(sender_email) from public.inquiries limit 1) = 'sam@x.dev', 'sender email normalised';
end $$;
set role authenticated; select pg_temp.act_as('00000000-0000-0000-0000-0000000004a1') \gset
do $$ declare n int; begin
  assert (select count(*) from public.inquiries) = 1 and (select sender_email from public.inquiries limit 1) = 'sam@x.dev', 'owner reads the inquiry including the sender address';
  update public.inquiries set status = 'read', read_at = now(); get diagnostics n = row_count; assert n = 1, 'owner can mark it read';
  perform pg_temp.expect_err($q$update public.inquiries set message = 'rewritten'$q$, 'permission denied');
  perform pg_temp.expect_err($q$select email_error from public.inquiries$q$, 'permission denied');
end $$;
select pg_temp.act_as('00000000-0000-0000-0000-0000000004b2') \gset
do $$ begin assert (select count(*) from public.inquiries) = 0, 'viewers cannot read inquiries'; end $$;
select pg_temp.act_as('00000000-0000-0000-0000-0000000004c1') \gset
do $$ declare n int; begin
  assert (select count(*) from public.inquiries) = 0, 'strangers cannot read inquiries';
  update public.inquiries set status = 'spam'; get diagnostics n = row_count; assert n = 0, 'strangers cannot change them';
end $$;
reset role; set role anon; select pg_temp.act_as('') \gset
select pg_temp.expect_err($q$select count(*) from public.inquiries$q$, 'permission denied');
reset role; set role service_role;
do $$ declare iid uuid := (select id from public.inquiries limit 1); begin
  assert (select count(*) from public.inquiry_recipients(iid)) = 2, 'recipients: owner and editor (viewer excluded)';
  assert (select count(*) from public.pending_inquiry_emails(10)) = 1, 'new inquiry awaits email';
  perform public.mark_inquiry_email(iid, 'failed', 'smtp down');
  assert (select count(*) from public.pending_inquiry_emails(10)) = 1, 'failed deliveries are retried';
  perform public.mark_inquiry_email(iid, 'sent');
  assert (select count(*) from public.pending_inquiry_emails(10)) = 0, 'sent deliveries are not retried';
end $$;
reset role;
update public.notification_preferences set email_inquiries = false where user_id = '00000000-0000-0000-0000-0000000004f1';
set role service_role;
do $$ begin assert (select count(*) from public.inquiry_recipients((select id from public.inquiries limit 1))) = 1, 'recipients respect the email preference'; end $$;
reset role;

-- ===== team invitations =====
set role authenticated; select pg_temp.act_as('00000000-0000-0000-0000-0000000004a1') \gset
select public.create_team_invitation('44444444-4444-4444-8444-444444444441', 'Q@test.dev', 'editor', 'hash-q-1') \gset
do $$ begin
  assert (select email from public.team_invitations where token_hash = 'hash-q-1') = 'q@test.dev' and (select status from public.team_invitations where token_hash = 'hash-q-1') = 'pending', 'invitation created for the normalised email';
  assert (select count(*) from public.team_invitations) = 1, 'owner can read invitations';
end $$;
select pg_temp.expect_err($q$select public.create_team_invitation('44444444-4444-4444-8444-444444444441', 'z@test.dev', 'owner', 'h-owner')$q$, 'forbidden');
select pg_temp.expect_err($q$select public.create_team_invitation('44444444-4444-4444-8444-444444444441', 'Q@test.dev', 'viewer', 'hash-q-dup')$q$, 'duplicate key');
select pg_temp.expect_err($q$select public.create_team_invitation('44444444-4444-4444-8444-444444444441', 'u@test.dev', 'viewer', 'h-member')$q$, 'already_member');
select pg_temp.expect_err($q$select public.create_team_invitation('44444444-4444-4444-8444-444444444441', 'not-an-email', 'viewer', 'h-bad')$q$, 'invalid_email');
select pg_temp.act_as('00000000-0000-0000-0000-0000000004c1') \gset
select pg_temp.expect_err($q$select public.create_team_invitation('44444444-4444-4444-8444-444444444441', 'x@test.dev', 'viewer', 'h-stranger')$q$, 'forbidden');
do $$ begin assert (select count(*) from public.team_invitations) = 0, 'strangers cannot read invitations'; end $$;
select pg_temp.act_as('00000000-0000-0000-0000-0000000004f1') \gset
select pg_temp.expect_err($q$select public.create_team_invitation('44444444-4444-4444-8444-444444444441', 'x@test.dev', 'viewer', 'h-editor')$q$, 'forbidden');
select pg_temp.act_as('00000000-0000-0000-0000-0000000004b2') \gset
select pg_temp.expect_err($q$select public.create_team_invitation('44444444-4444-4444-8444-444444444441', 'x@test.dev', 'viewer', 'h-viewer')$q$, 'forbidden');
reset role; set role anon; select pg_temp.act_as('') \gset
do $$ declare r record; begin
  select * into r from public.get_invitation_preview('hash-q-1');
  assert r.startup_name = 'Phase Four Co' and r.role = 'editor' and r.status = 'pending' and r.email_hint = 'q***@test.dev' and not r.expired, 'preview reveals the startup and a masked address only';
  assert (select count(*) from public.get_invitation_preview('nope')) = 0, 'unknown token reveals nothing';
end $$;
select pg_temp.expect_err($q$select public.accept_team_invitation('hash-q-1')$q$, 'permission denied');
reset role; set role authenticated;
-- acceptance rules
select pg_temp.act_as('00000000-0000-0000-0000-0000000004c1') \gset
select pg_temp.expect_err($q$select public.accept_team_invitation('hash-q-1')$q$, 'email_mismatch');
select pg_temp.act_as('00000000-0000-0000-0000-0000000004d1') \gset
select pg_temp.expect_err($q$select public.accept_team_invitation('hash-q-1')$q$, 'email_not_verified');
select pg_temp.act_as('00000000-0000-0000-0000-0000000004b1') \gset
select pg_temp.expect_err($q$select public.accept_team_invitation('wrong-token')$q$, 'not_found');
select public.accept_team_invitation('hash-q-1') \gset
do $$ begin
  assert (select role from public.startup_members where startup_id = '44444444-4444-4444-8444-444444444441' and user_id = '00000000-0000-0000-0000-0000000004b1') = 'editor', 'invitee became an editor';
  assert (select is_public from public.startup_members where user_id = '00000000-0000-0000-0000-0000000004b1') = false, 'new members are private by default';
end $$;
select pg_temp.expect_err($q$select public.accept_team_invitation('hash-q-1')$q$, 'invitation_used');
reset role;
do $$ begin
  assert (select count(*) from public.notifications where type = 'team' and user_id = '00000000-0000-0000-0000-0000000004a1') = 1, 'inviter is told when someone joins';
  assert (select count(*) from public.audit_logs where action = 'team.accept_invite') = 1, 'acceptance audited';
end $$;
-- expired and revoked invitations cannot be used
insert into public.team_invitations (startup_id, email, role, token_hash, invited_by, expires_at)
values ('44444444-4444-4444-8444-444444444441', 'r@test.dev', 'viewer', 'hash-r-old', '00000000-0000-0000-0000-0000000004a1', now() - interval '1 day');
set role authenticated; select pg_temp.act_as('00000000-0000-0000-0000-0000000004c1') \gset
select pg_temp.expect_err($q$select public.accept_team_invitation('hash-r-old')$q$, 'invitation_expired');
select pg_temp.act_as('00000000-0000-0000-0000-0000000004a1') \gset
select public.create_team_invitation('44444444-4444-4444-8444-444444444441', 'r@test.dev', 'viewer', 'hash-r-2') \gset
select public.revoke_team_invitation((select id from public.team_invitations where token_hash = 'hash-r-2')) \gset
select pg_temp.act_as('00000000-0000-0000-0000-0000000004c1') \gset
select pg_temp.expect_err($q$select public.accept_team_invitation('hash-r-2')$q$, 'invitation_used');
select pg_temp.expect_err($q$select public.revoke_team_invitation((select id from public.team_invitations limit 1))$q$, 'not_found');

-- ===== role changes and removals cannot escalate =====
select pg_temp.act_as('00000000-0000-0000-0000-0000000004a1') \gset
select public.change_member_role('44444444-4444-4444-8444-444444444441', '00000000-0000-0000-0000-0000000004b1', 'admin') \gset
select pg_temp.expect_err($q$select public.change_member_role('44444444-4444-4444-8444-444444444441', auth.uid(), 'viewer')$q$, 'forbidden');
select pg_temp.act_as('00000000-0000-0000-0000-0000000004b1') \gset
select pg_temp.expect_err($q$select public.change_member_role('44444444-4444-4444-8444-444444444441', '00000000-0000-0000-0000-0000000004a1', 'viewer')$q$, 'forbidden');
select pg_temp.expect_err($q$select public.change_member_role('44444444-4444-4444-8444-444444444441', '00000000-0000-0000-0000-0000000004b2', 'admin')$q$, 'forbidden');
select pg_temp.expect_err($q$select public.change_member_role('44444444-4444-4444-8444-444444444441', auth.uid(), 'owner')$q$, 'forbidden');
select public.change_member_role('44444444-4444-4444-8444-444444444441', '00000000-0000-0000-0000-0000000004b2', 'editor') \gset
select pg_temp.expect_err($q$select public.remove_member('44444444-4444-4444-8444-444444444441', '00000000-0000-0000-0000-0000000004a1')$q$, 'forbidden');
select pg_temp.act_as('00000000-0000-0000-0000-0000000004f1') \gset
select pg_temp.expect_err($q$select public.change_member_role('44444444-4444-4444-8444-444444444441', '00000000-0000-0000-0000-0000000004b2', 'viewer')$q$, 'forbidden');
select pg_temp.expect_err($q$select public.remove_member('44444444-4444-4444-8444-444444444441', '00000000-0000-0000-0000-0000000004b2')$q$, 'forbidden');
select pg_temp.act_as('00000000-0000-0000-0000-0000000004c1') \gset
select pg_temp.expect_err($q$select public.remove_member('44444444-4444-4444-8444-444444444441', '00000000-0000-0000-0000-0000000004b2')$q$, 'not_found');
-- direct writes are impossible; members edit only their own visibility
select pg_temp.expect_err($q$insert into public.startup_members (startup_id, user_id, role) values ('44444444-4444-4444-8444-444444444441', auth.uid(), 'owner')$q$, 'permission denied');
select pg_temp.act_as('00000000-0000-0000-0000-0000000004b2') \gset
select pg_temp.expect_err($q$update public.startup_members set role = 'owner' where user_id = auth.uid()$q$, 'permission denied');
update public.startup_members set is_public = true, public_title = 'Engineer' where user_id = auth.uid();
do $$ declare n int; begin
  assert (select is_public from public.startup_members where user_id = auth.uid()) = true, 'members can choose to appear on the public team';
  update public.startup_members set public_title = 'Boss' where user_id <> auth.uid(); get diagnostics n = row_count;
  assert n = 0, 'but cannot edit anyone else';
end $$;
-- deleting a never-published draft removes its team without tripping the last-owner guard
select pg_temp.act_as('00000000-0000-0000-0000-0000000004a1') \gset
do $$ declare n int; begin
  delete from public.startups where id = '44444444-4444-4444-8444-444444444442'; get diagnostics n = row_count;
  assert n = 1, 'owner deleted a draft startup';
  assert (select count(*) from public.startup_members where startup_id = '44444444-4444-4444-8444-444444444442') = 0, 'its memberships went with it';
end $$;
-- the last owner can never leave; a second owner unlocks it
select pg_temp.expect_err($q$select public.remove_member('44444444-4444-4444-8444-444444444441', auth.uid())$q$, 'last_owner');
select public.change_member_role('44444444-4444-4444-8444-444444444441', '00000000-0000-0000-0000-0000000004f1', 'owner') \gset
select pg_temp.expect_err($q$select public.change_member_role('44444444-4444-4444-8444-444444444441', auth.uid(), 'editor')$q$, 'forbidden');
select public.remove_member('44444444-4444-4444-8444-444444444441', '00000000-0000-0000-0000-0000000004a1') \gset
reset role;
do $$ begin assert (select count(*) from public.startup_members where startup_id = '44444444-4444-4444-8444-444444444441' and role = 'owner') = 1, 'ownership passed to the second owner'; end $$;
set role authenticated; select pg_temp.act_as('00000000-0000-0000-0000-0000000004f1') \gset
select pg_temp.expect_err($q$select public.remove_member('44444444-4444-4444-8444-444444444441', auth.uid())$q$, 'last_owner');
reset role;
select pg_temp.expect_err($q$delete from public.startup_members where user_id = '00000000-0000-0000-0000-0000000004f1' and startup_id = '44444444-4444-4444-8444-444444444441'$q$, 'last_owner');
select pg_temp.expect_err($q$update public.startup_members set role = 'viewer' where user_id = '00000000-0000-0000-0000-0000000004f1' and startup_id = '44444444-4444-4444-8444-444444444441'$q$, 'last_owner');

-- ===== contact inbox =====
set role authenticated; select pg_temp.act_as('00000000-0000-0000-0000-0000000004c1') \gset
select pg_temp.expect_err($q$select public.create_platform_message(null, 'X', 'x@x.dev', 'general', 'A long enough message')$q$, 'permission denied');
do $$ begin assert (select count(*) from public.platform_messages) = 0, 'members cannot read the inbox'; end $$;
reset role; set role service_role;
select public.create_platform_message(null, 'Visitor', 'v@x.dev', 'support', 'I need some help with my account') \gset
do $$ begin
  assert public.create_platform_message(null, 'Visitor', 'V@x.dev', 'support', 'I need some help with my account') = (select id from public.platform_messages limit 1), 'duplicate submissions collapse';
  assert (select count(*) from public.platform_messages) = 1;
end $$;
reset role; set role authenticated; select pg_temp.act_as('00000000-0000-0000-0000-0000000004e1') \gset
do $$ declare n int; begin
  assert (select count(*) from public.platform_messages) = 1, 'staff read the inbox';
  update public.platform_messages set status = 'handled', handled_by = auth.uid(), handled_at = now(); get diagnostics n = row_count;
  assert n = 1, 'staff mark messages handled';
  perform pg_temp.expect_err($q$update public.platform_messages set message = 'edited'$q$, 'permission denied');
end $$;
reset role; set role anon; select pg_temp.act_as('') \gset
select pg_temp.expect_err($q$select count(*) from public.platform_messages$q$, 'permission denied');
reset role;

-- ===== account deletion =====
insert into public.startups (id, name, slug, created_by, tagline, description, country, status, published_at) values
  ('44444444-4444-4444-8444-444444444451', 'Solo Venture', 'solo-venture', '00000000-0000-0000-0000-0000000004a2', 't', 'd', 'ET', 'published', now()),
  ('44444444-4444-4444-8444-444444444452', 'Shared Venture', 'shared-venture', '00000000-0000-0000-0000-0000000004a2', 't', 'd', 'ET', 'published', now()),
  ('44444444-4444-4444-8444-444444444453', 'Co-owned Venture', 'co-owned-venture', '00000000-0000-0000-0000-0000000004a2', 't', 'd', 'ET', 'published', now());
insert into public.startup_members (startup_id, user_id, role) values
  ('44444444-4444-4444-8444-444444444452', '00000000-0000-0000-0000-0000000004c1', 'editor'),
  ('44444444-4444-4444-8444-444444444453', '00000000-0000-0000-0000-0000000004e1', 'owner');
insert into public.launches (id, slug, name, tagline, product_url, status, published_at, submitted_by, startup_id) values
  ('44444444-4444-4444-8444-4444444444a1', 'v-solo-launch', 'V Solo Launch', 'No startup behind this', 'https://v.example', 'published', now(), '00000000-0000-0000-0000-0000000004a2', null),
  ('44444444-4444-4444-8444-4444444444a2', 'v-co-launch', 'V Co Launch', 'Backed by a startup', 'https://v.example', 'published', now(), '00000000-0000-0000-0000-0000000004a2', '44444444-4444-4444-8444-444444444453');
insert into public.launch_votes (launch_id, user_id) values ('44444444-4444-4444-8444-4444444444a2', '00000000-0000-0000-0000-0000000004a2');
insert into public.comments (id, launch_id, author_id, body) values ('44444444-4444-4444-8444-4444444444b1', '44444444-4444-4444-8444-4444444444a2', '00000000-0000-0000-0000-0000000004a2', 'My personal comment');
insert into public.inquiries (startup_id, sender_id, sender_name, sender_email, subject, message) values
  ('44444444-4444-4444-8444-444444444453', '00000000-0000-0000-0000-0000000004a2', 'Vic Deleter', 'v@test.dev', 'Hello', 'A message from the person leaving');
set role authenticated; select pg_temp.act_as('00000000-0000-0000-0000-0000000004a2') \gset
select pg_temp.expect_err($q$select public.prepare_account_deletion(auth.uid())$q$, 'permission denied');
reset role; set role service_role;
do $$ declare r jsonb; begin
  r := public.prepare_account_deletion('00000000-0000-0000-0000-0000000004a2');
  assert (r ->> 'blocked')::boolean, 'deletion is blocked while the person is the only owner of a startup that has other members';
  assert r -> 'startups' -> 0 ->> 'name' = 'Shared Venture', 'the blocker names the startup';
  assert jsonb_array_length(r -> 'startups') = 1, 'only genuine blockers are listed';
end $$;
reset role;
do $$ begin assert (select count(*) from public.startup_members where user_id = '00000000-0000-0000-0000-0000000004a2') = 3, 'a blocked request changes nothing'; end $$;
update public.startup_members set role = 'owner' where startup_id = '44444444-4444-4444-8444-444444444452' and user_id = '00000000-0000-0000-0000-0000000004c1';
set role service_role;
do $$ begin assert not (public.prepare_account_deletion('00000000-0000-0000-0000-0000000004a2') ->> 'blocked')::boolean, 'deletion proceeds once ownership is shared'; end $$;
reset role;
do $$ begin
  assert (select status || '/' || coalesce(created_by::text, 'null') from public.startups where slug = 'solo-venture') = 'unpublished/null', 'a startup the person ran alone is unpublished, kept and unowned';
  assert (select count(*) from public.startup_members where startup_id = '44444444-4444-4444-8444-444444444451') = 0, 'with no members left';
  assert (select count(*) from public.startups where slug in ('shared-venture', 'co-owned-venture')) = 2, 'shared companies survive';
  assert (select count(*) from public.startup_members where user_id = '00000000-0000-0000-0000-0000000004a2') = 0, 'the person holds no memberships';
  assert (select status from public.comments where id = '44444444-4444-4444-8444-4444444444b1') = 'deleted', 'comments are removed';
  assert (select status || '/' || coalesce(submitted_by::text, 'null') from public.launches where slug = 'v-solo-launch') = 'removed/null', 'a launch without a startup is removed';
  assert (select status || '/' || coalesce(submitted_by::text, 'null') from public.launches where slug = 'v-co-launch') = 'published/null', 'a startup-backed launch stays, detached from the person';
  assert (select sender_name || sender_email from public.inquiries where subject = 'Hello' and startup_id = '44444444-4444-4444-8444-444444444453') = 'Deleted userdeleted@invalid.example', 'inquiries are anonymised';
  assert (select count(*) from public.audit_logs where action = 'account.delete' and entity_id = '00000000-0000-0000-0000-0000000004a2') = 1, 'deletion is audited';
end $$;
delete from auth.users where id = '00000000-0000-0000-0000-0000000004a2';
do $$ begin
  assert (select count(*) from public.profiles where id = '00000000-0000-0000-0000-0000000004a2') = 0, 'auth deletion cascades the profile';
  assert (select vote_count from public.launches where slug = 'v-co-launch') = 0, 'their vote disappears and the counter follows';
  assert (select count(*) from public.launches where slug = 'v-co-launch') = 1, 'the launch itself is untouched';
end $$;

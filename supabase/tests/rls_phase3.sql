-- Phase 3 checks: launches, moderation, scheduling, trending, comments, notifications, follows, media.
\set ON_ERROR_STOP on
set search_path = "$user", public, extensions;

-- start from a clean slate for community data left behind by earlier suites
delete from public.launches;
delete from public.notifications;
delete from public.reports;

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000f1', 'f@test.dev', now(), '{"display_name":"Fiona Maker"}'),
  ('00000000-0000-0000-0000-0000000000a1', 'g@test.dev', now(), '{"display_name":"Gabe Voter"}'),
  ('00000000-0000-0000-0000-0000000000b1', 'h@test.dev', now(), '{}'),
  ('00000000-0000-0000-0000-0000000000c1', 'i@test.dev', null, '{}'),
  ('00000000-0000-0000-0000-0000000000c2', 'j1@test.dev', now(), '{}'),
  ('00000000-0000-0000-0000-0000000000c3', 'j2@test.dev', now(), '{}'),
  ('00000000-0000-0000-0000-0000000000c4', 'j3@test.dev', now(), '{}');
update public.profiles set role = 'moderator' where id = '00000000-0000-0000-0000-0000000000b1';

create or replace function pg_temp.act_as(p_uid text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', coalesce(p_uid, ''), false); end $$;

-- ===== F drafts launches =====
set role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000f1') \gset
insert into public.launches (slug, name, tagline, product_url, submitted_by, category_id, description, tags)
values ('alpha-app', 'Alpha App', 'An app for alphas', 'https://alpha.example', '00000000-0000-0000-0000-0000000000f1',
        (select id from public.categories where slug = 'fintech'), 'About alpha', array['payments', 'mobile']);
insert into public.launches (slug, name, tagline, product_url, submitted_by)
values ('incomplete-app', 'Incomplete', 'Nothing yet here', 'https://inc.example', '00000000-0000-0000-0000-0000000000f1');

do $$ begin
  begin update public.launches set status = 'published' where slug = 'alpha-app'; raise exception 'FAIL: status writable';
  exception when insufficient_privilege then null; end;
  begin update public.launches set is_featured = true where slug = 'alpha-app'; raise exception 'FAIL: is_featured writable';
  exception when insufficient_privilege then null; end;
  begin update public.launches set vote_count = 50 where slug = 'alpha-app'; raise exception 'FAIL: vote_count writable';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.launches (slug, name, tagline, product_url, submitted_by)
    values ('forged-app', 'Forged', 'Pretending to be G', 'https://x.example', '00000000-0000-0000-0000-0000000000a1');
    raise exception 'FAIL: launch created as another user';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.launches (slug, name, tagline, product_url, submitted_by) values ('bad-url', 'Bad', 'Bad url here', 'javascript:alert(1)', '00000000-0000-0000-0000-0000000000f1');
    raise exception 'FAIL: javascript: product url accepted';
  exception when check_violation then null; end;
  begin perform public.submit_launch((select id from public.launches where slug = 'incomplete-app')); raise exception 'FAIL: incomplete launch submitted';
  exception when check_violation then null; end;
end $$;

-- G cannot edit or submit F's draft; drafts are invisible to others
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1') \gset
do $$ declare n int; begin
  update public.launches set name = 'Hacked' where slug = 'alpha-app'; get diagnostics n = row_count;
  assert n = 0, 'G cannot edit F draft';
  assert (select count(*) from public.launches where slug = 'alpha-app') = 0, 'draft hidden from others';
  begin perform public.submit_launch((select id from public.launches where slug = 'alpha-app' union all select id from public.launches where false limit 1));
  exception when others then null; end;
end $$;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000f1') \gset
select public.submit_launch((select id from public.launches where slug = 'alpha-app')) \gset
do $$ begin
  assert (select status from public.launches where slug = 'alpha-app') = 'pending_review', 'submission waits for review by default';
  begin perform public.submit_launch((select id from public.launches where slug = 'alpha-app')); raise exception 'FAIL: resubmitting a pending launch';
  exception when sqlstate '55000' then null; end;
end $$;

-- pending launches are invisible to the public; G (non-staff) cannot moderate
reset role; set role anon; select pg_temp.act_as('') \gset
do $$ begin assert (select count(*) from public.launches where slug = 'alpha-app') = 0, 'pending launch hidden from visitors'; end $$;
reset role; set role authenticated; select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1') \gset
do $$ begin
  begin perform public.moderate_launch((select id from public.launches limit 1), 'approve'); raise exception 'FAIL: non-staff moderated';
  exception when insufficient_privilege then null; end;
end $$;

-- H (moderator) approves; maker is notified; audit trail written
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1') \gset
do $$ begin
  assert (select count(*) from public.launches where slug = 'alpha-app') = 1, 'moderator can see pending launch';
  assert public.moderate_launch((select id from public.launches where slug = 'alpha-app'), 'approve') = 'published', 'approved launch goes live';
  begin perform public.moderate_launch((select id from public.launches where slug = 'alpha-app'), 'approve'); raise exception 'FAIL: double approval';
  exception when sqlstate '55000' then null; end;
  begin perform public.moderate_launch((select id from public.launches where slug = 'alpha-app'), 'explode'); raise exception 'FAIL: unknown action';
  exception when sqlstate '22023' then null; end;
end $$;
reset role;
do $$ begin
  assert (select count(*) from public.notifications where user_id = '00000000-0000-0000-0000-0000000000f1' and type = 'launch_approved') = 1, 'maker notified of approval';
  assert (select email_status from public.notifications where type = 'launch_approved') = 'pending', 'approval email queued (preference on)';
  assert (select count(*) from public.audit_logs where action = 'launch.approve' and actor_id = '00000000-0000-0000-0000-0000000000b1') = 1, 'approval audited';
end $$;

-- rejection needs a note, notifies the maker, and the maker can fix and resubmit
set role authenticated; select pg_temp.act_as('00000000-0000-0000-0000-0000000000f1') \gset
insert into public.launches (slug, name, tagline, product_url, submitted_by, category_id, description)
values ('delta-app', 'Delta App', 'Delta does deltas', 'https://delta.example', '00000000-0000-0000-0000-0000000000f1', (select id from public.categories where slug = 'edtech'), 'About delta');
select public.submit_launch((select id from public.launches where slug = 'delta-app')) \gset
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1') \gset
do $$ begin
  begin perform public.moderate_launch((select id from public.launches where slug = 'delta-app'), 'reject'); raise exception 'FAIL: rejected without note';
  exception when check_violation then null; end;
  assert public.moderate_launch((select id from public.launches where slug = 'delta-app'), 'reject', 'Please describe what it does') = 'rejected';
end $$;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000f1') \gset
do $$ begin
  assert (select moderation_note from public.launches where slug = 'delta-app') = 'Please describe what it does', 'maker sees the moderation note';
  assert (select count(*) from public.notifications where type = 'launch_rejected') = 1, 'maker notified of rejection';
  assert public.submit_launch((select id from public.launches where slug = 'delta-app')) = 'pending_review', 'rejected launch can be resubmitted';
end $$;

-- ===== votes: counted, locked, restricted =====
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1') \gset
insert into public.launch_votes (launch_id, user_id) values ((select id from public.launches where slug = 'alpha-app'), '00000000-0000-0000-0000-0000000000a1');
do $$ begin
  begin insert into public.launch_votes (launch_id, user_id) values ((select id from public.launches where slug = 'alpha-app'), '00000000-0000-0000-0000-0000000000a1');
    raise exception 'FAIL: duplicate vote'; exception when unique_violation then null; end;
  begin insert into public.launch_votes (launch_id, user_id) values ((select id from public.launches where slug = 'delta-app'), '00000000-0000-0000-0000-0000000000a1');
    raise exception 'FAIL: voted on a launch that is not published'; exception when insufficient_privilege then null; end;
end $$;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1') \gset
do $$ begin
  begin insert into public.launch_votes (launch_id, user_id) values ((select id from public.launches where slug = 'alpha-app'), '00000000-0000-0000-0000-0000000000c1');
    raise exception 'FAIL: unverified user voted'; exception when insufficient_privilege then null; end;
end $$;

-- ===== trending decays old votes; lifetime ranking differs =====
reset role;
insert into public.launches (slug, name, tagline, product_url, status, published_at, submitted_by, category_id, tags)
values ('beta-app', 'Beta App', 'The beta of betas', 'https://beta.example', 'published', now() - interval '6 days', '00000000-0000-0000-0000-0000000000f1',
        (select id from public.categories where slug = 'agritech'), array['farming']);
insert into public.launch_votes (launch_id, user_id, created_at)
select (select id from public.launches where slug = 'beta-app'), u, now() - interval '5 days'
from unnest(array['00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-0000000000c4']::uuid[]) u;
do $$ declare ids uuid[]; begin
  select array_agg(id order by ord) into ids from (select id, row_number() over () ord from public.list_launches('trending', null, null, null, null, 10, 0)) t;
  assert (select slug from public.launches where id = ids[1]) = 'alpha-app', 'trending: 1 fresh vote beats 3 votes from 5 days ago';
  select array_agg(id order by ord) into ids from (select id, row_number() over () ord from public.list_launches('top', null, null, null, null, 10, 0)) t;
  assert (select slug from public.launches where id = ids[1]) = 'beta-app', 'top: lifetime votes rank first';
  select array_agg(id order by ord) into ids from (select id, row_number() over () ord from public.list_launches('latest', null, null, null, null, 10, 0)) t;
  assert (select slug from public.launches where id = ids[1]) = 'alpha-app', 'latest: newest first';
  assert (select score from public.list_launches('trending', null, null, null, null, 10, 0) l join public.launches x on x.id = l.id where x.slug = 'beta-app') < 0.2, 'old votes carry little weight';
end $$;
-- filters, search and pagination
do $$ declare t1 uuid; t2 uuid; tot bigint; begin
  assert (select count(*) from public.list_launches('latest', (select id from public.categories where slug = 'agritech'), null, null, null, 10, 0)) = 1, 'category filter';
  assert (select count(*) from public.list_launches('latest', null, 'payments', null, null, 10, 0)) = 1, 'tag filter';
  assert (select count(*) from public.list_launches('latest', null, null, 'beta', null, 10, 0)) = 1, 'search by name';
  assert (select count(*) from public.list_launches('latest', null, null, 'betas', null, 10, 0)) = 1, 'full-text search over the tagline';
  assert (select count(*) from public.list_launches('latest', null, null, '%', null, 10, 0)) = 0, 'wildcards are not special in search';
  assert (select count(*) from public.list_launches('latest', null, null, null, now() - interval '2 days', 10, 0)) = 1, 'period filter';
  select id into t1 from public.list_launches('latest', null, null, null, null, 1, 0);
  select id, total into t2, tot from public.list_launches('latest', null, null, null, null, 1, 1);
  assert t1 <> t2 and tot = 2, 'pagination returns different rows and the real total';
  assert (select count(*) from public.list_launches('featured', null, null, null, null, 10, 0)) = 0, 'featured list is empty until something is featured';
end $$;
-- anyone can list; featuring requires staff
reset role; set role anon; select pg_temp.act_as('') \gset
do $$ begin assert (select count(*) from public.list_launches('trending', null, null, null, null, 10, 0)) = 2, 'visitors can list launches'; end $$;
reset role; set role authenticated; select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1') \gset
select public.moderate_launch((select id from public.launches where slug = 'alpha-app'), 'feature') \gset
reset role;
do $$ begin assert (select count(*) from public.list_launches('featured', null, null, null, null, 10, 0)) = 1, 'featured list shows featured launches'; end $$;

-- ===== scheduling =====
set role authenticated; select pg_temp.act_as('00000000-0000-0000-0000-0000000000f1') \gset
insert into public.launches (slug, name, tagline, product_url, submitted_by, category_id, description, launch_date)
values ('gamma-app', 'Gamma App', 'Coming soon to a screen', 'https://gamma.example', '00000000-0000-0000-0000-0000000000f1',
        (select id from public.categories where slug = 'gaming'), 'About gamma', current_date + 3);
select public.submit_launch((select id from public.launches where slug = 'gamma-app')) \gset
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1') \gset
do $$ begin assert public.moderate_launch((select id from public.launches where slug = 'gamma-app'), 'approve') = 'scheduled', 'future launch date schedules instead of publishing'; end $$;
reset role; set role anon; select pg_temp.act_as('') \gset
do $$ begin
  assert (select count(*) from public.launches where slug = 'gamma-app') = 1, 'scheduled launch is publicly visible as upcoming';
  assert (select count(*) from public.list_launches('upcoming', null, null, null, null, 10, 0)) = 1, 'upcoming list';
  assert (select count(*) from public.list_launches('trending', null, null, null, null, 10, 0)) = 2, 'scheduled launches are not in trending';
end $$;
reset role; set role authenticated; select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1') \gset
do $$ begin
  begin insert into public.launch_votes (launch_id, user_id) values ((select id from public.launches where slug = 'gamma-app'), '00000000-0000-0000-0000-0000000000a1');
    raise exception 'FAIL: voted on an upcoming launch'; exception when insufficient_privilege then null; end;
end $$;
reset role; set role service_role;
do $$ begin assert public.publish_due_launches() = 0, 'nothing due yet'; end $$;
reset role;
update public.launches set launch_date = current_date - 1 where slug = 'gamma-app';
set role service_role;
do $$ begin
  assert public.publish_due_launches() = 1, 'due launch is published';
  assert (select status from public.launches where slug = 'gamma-app') = 'published';
end $$;
reset role;
do $$ begin assert (select count(*) from public.notifications where dedupe_key like 'launch:%:live') = 1, 'maker told when a scheduled launch goes live'; end $$;

-- ===== comments, replies, notifications =====
set role authenticated; select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1') \gset
insert into public.comments (launch_id, author_id, body) values ((select id from public.launches where slug = 'alpha-app'), '00000000-0000-0000-0000-0000000000a1', 'Love this');
select pg_temp.act_as('00000000-0000-0000-0000-0000000000f1') \gset
insert into public.comments (launch_id, author_id, parent_id, body)
values ((select id from public.launches where slug = 'alpha-app'), '00000000-0000-0000-0000-0000000000f1', (select id from public.comments where body = 'Love this'), 'Thanks Gabe!');
insert into public.comments (launch_id, author_id, body) values ((select id from public.launches where slug = 'alpha-app'), '00000000-0000-0000-0000-0000000000f1', 'A note from the maker');
do $$ declare n int; begin
  begin insert into public.comments (launch_id, author_id, parent_id, body)
    values ((select id from public.launches where slug = 'alpha-app'), '00000000-0000-0000-0000-0000000000f1', (select id from public.comments where body = 'Thanks Gabe!'), 'nested too deep');
    raise exception 'FAIL: reply to a reply accepted'; exception when check_violation then null; end;
  begin insert into public.comments (launch_id, author_id, parent_id, body)
    values ((select id from public.launches where slug = 'beta-app'), '00000000-0000-0000-0000-0000000000f1', (select id from public.comments where body = 'Love this'), 'wrong thread');
    raise exception 'FAIL: reply across launches accepted'; exception when check_violation then null; end;
  begin insert into public.comments (launch_id, author_id, body) values ((select id from public.launches where slug = 'alpha-app'), '00000000-0000-0000-0000-0000000000f1', '   ');
    raise exception 'FAIL: blank comment accepted'; exception when check_violation then null; end;
  update public.comments set body = 'tampered' where body = 'Love this'; get diagnostics n = row_count;
  assert n = 0, 'F cannot edit G comment';
end $$;
reset role;
do $$ begin
  assert (select comment_count from public.launches where slug = 'alpha-app') = 3, 'comment_count counts every visible comment';
  assert (select count(*) from public.notifications where user_id = '00000000-0000-0000-0000-0000000000f1' and type = 'comment') = 1, 'maker notified of G comment (not of their own)';
  assert (select count(*) from public.notifications where user_id = '00000000-0000-0000-0000-0000000000a1' and type = 'reply') = 1, 'G notified of the reply';
  assert (select email_status from public.notifications where type = 'reply') = 'pending', 'reply email queued';
end $$;
-- G edits and then deletes their comment; the reply survives under a placeholder
set role authenticated; select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1') \gset
update public.comments set body = 'Love this a lot', edited_at = now() where body = 'Love this';
do $$ begin assert (select count(*) from public.comments where body = 'Love this a lot') = 1, 'author can edit own comment'; end $$;
reset role; set role anon; select pg_temp.act_as('') \gset
do $$ begin assert (select count(*) from public.get_launch_comments((select id from public.launches where slug = 'alpha-app'))) = 3, 'visitors read the whole thread'; end $$;
reset role; set role authenticated; select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1') \gset
update public.comments set status = 'deleted' where body = 'Love this a lot';
reset role; set role anon; select pg_temp.act_as('') \gset
do $$ declare r record; begin
  select * into r from public.get_launch_comments((select id from public.launches where slug = 'alpha-app')) where parent_id is null and status = 'deleted';
  assert found and r.body is null and r.author_id is null, 'deleted comment with replies becomes an anonymous placeholder';
  assert (select count(*) from public.get_launch_comments((select id from public.launches where slug = 'alpha-app'))) = 3, 'thread structure preserved';
  assert (select count(*) from public.comments where status = 'deleted') = 0, 'deleted comments are not directly readable';
  assert (select count(*) from public.get_launch_comments((select id from public.launches where slug = 'delta-app'))) = 0, 'no comments exposed for launches that are not public';
end $$;
reset role;
do $$ begin assert (select comment_count from public.launches where slug = 'alpha-app') = 2, 'comment_count drops when a comment is deleted'; end $$;
-- preference off → in-app only
update public.notification_preferences set email_comments = false where user_id = '00000000-0000-0000-0000-0000000000f1';
set role authenticated; select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1') \gset
insert into public.comments (launch_id, author_id, body) values ((select id from public.launches where slug = 'alpha-app'), '00000000-0000-0000-0000-0000000000a1', 'Second thought');
reset role;
do $$ begin
  assert (select count(*) from public.notifications where user_id = '00000000-0000-0000-0000-0000000000f1' and type = 'comment') = 2, 'in-app notification still created';
  assert (select count(*) from public.notifications where user_id = '00000000-0000-0000-0000-0000000000f1' and type = 'comment' and email_status is null) = 1, 'email not queued when the preference is off';
end $$;

-- ===== notification privacy and the email outbox =====
set role authenticated; select pg_temp.act_as('00000000-0000-0000-0000-0000000000f1') \gset
do $$ begin
  assert (select count(*) from public.notifications) >= 3 and (select count(*) from public.notifications where user_id <> auth.uid()) = 0, 'users only see their own notifications';
  begin perform email_status from public.notifications; raise exception 'FAIL: email internals readable'; exception when insufficient_privilege then null; end;
  begin perform public.create_notification(auth.uid(), 'x', 't', null, null, 'k', null); raise exception 'FAIL: client created a notification'; exception when insufficient_privilege then null; end;
  begin perform * from public.claim_notification_emails(5); raise exception 'FAIL: client claimed emails'; exception when insufficient_privilege then null; end;
  update public.notifications set read_at = now() where type = 'launch_approved';
  assert (select count(*) from public.notifications where read_at is not null) >= 1, 'users can mark their notifications read';
end $$;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1') \gset
do $$ declare n int; begin
  update public.notifications set read_at = now() where user_id = '00000000-0000-0000-0000-0000000000f1'; get diagnostics n = row_count;
  assert n = 0, 'cannot touch someone else''s notifications';
end $$;
reset role;
select public.create_notification('00000000-0000-0000-0000-0000000000f1', 't', 'Same', null, null, 'dedupe-1', null),
       public.create_notification('00000000-0000-0000-0000-0000000000f1', 't', 'Same', null, null, 'dedupe-1', null) \gset
do $$ begin assert (select count(*) from public.notifications where dedupe_key = 'dedupe-1') = 1, 'retried notification is idempotent'; end $$;
set role service_role;
do $$ declare r record; n int := 0; begin
  for r in select * from public.claim_notification_emails(50) loop
    n := n + 1;
    assert r.email like '%@test.dev' and r.attempts = 1, 'claim returns the address and counts the attempt';
    perform public.finish_notification_email(r.id, case when n % 2 = 0 then 'sent' else 'failed' end::public.email_delivery_status, case when n % 2 = 0 then null else 'boom' end);
  end loop;
  assert n >= 3, 'queued emails were claimed';
  assert (select count(*) from public.claim_notification_emails(50)) = n - n / 2, 'sent rows are not claimed again; failed rows are retried';
end $$;
reset role;
update public.notifications set email_attempts = 5 where email_status = 'failed';
set role service_role;
do $$ begin assert (select count(*) from public.claim_notification_emails(50)) = 0, 'retries stop after 5 attempts'; end $$;
reset role;

-- ===== follows =====
set role authenticated; select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1') \gset
insert into public.follows (follower_id, target_type, target_id) values
  ('00000000-0000-0000-0000-0000000000a1', 'user', '00000000-0000-0000-0000-0000000000f1'),
  ('00000000-0000-0000-0000-0000000000a1', 'startup', (select id from public.startups limit 1));
do $$ begin
  begin insert into public.follows (follower_id, target_type, target_id) values ('00000000-0000-0000-0000-0000000000a1', 'user', '00000000-0000-0000-0000-0000000000f1');
    raise exception 'FAIL: duplicate follow'; exception when unique_violation then null; end;
  begin insert into public.follows (follower_id, target_type, target_id) values ('00000000-0000-0000-0000-0000000000a1', 'user', '00000000-0000-0000-0000-0000000000a1');
    raise exception 'FAIL: self follow'; exception when check_violation then null; end;
  begin insert into public.follows (follower_id, target_type, target_id) values ('00000000-0000-0000-0000-0000000000f1', 'user', '00000000-0000-0000-0000-0000000000a1');
    raise exception 'FAIL: following as someone else'; exception when insufficient_privilege then null; end;
end $$;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000f1') \gset
do $$ begin assert (select count(*) from public.follows) = 0, 'follow lists are private'; end $$;
reset role; set role anon; select pg_temp.act_as('') \gset
do $$ begin assert public.follower_count('user', '00000000-0000-0000-0000-0000000000f1') = 1, 'follower counts are public'; end $$;
reset role;

-- ===== launch screenshots and storage =====
set role authenticated; select pg_temp.act_as('00000000-0000-0000-0000-0000000000f1') \gset
insert into public.launch_media (launch_id, storage_path, url, alt_text) values ((select id from public.launches where slug = 'alpha-app'), 'p0', 'https://example.com/0.png', 'Home screen');
do $$ declare i int; lid uuid := (select id from public.launches where slug = 'alpha-app'); begin
  for i in 1..5 loop insert into public.launch_media (launch_id, storage_path, url) values (lid, 'p' || i, 'https://example.com/' || i); end loop;
  begin insert into public.launch_media (launch_id, storage_path, url) values (lid, 'p6', 'https://example.com/6'); raise exception 'FAIL: 7th screenshot';
  exception when program_limit_exceeded then null; end;
  insert into storage.objects (bucket_id, name) values ('launch-media', lid::text || '/shot.png');
  begin insert into storage.objects (bucket_id, name) values ('launch-media', 'junk/shot.png'); raise exception 'FAIL: junk folder';
  exception when insufficient_privilege then null; end;
end $$;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1') \gset
do $$ declare lid uuid := (select id from public.launches where slug = 'alpha-app'); begin
  begin insert into public.launch_media (launch_id, storage_path, url) values (lid, 'x', 'https://evil.example/x.png'); raise exception 'FAIL: stranger added media';
  exception when insufficient_privilege then null; end;
  begin insert into storage.objects (bucket_id, name) values ('launch-media', lid::text || '/evil.png'); raise exception 'FAIL: stranger uploaded to launch folder';
  exception when insufficient_privilege then null; end;
  assert (select count(*) from public.launch_media where launch_id = lid) = 6, 'screenshots of public launches are readable';
end $$;
reset role; set role anon; select pg_temp.act_as('') \gset
do $$ begin assert (select count(*) from public.launch_media) = 6, 'visitors see screenshots of public launches only'; end $$;
reset role;

-- ===== reporting a comment =====
set role authenticated; select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1') \gset
insert into public.reports (reporter_id, target_type, target_id, reason)
values ('00000000-0000-0000-0000-0000000000a1', 'comment', (select id from public.comments where body = 'A note from the maker'), 'abusive');
reset role;
do $$ begin assert (select count(*) from public.reports where target_type = 'comment') = 1, 'comment report stored'; end $$;

-- ===== suspended makers cannot submit =====
update public.profiles set is_suspended = true where id = '00000000-0000-0000-0000-0000000000f1';
set role authenticated; select pg_temp.act_as('00000000-0000-0000-0000-0000000000f1') \gset
do $$ begin
  begin perform public.submit_launch((select id from public.launches where slug = 'delta-app')); raise exception 'FAIL: suspended submit';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

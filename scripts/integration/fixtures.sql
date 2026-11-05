-- Integration fixtures (local only). Runs after migrations + demo seed.
insert into auth.users (id, email, email_confirmed_at) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'owner@test.dev', now()),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'stranger@test.dev', now());
update public.profiles set display_name = 'Olivia Owner', username = 'olivia', is_public_profile = true where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

-- a real (non-demo) published startup owned by Olivia, with children and a public team member
insert into public.startups (id, name, slug, created_by, tagline, description, country, city, category_id, stage, founded_year, website_url, status, published_at, tags)
values ('11111111-1111-4111-8111-111111111111', 'Owner Works', 'owner-works', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'We make owner things', E'First paragraph about owner works.\n\nSecond paragraph.', 'ET', 'Addis Ababa',
  (select id from public.categories where slug = 'fintech'), 'mvp', 2024, 'https://owner.example', 'published', now(), array['payments']);
update public.startup_members set public_title = 'Founder' where startup_id = '11111111-1111-4111-8111-111111111111';
insert into public.startup_products (startup_id, name, description, url) values
  ('11111111-1111-4111-8111-111111111111', 'Owner App', 'The app', 'https://owner.example/app');
insert into public.startup_links (startup_id, kind, url) values
  ('11111111-1111-4111-8111-111111111111', 'github', 'https://github.com/owner-works');
insert into public.startup_media (startup_id, storage_path, url, alt_text) values
  ('11111111-1111-4111-8111-111111111111', 'p', 'https://example.com/shot.png', 'Dashboard screenshot');

-- Olivia's private draft, and a published startup that Olivia does NOT manage
insert into public.startups (id, name, slug, created_by, tagline) values
  ('22222222-2222-4222-8222-222222222222', 'Secret Draft Labs', 'secret-draft', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Hidden for now');
insert into public.startups (id, name, slug, created_by, tagline, description, country, category_id, status, published_at) values
  ('33333333-3333-4333-8333-333333333333', 'Stranger Co', 'stranger-co', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 't', 'd', 'KE',
   (select id from public.categories where slug = 'edtech'), 'published', now());
-- unpublished startup must stay out of listings
insert into public.startups (name, slug, created_by, tagline, status) values
  ('Gone Dark', 'gone-dark', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Was public once', 'unpublished');
-- filler so pagination has two pages (8 demo + 2 real + 10 pads = 20 published)
insert into public.startups (name, slug, tagline, description, country, category_id, status, published_at, created_by)
select 'Pad ' || lpad(i::text, 2, '0'), 'pad-' || lpad(i::text, 2, '0'), 'Filler startup ' || i, 'd', 'GH',
       (select id from public.categories where slug = 'gaming'), 'published', now() - make_interval(days => 100 + i), null
from generate_series(1, 10) i;

-- ====================== Phase 3 fixtures ======================
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'mod@test.dev', now(), '{"display_name":"Mia Moderator"}'),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'voter@test.dev', now(), '{"display_name":"Vera Voter"}'),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'unverified@test.dev', null, '{"display_name":"Una Unverified"}');
update public.profiles set role = 'moderator', username = 'mia-mod' where id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
update public.profiles set username = 'vera' where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
update public.profiles set is_public_profile = false where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
update public.profiles set username = 'stan' where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

insert into public.launches (id, slug, name, tagline, description, product_url, startup_id, category_id, tags, status, published_at, launch_date, submitted_by) values
  ('a0000000-0000-4000-8000-000000000001', 'owner-launch', 'Owner Launch', 'Payments for owners', E'First launch paragraph.\n\nSecond launch paragraph.', 'https://owner.example/launch',
   '11111111-1111-4111-8111-111111111111', (select id from public.categories where slug = 'fintech'), array['payments'], 'published', now() - interval '1 hour', current_date, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  ('a0000000-0000-4000-8000-000000000002', 'old-favourite', 'Old Favourite', 'Loved last week', 'Old but gold', 'https://old.example',
   null, (select id from public.categories where slug = 'edtech'), array['classics'], 'published', now() - interval '6 days', current_date - 6, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
insert into public.launches (id, slug, name, tagline, description, product_url, category_id, status, submitted_by) values
  ('a0000000-0000-4000-8000-000000000003', 'draft-launch', 'Draft Launch', 'Still a draft here', null, 'https://draft.example', null, 'draft', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  ('a0000000-0000-4000-8000-000000000004', 'pending-launch', 'Pending Launch', 'Waiting for review', 'Pending description', 'https://pending.example', (select id from public.categories where slug = 'edtech'), 'pending_review', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
insert into public.launches (id, slug, name, tagline, description, product_url, category_id, status, launch_date, submitted_by) values
  ('a0000000-0000-4000-8000-000000000005', 'soon-launch', 'Soon Launch', 'Coming in a few days', 'Soon', 'https://soon.example', (select id from public.categories where slug = 'gaming'), 'scheduled', current_date + 5, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  ('a0000000-0000-4000-8000-000000000006', 'due-launch', 'Due Launch', 'Should go live by cron', 'Due', 'https://due.example', (select id from public.categories where slug = 'gaming'), 'scheduled', current_date - 1, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
insert into public.launch_media (launch_id, storage_path, url, alt_text) values ('a0000000-0000-4000-8000-000000000001', 'p', 'https://example.com/launch.png', 'Launch screenshot');
-- three old votes make Old Favourite popular but stale
insert into public.launch_votes (launch_id, user_id, created_at) values
  ('a0000000-0000-4000-8000-000000000002', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', now() - interval '5 days'),
  ('a0000000-0000-4000-8000-000000000002', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', now() - interval '5 days'),
  ('a0000000-0000-4000-8000-000000000002', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', now() - interval '5 days');
-- filler so the launch feed paginates (published, spread over time)
insert into public.launches (slug, name, tagline, description, product_url, category_id, tags, status, published_at, submitted_by)
select 'filler-launch-' || lpad(i::text, 2, '0'), 'Filler Launch ' || lpad(i::text, 2, '0'), 'Filler launch number ' || i, 'd', 'https://filler.example',
       (select id from public.categories where slug = 'gaming'), array['filler'], 'published', now() - make_interval(days => 40 + i), 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
from generate_series(1, 10) i;
-- an existing comment by Stan on the owner's launch (creates the first notification for Olivia)
insert into public.comments (launch_id, author_id, body) values ('a0000000-0000-4000-8000-000000000001', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Great launch from Stan');


-- ====================== Phase 4 fixtures ======================
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('ffffffff-ffff-4fff-8fff-ffffffffffff', 'admin@test.dev', now(), '{"display_name":"Ada Admin"}'),
  ('99999999-9999-4999-8999-999999999991', 'dora@test.dev', now(), '{"display_name":"Dora Deleter"}'),
  ('99999999-9999-4999-8999-999999999992', 'carl@test.dev', now(), '{"display_name":"Carl Colleague"}');
update public.profiles set role = 'admin', username = 'ada-admin' where id = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
update public.profiles set username = 'dora' where id = '99999999-9999-4999-8999-999999999991';
update public.profiles set username = 'carl' where id = '99999999-9999-4999-8999-999999999992';

-- founders: Olivia is listed with open_to; 13 fillers make the directory paginate; Vera stays unlisted
update public.profiles set is_public_profile = true, is_discoverable_founder = true, show_location = true, country = 'ET', city = 'Addis Ababa',
  headline = 'Building payments in Ethiopia', expertise = array['payments'], interests = array['fintech'], open_to = array['mentoring', 'advice']
  where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
insert into auth.users (id, email, email_confirmed_at)
select ('77777777-7777-4777-8777-0000000000' || lpad(i::text, 2, '0'))::uuid, 'filler' || i || '@test.dev', now() from generate_series(1, 13) i;
update public.profiles set display_name = 'Filler Founder ' || lpad(substr(id::text, 35, 2), 2, '0'), username = 'filler-' || substr(id::text, 35, 2),
  is_public_profile = true, is_discoverable_founder = true, show_location = true, country = 'KE', headline = 'Filler headline'
  where id::text like '77777777-7777-4777-8777-0000000000%';

-- opportunities (the demo seed adds five more)
insert into public.opportunities (slug, title, organization, description, category, eligibility, countries, deadline, application_url, source_url, published_date, last_checked_at, status, tags, created_by) values
  ('real-grant', 'Real Seed Grant', 'Seed Org', E'Funding for early teams.\n\nSecond paragraph.', 'grant', 'Early-stage teams', array['ET', 'KE'], now() + interval '20 days', 'https://apply.example/seed', 'https://source.example/seed', current_date - 3, now() - interval '1 day', 'published', array['funding'], null),
  ('stale-closed', 'Stale Closed Programme', 'Old Org', 'Deadline has passed but the nightly job has not run.', 'accelerator', null, '{}', now() - interval '2 days', 'https://apply.example/old', 'https://source.example/old', current_date - 30, now() - interval '40 days', 'published', '{}', null),
  ('draft-opportunity', 'Draft Opportunity', 'Draft Org', null, 'event', null, '{}', null, null, null, null, null, 'draft', '{}', null),
  ('archived-opportunity', 'Archived Opportunity', 'Old Org', null, 'job', null, '{}', null, null, 'https://source.example/a', null, null, 'archived', '{}', null);
insert into public.opportunities (slug, title, organization, description, category, countries, deadline, source_url, status, last_checked_at)
select 'filler-opportunity-' || lpad(i::text, 2, '0'), 'Filler Opportunity ' || lpad(i::text, 2, '0'), 'Filler Org', 'd', 'event', '{}', now() + make_interval(days => 30 + i), 'https://source.example/f', 'published', now()
from generate_series(1, 12) i;
insert into public.investors (slug, name, description, country, stages, sectors, verification_status, is_published) values
  ('real-fund', 'Real Fund', 'A publicly described fund.', 'ET', array['mvp']::public.startup_stage[], array['fintech'], 'unverified', true),
  ('hidden-fund', 'Hidden Fund', 'Not published.', 'KE', array['idea']::public.startup_stage[], array['agritech'], 'unverified', false);

-- Dora (account deletion scenarios): sole owner of a startup that also has Carl as a viewer; plus a solo startup and a comment
insert into public.startups (id, name, slug, created_by, tagline, description, country, status, published_at) values
  ('55555555-5555-4555-8555-555555555551', 'Dora Shared', 'dora-shared', '99999999-9999-4999-8999-999999999991', 't', 'd', 'ET', 'published', now()),
  ('55555555-5555-4555-8555-555555555552', 'Dora Solo', 'dora-solo', '99999999-9999-4999-8999-999999999991', 't', 'd', 'ET', 'published', now());
insert into public.startup_members (startup_id, user_id, role) values ('55555555-5555-4555-8555-555555555551', '99999999-9999-4999-8999-999999999992', 'viewer');
insert into public.comments (launch_id, author_id, body) values ('a0000000-0000-4000-8000-000000000001', '99999999-9999-4999-8999-999999999991', 'Dora was here');

-- ====================== Phase 5 fixtures ======================
-- a startup waiting for review (owner: Stan), a pending verification request for Owner Works, reports on a comment and a user
insert into public.startups (id, name, slug, created_by, tagline, description, country, category_id, status) values
  ('66666666-6666-4666-8666-666666666661', 'Pending Co', 'pending-co', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Waiting for review', 'A startup in the queue', 'KE', (select id from public.categories where slug = 'edtech'), 'pending_review');
insert into public.verification_requests (startup_id, requested_by, notes, evidence_paths) values
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Registered in Ethiopia, registry number 12345; website shows our names.', '{}');
insert into public.reports (reporter_id, target_type, target_id, reason, details)
select r, 'comment', c.id, 'abusive', 'rude' from public.comments c, unnest(array['dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc']::uuid[]) r where c.body = 'Great launch from Stan';
insert into public.reports (reporter_id, target_type, target_id, reason) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'user', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'spam');


-- Every authenticated dashboard fixture must satisfy the now-required two-step onboarding gate.
-- Keep these integration identities representative of fully onboarded production members.
update public.profiles
   set professional_role = 'Founder / Co-founder',
       interests = array['fintech']
 where id in (
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
   'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
   'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
   'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
   'ffffffff-ffff-4fff-8fff-ffffffffffff',
   '99999999-9999-4999-8999-999999999991',
   '99999999-9999-4999-8999-999999999992'
 )
 or id::text like '77777777-7777-4777-8777-0000000000%';

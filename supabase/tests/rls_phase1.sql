-- RLS / invariant tests. Each block raises on failure; ON_ERROR_STOP makes the run fail.
\set ON_ERROR_STOP on
set search_path = "$user", public, extensions;

-- fixtures (as superuser): three users; A and B verified, C unverified
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.dev', now(), '{"display_name":"Alice"}'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.dev', now(), '{"display_name":"Bob"}'),
  ('00000000-0000-0000-0000-00000000000c', 'c@test.dev', null, '{}');

do $$ begin
  assert (select count(*) from public.profiles) >= 3, 'profiles auto-created for new auth users';
  assert (select count(*) from public.notification_preferences) = 3, 'prefs auto-created';
end $$;

-- helper: act as a user
create or replace function pg_temp.act_as(p_uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p_uid, ''), false);
end $$;

-- ===== A creates a startup =====
set role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
insert into public.startups (name, slug, created_by, tagline, description, country, category_id)
values ('Alpha Labs', 'alpha-labs', '00000000-0000-0000-0000-00000000000a',
        'We build things', 'A long description', 'ET', (select id from public.categories where slug = 'fintech'));

do $$ declare n int; begin
  select count(*) into n from public.startup_members where role = 'owner';
  assert n = 1, 'owner membership created by trigger';
  select count(*) into n from public.startups; assert n = 1, 'owner can see own draft';
end $$;

-- A cannot self-publish by writing status
do $$ begin
  begin
    update public.startups set status = 'published' where slug = 'alpha-labs';
    raise exception 'FAIL: status update should be denied';
  exception when insufficient_privilege then null; end;
  begin
    update public.startups set is_featured = true where slug = 'alpha-labs';
    raise exception 'FAIL: is_featured update should be denied';
  exception when insufficient_privilege then null; end;
  begin
    update public.startups set verification_status = 'verified' where slug = 'alpha-labs';
    raise exception 'FAIL: verification update should be denied';
  exception when insufficient_privilege then null; end;
end $$;

-- A cannot escalate own role or unsuspend
do $$ begin
  begin
    update public.profiles set role = 'admin' where id = auth.uid();
    raise exception 'FAIL: role escalation allowed';
  exception when insufficient_privilege then null; end;
  begin
    update public.profiles set is_suspended = false where id = auth.uid();
    raise exception 'FAIL: suspension column writable';
  exception when insufficient_privilege then null; end;
end $$;

-- A publishes through the function
do $$ declare s public.startup_status; begin
  s := public.set_startup_publication((select id from public.startups where slug = 'alpha-labs'), true);
  assert s = 'published', 'publish succeeded: ' || s;
end $$;

-- A renames the slug: old slug is kept for redirects
update public.startups set slug = 'alpha-labs-et' where slug = 'alpha-labs';
do $$ begin
  assert (select count(*) from public.startup_slug_history where slug = 'alpha-labs') = 1, 'slug history recorded';
end $$;

-- ===== B (another user) =====
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
do $$ declare n int; begin
  update public.startups set name = 'Hacked' where slug = 'alpha-labs-et';
  get diagnostics n = row_count;
  assert n = 0, 'B cannot edit A startup';
  begin
    perform public.set_startup_publication((select id from public.startups where slug = 'alpha-labs-et'), false);
    raise exception 'FAIL: B unpublished A startup';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.startups (name, slug, created_by) values ('Evil', 'evil-co', '00000000-0000-0000-0000-00000000000a');
    raise exception 'FAIL: B created startup as A';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.startup_members (startup_id, user_id, role)
      values ((select id from public.startups where slug = 'alpha-labs-et'), '00000000-0000-0000-0000-00000000000b', 'owner');
    raise exception 'FAIL: B self-added as member';
  exception when insufficient_privilege then null; end;
  begin
    perform public.check_rate_limit('x', 1, 60);
    raise exception 'FAIL: rate limit RPC callable by authenticated';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.audit_logs (action) values ('fake');
    raise exception 'FAIL: audit insert allowed';
  exception when insufficient_privilege then null; end;
end $$;

-- B can read the published startup, and sees nothing private of A's
do $$ begin
  assert (select count(*) from public.startups where slug = 'alpha-labs-et') = 1, 'public startup visible to B';
  assert (select count(*) from public.profiles) = 1, 'B sees only own full profile row';
  assert (select count(*) from public.verification_requests) = 0, 'B sees no verification requests';
end $$;

-- ===== anonymous visitor =====
reset role; set role anon; select pg_temp.act_as('');
do $$ begin
  assert (select count(*) from public.startups) = 1, 'anon sees published startup';
end $$;
do $$ begin
  begin
    perform count(*) from public.profiles;
    raise exception 'FAIL: anon can read profiles table';
  exception when insufficient_privilege then null; end;
  perform count(*) from public.public_profiles;  -- view is allowed
  begin
    perform count(*) from public.inquiries;
    raise exception 'FAIL: anon can read inquiries';
  exception when insufficient_privilege then null; end;
end $$;

-- ===== unpublished startups are hidden =====
reset role; set role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select public.set_startup_publication((select id from public.startups where slug = 'alpha-labs-et'), false);
reset role; set role anon;
do $$ begin assert (select count(*) from public.startups) = 0, 'unpublished startup hidden from anon'; end $$;

-- ===== unverified email cannot publish =====
reset role; set role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
insert into public.startups (name, slug, created_by, tagline, description, country, category_id)
values ('Gamma', 'gamma-co', '00000000-0000-0000-0000-00000000000c', 't', 'd', 'KE', (select id from public.categories limit 1));
do $$ begin
  begin
    perform public.set_startup_publication((select id from public.startups where slug = 'gamma-co'), true);
    raise exception 'FAIL: unverified user published';
  exception when insufficient_privilege then null; end;
end $$;

-- ===== votes: unique, locked, counted =====
reset role;
insert into public.launches (slug, name, tagline, product_url, status, published_at, submitted_by, competition_started_at, competition_ends_at, competition_day)
values ('alpha-app', 'Alpha App', 'An app for alphas', 'https://example.com', 'published', now(), '00000000-0000-0000-0000-00000000000a', now(), now() + interval '24 hours', (now() at time zone 'UTC')::date);
set role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
insert into public.launch_votes (launch_id, user_id) values ((select id from public.launches where slug = 'alpha-app'), '00000000-0000-0000-0000-00000000000b');
do $$ begin
  begin
    insert into public.launch_votes (launch_id, user_id) values ((select id from public.launches where slug = 'alpha-app'), '00000000-0000-0000-0000-00000000000b');
    raise exception 'FAIL: duplicate vote allowed';
  exception when unique_violation then null; end;
  begin
    delete from public.launch_votes;
    raise exception 'FAIL: vote deletion allowed';
  exception when insufficient_privilege then null; end;
  begin
    update public.launch_votes set user_id = user_id;
    raise exception 'FAIL: vote update allowed';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.launch_votes (launch_id, user_id) values ((select id from public.launches where slug = 'alpha-app'), '00000000-0000-0000-0000-00000000000a');
    raise exception 'FAIL: voted as someone else';
  exception when insufficient_privilege then null; end;
  begin
    update public.launches set vote_count = 999;
    raise exception 'FAIL: vote_count writable';
  exception when insufficient_privilege then null; end;
end $$;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
do $$ begin
  begin
    insert into public.launch_votes (launch_id, user_id) values ((select id from public.launches where slug = 'alpha-app'), '00000000-0000-0000-0000-00000000000c');
    raise exception 'FAIL: unverified user voted';
  exception when insufficient_privilege then null; end;
end $$;


-- Completed competitions remain public but reject new votes and comments.
reset role;
insert into public.launches (slug, name, tagline, product_url, status, published_at, submitted_by, competition_started_at, competition_ends_at, competition_day)
values ('ended-app', 'Ended App', 'A completed competition', 'https://example.org', 'published', now() - interval '2 days',
  '00000000-0000-0000-0000-00000000000a', now() - interval '2 days', now() - interval '1 day', (now() at time zone 'UTC')::date - 2);
set role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
do $$ begin
  begin
    insert into public.launch_votes (launch_id, user_id) values ((select id from public.launches where slug = 'ended-app'), '00000000-0000-0000-0000-00000000000b');
    raise exception 'FAIL: vote allowed after competition expiry';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.comments (launch_id, author_id, body)
    values ((select id from public.launches where slug = 'ended-app'), '00000000-0000-0000-0000-00000000000b', 'late comment');
    raise exception 'FAIL: comment allowed after competition expiry';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set role anon;
do $$ begin
  assert exists (select 1 from public.launches where slug = 'ended-app'), 'completed product page remains public';
end $$;
reset role;

-- ===== suspended users cannot interact =====
reset role;
update public.profiles set is_suspended = true where id = '00000000-0000-0000-0000-00000000000b';
set role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
do $$ begin
  begin
    insert into public.comments (launch_id, author_id, body)
    values ((select id from public.launches where slug = 'alpha-app'), '00000000-0000-0000-0000-00000000000b', 'hello');
    raise exception 'FAIL: suspended user commented';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
update public.profiles set is_suspended = false where id = '00000000-0000-0000-0000-00000000000b';

-- ===== comments: count maintained, reply guard =====
set role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
insert into public.comments (launch_id, author_id, body)
values ((select id from public.launches where slug = 'alpha-app'), '00000000-0000-0000-0000-00000000000b', 'first!');
reset role;
do $$ begin
  assert (select comment_count from public.launches where slug = 'alpha-app') = 1, 'comment_count incremented';
  assert (select vote_count from public.launches where slug = 'alpha-app') = 1, 'vote_count = 1';
end $$;

-- ===== reports: one per reporter per target =====
set role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
insert into public.reports (reporter_id, target_type, target_id, reason)
values ('00000000-0000-0000-0000-00000000000b', 'launch', (select id from public.launches where slug = 'alpha-app'), 'spam');
do $$ begin
  begin
    insert into public.reports (reporter_id, target_type, target_id, reason)
    values ('00000000-0000-0000-0000-00000000000b', 'launch', (select id from public.launches where slug = 'alpha-app'), 'spam');
    raise exception 'FAIL: duplicate report allowed';
  exception when unique_violation then null; end;
end $$;
do $$ declare n int; begin
  update public.reports set status = 'dismissed';
  get diagnostics n = row_count;
  assert n = 0, 'reporter cannot change report status (RLS filters the row)';
end $$;

-- ===== moderator / admin privileges come from the profile role only =====
reset role;
update public.profiles set role = 'moderator' where id = '00000000-0000-0000-0000-00000000000b';
set role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
do $$ begin
  assert (select count(*) from public.reports) = 1, 'moderator can read reports';
  assert (select count(*) from public.startups) = 2, 'moderator can read drafts and unpublished';
  assert (select count(*) from public.audit_logs) = 0, 'moderator cannot read audit log (admin only)';
end $$;

-- ===== service role can use rate limiting =====
reset role; set role service_role;
do $$ begin
  assert public.check_rate_limit('k', 2, 60) = true;
  assert public.check_rate_limit('k', 2, 60) = true;
  assert public.check_rate_limit('k', 2, 60) = false, 'third hit is limited';
end $$;
reset role;

-- ===== storage helper tolerates junk paths =====
do $$ begin
  assert public.storage_startup_id('not-a-uuid/file.png') is null;
  assert public.storage_startup_id('11111111-1111-1111-1111-111111111111/file.png') is not null;
end $$;

-- ===== public_profiles never leaks private columns =====
do $$ declare cols text[]; begin
  select array_agg(column_name::text) into cols from information_schema.columns
   where table_schema = 'public' and table_name = 'public_profiles';
  assert not ('role' = any (cols)) and not ('is_suspended' = any (cols)) and not ('suspended_reason' = any (cols)), 'view columns safe';
end $$;

-- ===== every public table has RLS enabled =====
do $$ declare n int; begin
  select count(*) into n from pg_tables where schemaname = 'public' and not rowsecurity;
  assert n = 0, 'all public tables have RLS enabled';
end $$;

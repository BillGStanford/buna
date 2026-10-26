-- Phase 2 checks: child-record permissions, limits, slug redirects, discovery helpers, storage policies.
\set ON_ERROR_STOP on
set search_path = "$user", public, extensions;

insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-0000-0000-0000000000d1', 'd@test.dev', now()),
  ('00000000-0000-0000-0000-0000000000e1', 'e@test.dev', now());

create or replace function pg_temp.act_as(p_uid text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', coalesce(p_uid, ''), false); end $$;

-- ===== D builds a startup =====
set role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000d1') \gset
insert into public.startups (name, slug, created_by, tagline, description, country, category_id)
values ('Delta Co', 'delta-co', '00000000-0000-0000-0000-0000000000d1', 'Delta things', 'About delta', 'ET',
        (select id from public.categories where slug = 'fintech'));
insert into public.startups (name, slug, created_by, tagline, description, country, category_id)
values ('Draft Co', 'draft-co', '00000000-0000-0000-0000-0000000000d1', 'Draft things', 'About draft', 'KE',
        (select id from public.categories where slug = 'fintech'));
select public.set_startup_publication((select id from public.startups where slug = 'delta-co'), true) \gset
insert into public.startup_products (startup_id, name) values ((select id from public.startups where slug = 'delta-co'), 'Delta App');
insert into public.startup_products (startup_id, name) values ((select id from public.startups where slug = 'draft-co'), 'Secret Draft App');
insert into public.startup_links (startup_id, kind, url) values ((select id from public.startups where slug = 'delta-co'), 'website', 'https://delta.example');
insert into public.startup_media (startup_id, storage_path, url, alt_text)
values ((select id from public.startups where slug = 'delta-co'), 'x/y.png', 'https://example.com/y.png', 'Screenshot');

-- bad data is rejected by constraints
do $$ begin
  begin
    insert into public.startup_links (startup_id, kind, url) values ((select id from public.startups where slug = 'delta-co'), 'website', 'javascript:alert(1)');
    raise exception 'FAIL: javascript: link accepted';
  exception when check_violation then null; end;
  begin
    insert into public.startup_links (startup_id, kind, url) values ((select id from public.startups where slug = 'delta-co'), 'website', 'https://delta.example');
    raise exception 'FAIL: duplicate link accepted';
  exception when unique_violation then null; end;
end $$;

-- limits: 12 products, 10 links, 6 gallery images
do $$
declare i int; sid uuid := (select id from public.startups where slug = 'delta-co');
begin
  for i in 2..12 loop insert into public.startup_products (startup_id, name) values (sid, 'P' || i); end loop;
  begin
    insert into public.startup_products (startup_id, name) values (sid, 'one too many');
    raise exception 'FAIL: 13th product accepted';
  exception when program_limit_exceeded then null; end;
  for i in 2..6 loop insert into public.startup_media (startup_id, storage_path, url) values (sid, 'p' || i, 'https://example.com/' || i); end loop;
  begin
    insert into public.startup_media (startup_id, storage_path, url) values (sid, 'p7', 'https://example.com/7');
    raise exception 'FAIL: 7th gallery image accepted';
  exception when program_limit_exceeded then null; end;
end $$;

-- client cannot flag a startup as demo or featured
do $$ begin
  begin
    update public.startups set is_demo = false where slug = 'delta-co';
    raise exception 'FAIL: is_demo writable';
  exception when insufficient_privilege then null; end;
end $$;

-- ===== E (stranger) cannot touch D's records =====
select pg_temp.act_as('00000000-0000-0000-0000-0000000000e1') \gset
do $$ begin
  begin
    insert into public.startup_products (startup_id, name) values ((select id from public.startups where slug = 'delta-co'), 'Injected');
    raise exception 'FAIL: stranger added a product';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.startup_links (startup_id, kind, url) values ((select id from public.startups where slug = 'delta-co'), 'other', 'https://evil.example');
    raise exception 'FAIL: stranger added a link';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.startup_media (startup_id, storage_path, url) values ((select id from public.startups where slug = 'delta-co'), 'e', 'https://evil.example/x.png');
    raise exception 'FAIL: stranger added media';
  exception when insufficient_privilege then null; end;
end $$;
do $$ declare n int; begin
  delete from public.startup_products where name = 'Delta App'; get diagnostics n = row_count;
  assert n = 0, 'stranger cannot delete products';
  update public.startup_links set label = 'x'; get diagnostics n = row_count;
  assert n = 0, 'stranger cannot edit links';
end $$;

-- ===== storage policies (policy logic exercised through the stub storage.objects table) =====
do $$ begin
  begin
    insert into storage.objects (bucket_id, name) values ('startup-media', (select id::text from public.startups where slug = 'delta-co') || '/logo.png');
    raise exception 'FAIL: stranger uploaded to a startup folder';
  exception when insufficient_privilege then null; end;
  begin
    insert into storage.objects (bucket_id, name) values ('avatars', '00000000-0000-0000-0000-0000000000d1/me.png');
    raise exception 'FAIL: wrote into another user avatar folder';
  exception when insufficient_privilege then null; end;
  insert into storage.objects (bucket_id, name) values ('avatars', '00000000-0000-0000-0000-0000000000e1/me.png');
end $$;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000d1') \gset
do $$ begin
  insert into storage.objects (bucket_id, name) values ('startup-media', (select id::text from public.startups where slug = 'delta-co') || '/logo.png');
  insert into storage.objects (bucket_id, name) values ('verification-docs', (select id::text from public.startups where slug = 'delta-co') || '/reg.pdf');
  begin
    insert into storage.objects (bucket_id, name) values ('startup-media', 'not-a-uuid/logo.png');
    raise exception 'FAIL: junk folder accepted';
  exception when insufficient_privilege then null; end;
end $$;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000e1') \gset
do $$ begin
  assert (select count(*) from storage.objects where bucket_id = 'verification-docs') = 0, 'stranger cannot see verification documents';
end $$;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000d1') \gset
do $$ begin
  assert (select count(*) from storage.objects where bucket_id = 'verification-docs') = 1, 'owner can see own verification documents';
end $$;

-- ===== anonymous visitor sees only published startups' children =====
reset role; set role anon;
select pg_temp.act_as('') \gset
do $$ begin
  assert (select count(*) from public.startup_products where name = 'Secret Draft App') = 0, 'draft startup products hidden';
  assert (select count(*) from public.startup_products where name = 'Delta App') = 1, 'published startup products visible';
  assert (select count(*) from public.startup_links) = 1, 'published links visible';
  assert (select count(*) from public.startups where search @@ websearch_to_tsquery('english', 'delta')) = 1, 'full-text search finds published startup';
  assert (select count(*) from public.startups where search @@ websearch_to_tsquery('english', 'draft')) = 0, 'full-text search hides drafts';
  assert (select count(*) from public.startups where name ilike '%elta%') = 1, 'prefix/substring search works';
end $$;

-- ===== category counts only include published startups =====
do $$ declare n bigint; begin
  select startup_count into n from public.published_category_counts() where slug = 'fintech';
  assert n >= 1, 'fintech has the published startup';
  assert (select count(*) from public.published_category_counts()) >= 15, 'all active categories are returned';
end $$;
reset role;
do $$ declare before_n bigint; after_n bigint; begin
  select startup_count into before_n from public.published_category_counts() where slug = 'agritech';
  insert into public.startups (name, slug, tagline, description, country, category_id, status)
  values ('Agri Hidden', 'agri-hidden', 't', 'd', 'KE', (select id from public.categories where slug = 'agritech'), 'draft');
  select startup_count into after_n from public.published_category_counts() where slug = 'agritech';
  assert before_n = after_n, 'drafts are not counted';
end $$;

-- ===== slug rename keeps the old link resolvable, and it stays reserved =====
set role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000d1') \gset
update public.startups set slug = 'delta-company' where slug = 'delta-co';
reset role; set role anon;
select pg_temp.act_as('') \gset
do $$ begin
  assert (select s.slug from public.startup_slug_history h join public.startups s on s.id = h.startup_id where h.slug = 'delta-co') = 'delta-company',
    'old slug resolves to the new slug for visitors';
end $$;
reset role; set role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000e1') \gset
do $$ begin
  begin
    insert into public.startups (name, slug, created_by) values ('Squatter', 'delta-co', '00000000-0000-0000-0000-0000000000e1');
    raise exception 'FAIL: retired slug was claimable by someone else';
  exception when unique_violation then null; end;
end $$;
-- the original owner can reclaim it, which removes it from history
select pg_temp.act_as('00000000-0000-0000-0000-0000000000d1') \gset
update public.startups set slug = 'delta-co' where slug = 'delta-company';
reset role;
do $$ begin
  assert (select count(*) from public.startup_slug_history where slug = 'delta-co') = 0, 'reclaimed slug leaves history';
  assert (select count(*) from public.startup_slug_history where slug = 'delta-company') = 1, 'new retired slug recorded';
end $$;

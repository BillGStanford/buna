-- Phase 7 checks: investor contact enforcement and community discussion RLS/notifications.
\set ON_ERROR_STOP on
set search_path = "$user", public, extensions;

create function pg_temp.act_as(p_uid text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', coalesce(p_uid, ''), false); end $$;

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000671', 'community-owner@test.dev', now(), '{"display_name":"Community Owner"}'),
  ('00000000-0000-0000-0000-000000000672', 'community-replier@test.dev', now(), '{"display_name":"Community Replier"}'),
  ('00000000-0000-0000-0000-000000000673', 'community-moderator@test.dev', now(), '{"display_name":"Community Moderator"}');

update public.profiles set username = 'community-owner' where id = '00000000-0000-0000-0000-000000000671';
update public.profiles set username = 'community-replier' where id = '00000000-0000-0000-0000-000000000672';
update public.profiles set username = 'community-mod', role = 'moderator' where id = '00000000-0000-0000-0000-000000000673';

set role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-000000000671');
do $$ begin
  begin
    insert into public.investor_applications (user_id, organization_name, investor_type, background)
    values ('00000000-0000-0000-0000-000000000671', 'Contactless Fund', 'angel',
      'We invest in early-stage African companies and support founders.');
    raise exception 'investor application without a contact route was accepted';
  exception when check_violation then null;
  end;
end $$;
insert into public.investor_applications (user_id, organization_name, investor_type, background, contact_phone)
values ('00000000-0000-0000-0000-000000000671', 'Reachable Fund', 'angel',
  'We invest in early-stage African companies and support founders.', '+251911123456');
reset role;

do $$ begin
  assert exists (select 1 from public.investor_applications where user_id = '00000000-0000-0000-0000-000000000671' and contact_phone = '+251911123456'),
    'an application with a phone contact is persisted';
end $$;

set role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-000000000671');
do $$
declare v_thread uuid;
begin
  insert into public.community_threads (author_id, category, title, body)
  values ('00000000-0000-0000-0000-000000000671', 'legal-registration',
    'How do I register a company in Ethiopia?',
    'I am preparing to register a technology company in Addis Ababa. Which steps and documents should I prepare?')
  returning id into v_thread;
  perform set_config('test.community_thread_id', v_thread::text, false);
end $$;
reset role;

set role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-000000000673');
insert into public.community_thread_subscriptions (thread_id, user_id)
values (current_setting('test.community_thread_id')::uuid, '00000000-0000-0000-0000-000000000673');
reset role;

set role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-000000000672');
insert into public.community_replies (thread_id, author_id, body)
values (current_setting('test.community_thread_id')::uuid, '00000000-0000-0000-0000-000000000672',
  'Start by checking the current registration requirements with the relevant Ethiopian authority.');
reset role;

set role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-000000000672');
do $spoof$ begin
  begin
    insert into public.community_threads (author_id, category, title, body)
    values ('00000000-0000-0000-0000-000000000671', 'feedback', 'Impersonation attempt',
      'This row should be rejected because the signed-in member is not its author.');
    raise exception 'community author spoofing was accepted';
  exception when insufficient_privilege then null;
  end;
end $spoof$;
reset role;

set role anon;
select pg_temp.act_as('');
do $$ begin
  assert exists (select 1 from public.community_threads where id = current_setting('test.community_thread_id')::uuid),
    'anonymous visitors can read published discussion threads';
  assert exists (select 1 from public.community_replies where thread_id = current_setting('test.community_thread_id')::uuid),
    'anonymous visitors can read published replies';
end $$;
reset role;

do $$ begin
  assert (select count(*) from public.notifications where user_id = '00000000-0000-0000-0000-000000000671' and type = 'reply') = 1,
    'thread author receives an in-app reply notification';
  assert (select count(*) from public.notifications where user_id = '00000000-0000-0000-0000-000000000673' and type = 'reply') = 1,
    'subscribed member receives an in-app reply notification';
  assert (select count(*) from public.notifications where user_id = '00000000-0000-0000-0000-000000000672' and type = 'reply') = 0,
    'reply author is not notified about their own reply';
end $$;

-- Staff can hide an individual reply; anonymous readers must no longer see it.
set role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-000000000673');
update public.community_replies set status = 'hidden'
 where thread_id = current_setting('test.community_thread_id')::uuid;
reset role;
set role anon;
select pg_temp.act_as('');
do $$ begin
  assert not exists (select 1 from public.community_replies where thread_id = current_setting('test.community_thread_id')::uuid),
    'hidden replies are not visible to anonymous visitors';
end $$;
reset role;

-- Staff can hide a thread; public visitors can no longer read it.
set role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-000000000673');
update public.community_threads set status = 'hidden' where id = current_setting('test.community_thread_id')::uuid;
reset role;
set role anon;
select pg_temp.act_as('');
do $$ begin
  assert not exists (select 1 from public.community_threads where id = current_setting('test.community_thread_id')::uuid),
    'hidden discussions are not visible to anonymous visitors';
end $$;
reset role;

\echo 'Phase 7 investor contact, community RLS, reply moderation and notification tests passed'

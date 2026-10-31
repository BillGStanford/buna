-- Phase 6 checks: public social-link privacy and recipient-idempotent inquiry delivery.
\set ON_ERROR_STOP on
set search_path = "$user", public, extensions;

create function pg_temp.act_as(p_uid text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', coalesce(p_uid, ''), false); end $$;

insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-0000-0000-000000000661', 'public6@test.dev', now()),
  ('00000000-0000-0000-0000-000000000662', 'private6@test.dev', now()),
  ('00000000-0000-0000-0000-000000000663', 'sender6@test.dev', now());

update public.profiles
   set username = 'public6', is_public_profile = true,
       social_links = '{"github":"https://github.com/public6","linkedin":"https://www.linkedin.com/in/public6"}'::jsonb
 where id = '00000000-0000-0000-0000-000000000661';
update public.profiles
   set username = 'private6', is_public_profile = false,
       social_links = '{"github":"https://github.com/private6"}'::jsonb
 where id = '00000000-0000-0000-0000-000000000662';

-- Anonymous visitors can read public links, but never private links.
set role anon;
select pg_temp.act_as('');
do $$ begin
  assert public.get_public_profile_social_links('00000000-0000-0000-0000-000000000661')->>'github' = 'https://github.com/public6',
    'public profile social links are readable';
  assert public.get_public_profile_social_links('00000000-0000-0000-0000-000000000662') is null,
    'private profile social links are hidden from anonymous visitors';
end $$;
reset role;

-- A signed-in owner can preview their own private links; another member cannot.
set role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-000000000662');
do $$ begin
  assert public.get_public_profile_social_links('00000000-0000-0000-0000-000000000662')->>'github' = 'https://github.com/private6',
    'profile owner can read their own private social links';
  assert public.get_public_profile_social_links('00000000-0000-0000-0000-000000000661')->>'github' = 'https://github.com/public6',
    'public links remain readable when signed in';
end $$;
reset role;

-- Create an inquiry to exercise the service-role-only delivery ledger.
insert into public.startups (id, name, slug, created_by, tagline, description, country, category_id, status, published_at)
values (
  '66660000-0000-4000-8000-000000000001', 'Delivery Test', 'delivery-test',
  '00000000-0000-0000-0000-000000000663', 'Delivery test', 'A test startup', 'ET',
  (select id from public.categories where slug = 'fintech'), 'published', now()
);
insert into public.inquiries (id, startup_id, sender_name, sender_email, subject, message)
values (
  '66660000-0000-4000-8000-000000000002', '66660000-0000-4000-8000-000000000001',
  'Test Sender', 'sender@test.dev', 'A delivery test', 'This message is long enough for the inquiry constraint.'
);

set role service_role;
do $$ begin
  assert public.claim_inquiry_email_recipient(
    '66660000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000661', 'public6@test.dev'
  ) = 'claimed', 'first recipient claim succeeds';
  assert public.claim_inquiry_email_recipient(
    '66660000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000661', 'public6@test.dev'
  ) = 'busy', 'concurrent claim cannot send a duplicate';
  perform public.finish_inquiry_email_recipient(
    '66660000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000661', 'sent', null
  );
  assert public.claim_inquiry_email_recipient(
    '66660000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000661', 'public6@test.dev'
  ) = 'sent', 'successful recipient is never claimed again';

  assert public.claim_inquiry_email_recipient(
    '66660000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000662', 'private6@test.dev'
  ) = 'claimed', 'second recipient can be claimed';
  perform public.finish_inquiry_email_recipient(
    '66660000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000662', 'failed', 'temporary failure'
  );
  assert public.claim_inquiry_email_recipient(
    '66660000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000662', 'private6@test.dev'
  ) = 'claimed', 'failed recipient can be retried';
  perform public.finish_inquiry_email_recipient(
    '66660000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000662', 'sent', null
  );
  assert public.claim_inquiry_email_recipient(
    '66660000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000662', 'private6@test.dev'
  ) = 'sent', 'retried successful recipient is not resent';
end $$;
reset role;

do $$ begin
  assert (select count(*) from public.inquiry_email_deliveries where inquiry_id = '66660000-0000-4000-8000-000000000002' and status = 'sent') = 2,
    'both recipient outcomes are persisted';
end $$;

\echo 'Phase 6 social profile and inquiry delivery tests passed'

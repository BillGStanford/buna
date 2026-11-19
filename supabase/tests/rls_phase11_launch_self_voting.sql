-- Phase 11: makers and every startup team member are excluded from launch voting.
\set ON_ERROR_STOP on
set search_path = "$user", public, extensions;

insert into auth.users (id,email,email_confirmed_at,raw_user_meta_data) values
 ('00000000-0000-0000-0000-000000000801','launch-maker@test.dev',now(),'{"display_name":"Launch Maker"}'),
 ('00000000-0000-0000-0000-000000000802','launch-teammate@test.dev',now(),'{"display_name":"Launch Teammate"}'),
 ('00000000-0000-0000-0000-000000000803','launch-voter@test.dev',now(),'{"display_name":"Launch Voter"}');

insert into public.startups (id,slug,name,tagline,description,country,created_by,status)
values ('00000000-0000-0000-0000-000000000804','launch-vote-guard-test','Launch Vote Guard Test','A test startup','A test startup profile','ET','00000000-0000-0000-0000-000000000801','published');

insert into public.startup_members (startup_id,user_id,role,is_public)
values ('00000000-0000-0000-0000-000000000804','00000000-0000-0000-0000-000000000802','viewer',false);

insert into public.launches (id,slug,startup_id,submitted_by,name,tagline,product_url,status,competition_ends_at)
values ('00000000-0000-0000-0000-000000000805','launch-vote-guard-test','00000000-0000-0000-0000-000000000804','00000000-0000-0000-0000-000000000801',
        'Launch Vote Guard Test','A launch used to test vote restrictions','https://example.test','published',now()+interval '1 day');

-- The submitter cannot vote, including through a direct authenticated database insert.
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000801',false);
do $$ begin
  assert not public.can_vote_for_launch('00000000-0000-0000-0000-000000000805'), 'submitter must not be eligible';
  begin
    insert into public.launch_votes (launch_id,user_id) values ('00000000-0000-0000-0000-000000000805',auth.uid());
    raise exception 'FAIL: launch submitter was able to vote';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Even a private viewer membership is enough to exclude a team member.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000802',false);
do $$ begin
  assert not public.can_vote_for_launch('00000000-0000-0000-0000-000000000805'), 'startup team member must not be eligible';
  begin
    insert into public.launch_votes (launch_id,user_id) values ('00000000-0000-0000-0000-000000000805',auth.uid());
    raise exception 'FAIL: startup team member was able to vote';
  exception when insufficient_privilege then null;
  end;
end $$;

-- An unrelated verified user can still vote normally.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000803',false);
do $$ begin
  assert public.can_vote_for_launch('00000000-0000-0000-0000-000000000805'), 'unrelated user should be eligible';
  insert into public.launch_votes (launch_id,user_id) values ('00000000-0000-0000-0000-000000000805',auth.uid());
end $$;
reset role;

do $$ begin
  assert (select vote_count=1 from public.launches where id='00000000-0000-0000-0000-000000000805'),
    'only the unrelated user vote should increment the launch counter';
end $$;

\echo 'Phase 11 launch self-voting tests passed'

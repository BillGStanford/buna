-- Phase 8 checks: investor identities, multi-member teams and role permissions.
\set ON_ERROR_STOP on
set search_path = "$user", public, extensions;

create function pg_temp.act_as(p_uid text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', coalesce(p_uid, ''), false); end $$;

insert into auth.users (id,email,email_confirmed_at,raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000681','investor-owner@test.dev',now(),'{"display_name":"Investor Owner"}'),
  ('00000000-0000-0000-0000-000000000682','investor-partner@test.dev',now(),'{"display_name":"Investor Partner"}'),
  ('00000000-0000-0000-0000-000000000683','investor-observer@test.dev',now(),'{"display_name":"Investor Observer"}'),
  ('00000000-0000-0000-0000-000000000684','investor-analyst@test.dev',now(),'{"display_name":"Investor Analyst"}'),
  ('00000000-0000-0000-0000-000000000685','investor-associate@test.dev',now(),'{"display_name":"Investor Associate"}');

update public.profiles set username='investor-owner' where id='00000000-0000-0000-0000-000000000681';
update public.profiles set username='investor-partner' where id='00000000-0000-0000-0000-000000000682';
update public.profiles set username='investor-observer' where id='00000000-0000-0000-0000-000000000683';
update public.profiles set username='investor-analyst' where id='00000000-0000-0000-0000-000000000684';
update public.profiles set username='investor-associate' where id='00000000-0000-0000-0000-000000000685';

insert into public.investors(slug,name,description,verification_status,is_published,created_by,investor_type,entity_kind)
values('individual-angel-test','Individual Angel Test','Independent investor test profile.','unverified',true,
  '00000000-0000-0000-0000-000000000681','independent_investor','individual')
returning id \gset investor_

insert into public.investor_accounts(investor_id,user_id,contact_email,private_background)
values(:'investor_id','00000000-0000-0000-0000-000000000681','owner@test.dev','A private investor background.');
insert into public.investor_memberships(investor_id,user_id,role,added_by) values
  (:'investor_id','00000000-0000-0000-0000-000000000681','owner','00000000-0000-0000-0000-000000000681'),
  (:'investor_id','00000000-0000-0000-0000-000000000682','partner','00000000-0000-0000-0000-000000000681'),
  (:'investor_id','00000000-0000-0000-0000-000000000683','observer','00000000-0000-0000-0000-000000000681'),
  (:'investor_id','00000000-0000-0000-0000-000000000684','analyst','00000000-0000-0000-0000-000000000681');

do $$ begin
  assert exists(select 1 from public.investors where id=:'investor_id' and entity_kind='individual' and investor_type='independent_investor'),
    'individual investor identities support independent investors';
end $$;

-- Owner can manage the organization and create shared deal-flow records.
set role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-000000000681');
do $$ begin
  assert public.has_investor_permission(:'investor_id','manage_team'), 'owner can manage team';
  assert public.has_investor_permission(:'investor_id','manage_dealflow'), 'owner can manage deal flow';
end $$;
insert into public.investor_saved_searches(investor_id,name,criteria)
values(:'investor_id','Owner saved search','{"sectors":["fintech"]}');
reset role;

-- Partners can add existing Buna accounts with a defined role.
set role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-000000000682');
select public.manage_investor_membership(:'investor_id','00000000-0000-0000-0000-000000000685','associate','add');
do $$ begin
  assert exists(select 1 from public.investor_memberships where investor_id=:'investor_id' and user_id='00000000-0000-0000-0000-000000000685' and role='associate'),
    'partner can add an existing Buna member';
end $$;
reset role;

-- Analysts can manage deal flow but cannot administer the organization.
set role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-000000000684');
do $$ begin
  assert public.has_investor_permission(:'investor_id','manage_dealflow'), 'analyst can manage deal flow';
  assert not public.has_investor_permission(:'investor_id','manage_team'), 'analyst cannot manage team';
end $$;
reset role;

-- Observers can read shared deal flow but cannot delete or update it.
set role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-000000000683');
do $$ begin
  assert public.has_investor_permission(:'investor_id','view_dealflow'), 'observer can view deal flow';
  assert not public.has_investor_permission(:'investor_id','manage_dealflow'), 'observer cannot mutate deal flow';
end $$;
delete from public.investor_saved_searches where investor_id=:'investor_id';
reset role;

do $$ begin
  assert exists(select 1 from public.investor_saved_searches where investor_id=:'investor_id' and name='Owner saved search'),
    'observer cannot delete investor saved searches';
end $$;

-- Public profiles expose active public team membership without exposing private account details.
set role anon;
select pg_temp.act_as('');
do $$ begin
  assert (select count(*) from public.investor_memberships where investor_id=:'investor_id' and is_public and status='active') = 5,
    'public investor profile can show the active public team roster';
end $$;
reset role;

\echo 'Phase 8 investor identity, team membership and permission tests passed'

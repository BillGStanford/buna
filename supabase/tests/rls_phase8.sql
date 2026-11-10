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
  ('00000000-0000-0000-0000-000000000685','investor-associate@test.dev',now(),'{"display_name":"Investor Associate"}'),
  ('00000000-0000-0000-0000-000000000686','individual-applicant@test.dev',now(),'{"display_name":"Individual Applicant"}'),
  ('00000000-0000-0000-0000-000000000687','team-applicant@test.dev',now(),'{"display_name":"Team Applicant"}'),
  ('00000000-0000-0000-0000-000000000688','investor-staff@test.dev',now(),'{"display_name":"Investor Staff"}');

update public.profiles set username='investor-owner' where id='00000000-0000-0000-0000-000000000681';
update public.profiles set username='investor-partner' where id='00000000-0000-0000-0000-000000000682';
update public.profiles set username='investor-observer' where id='00000000-0000-0000-0000-000000000683';
update public.profiles set username='investor-analyst' where id='00000000-0000-0000-0000-000000000684';
update public.profiles set username='investor-associate' where id='00000000-0000-0000-0000-000000000685';
update public.profiles set username='individual-applicant' where id='00000000-0000-0000-0000-000000000686';
update public.profiles set username='team-applicant' where id='00000000-0000-0000-0000-000000000687';
update public.profiles set username='investor-staff',role='admin' where id='00000000-0000-0000-0000-000000000688';

insert into public.investors(slug,name,description,verification_status,is_published,created_by,investor_type,entity_kind)
values('individual-angel-test','Individual Angel Test','Independent investor test profile.','unverified',true,
  '00000000-0000-0000-0000-000000000681','independent_investor','individual')
returning id \gset investor_
select set_config('test.investor_id', :'investor_id', false);

insert into public.investor_accounts(investor_id,user_id,contact_email,private_background)
values(current_setting('test.investor_id')::uuid,'00000000-0000-0000-0000-000000000681','owner@test.dev','A private investor background.');
insert into public.investor_memberships(investor_id,user_id,role,added_by) values
  (current_setting('test.investor_id')::uuid,'00000000-0000-0000-0000-000000000681','owner','00000000-0000-0000-0000-000000000681'),
  (current_setting('test.investor_id')::uuid,'00000000-0000-0000-0000-000000000682','partner','00000000-0000-0000-0000-000000000681'),
  (current_setting('test.investor_id')::uuid,'00000000-0000-0000-0000-000000000683','observer','00000000-0000-0000-0000-000000000681'),
  (current_setting('test.investor_id')::uuid,'00000000-0000-0000-0000-000000000684','analyst','00000000-0000-0000-0000-000000000681');

do $$ begin
  assert exists(select 1 from public.investors where id=current_setting('test.investor_id')::uuid and entity_kind='individual' and investor_type='independent_investor'),
    'individual investor identities support independent investors';
end $$;

-- Owner can manage the organization and create shared deal-flow records.
set role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-000000000681');
do $$ begin
  assert public.has_investor_permission(current_setting('test.investor_id')::uuid,'manage_team'), 'owner can manage team';
  assert public.has_investor_permission(current_setting('test.investor_id')::uuid,'manage_dealflow'), 'owner can manage deal flow';
end $$;
insert into public.investor_saved_searches(investor_id,name,criteria)
values(current_setting('test.investor_id')::uuid,'Owner saved search','{"sectors":["fintech"]}');
reset role;

-- Partners can add existing Buna accounts with a defined role.
set role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-000000000682');
select public.manage_investor_membership(current_setting('test.investor_id')::uuid,'00000000-0000-0000-0000-000000000685','associate','add');
do $$ begin
  assert exists(select 1 from public.investor_memberships where investor_id=current_setting('test.investor_id')::uuid and user_id='00000000-0000-0000-0000-000000000685' and role='associate'),
    'partner can add an existing Buna member';
end $$;
reset role;

-- Analysts can manage deal flow but cannot administer the organization.
set role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-000000000684');
do $$ begin
  assert public.has_investor_permission(current_setting('test.investor_id')::uuid,'manage_dealflow'), 'analyst can manage deal flow';
  assert not public.has_investor_permission(current_setting('test.investor_id')::uuid,'manage_team'), 'analyst cannot manage team';
end $$;
reset role;

-- Observers can read shared deal flow but cannot delete or update it.
set role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-000000000683');
do $$ begin
  assert public.has_investor_permission(current_setting('test.investor_id')::uuid,'view_dealflow'), 'observer can view deal flow';
  assert not public.has_investor_permission(current_setting('test.investor_id')::uuid,'manage_dealflow'), 'observer cannot mutate deal flow';
end $$;
delete from public.investor_saved_searches where investor_id=current_setting('test.investor_id')::uuid;
reset role;

do $$ begin
  assert exists(select 1 from public.investor_saved_searches where investor_id=current_setting('test.investor_id')::uuid and name='Owner saved search'),
    'observer cannot delete investor saved searches';
end $$;


-- Staff approval creates a real individual investor identity and approves a requested team role.
set role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-000000000686');
insert into public.investor_applications(user_id,organization_name,entity_kind,requested_role,investor_type,contact_email,background)
values('00000000-0000-0000-0000-000000000686','Individual Applicant','individual','owner','independent_investor',
  'individual-applicant@test.dev','I invest independently in early-stage African technology companies.');
reset role;

set role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-000000000688');
select public.review_investor_application(
  (select id from public.investor_applications where user_id='00000000-0000-0000-0000-000000000686'),'approve','Identity checked'
);
reset role;

do $ begin
  assert exists(select 1 from public.investors i join public.investor_memberships m on m.investor_id=i.id
    where i.created_by='00000000-0000-0000-0000-000000000686' and i.entity_kind='individual'
      and i.investor_type='independent_investor' and m.user_id='00000000-0000-0000-0000-000000000686' and m.role='owner'),
    'staff approval creates the individual investor profile and owner membership';
end $;

set role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-000000000687');
insert into public.investor_applications(user_id,existing_investor_id,organization_name,entity_kind,requested_role,investor_type,contact_email,background)
values('00000000-0000-0000-0000-000000000687',current_setting('test.investor_id')::uuid,'Individual Angel Test',
  'individual','analyst','angel','team-applicant@test.dev','I support diligence and research for this investor.');
reset role;

set role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-000000000688');
select public.review_investor_application(
  (select id from public.investor_applications where user_id='00000000-0000-0000-0000-000000000687'),'approve','Team role verified'
);
reset role;

do $ begin
  assert exists(select 1 from public.investor_memberships where investor_id=current_setting('test.investor_id')::uuid
    and user_id='00000000-0000-0000-0000-000000000687' and role='analyst'),
    'staff approval attaches a team applicant to the existing investor with the requested role';
end $;

-- Public profiles expose active public team membership without exposing private account details.
set role anon;
select pg_temp.act_as('');
do $$ begin
  assert (select count(*) from public.investor_memberships where investor_id=current_setting('test.investor_id')::uuid and is_public and status='active') = 6,
    'public investor profile can show the active public team roster';
end $$;
reset role;

\echo 'Phase 8 investor identity, team membership and permission tests passed'

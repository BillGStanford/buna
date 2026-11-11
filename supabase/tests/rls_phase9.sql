-- Phase 9 checks: simultaneous investor membership roles and permission union.
\set ON_ERROR_STOP on
set search_path = "$user", public, extensions;

create function pg_temp.phase9_act_as(p_uid text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', coalesce(p_uid, ''), false); end $$;

insert into auth.users (id,email,email_confirmed_at,raw_user_meta_data)
values ('00000000-0000-0000-0000-000000000689','multi-role-member@test.dev',now(),'{"display_name":"Multi Role Member"}');
update public.profiles set username='multi-role-member' where id='00000000-0000-0000-0000-000000000689';

set role authenticated;
select pg_temp.phase9_act_as('00000000-0000-0000-0000-000000000682');
select public.manage_investor_membership_roles(
  (select id from public.investors where slug='individual-angel-test'),
  '00000000-0000-0000-0000-000000000689',
  array['analyst','investment_manager']::text[],
  'add'
);
reset role;

do $$ begin
  assert exists(
    select 1 from public.investor_memberships
    where user_id='00000000-0000-0000-0000-000000000689'
      and roles @> array['analyst','investment_manager']::text[]
      and role='analyst'
  ), 'one member can hold two simultaneous roles while retaining a primary legacy role';
end $$;

set role authenticated;
select pg_temp.phase9_act_as('00000000-0000-0000-0000-000000000689');
do $$ declare v_investor uuid := (select id from public.investors where slug='individual-angel-test'); begin
  assert public.has_investor_permission(v_investor,'manage_profile'), 'investment manager permission is granted through any assigned role';
  assert public.has_investor_permission(v_investor,'manage_dealflow'), 'analyst permission is granted through any assigned role';
  assert public.has_investor_permission(v_investor,'view_dealflow'), 'multi-role member can view deal flow';
  assert not public.has_investor_permission(v_investor,'manage_team'), 'multi-role member cannot manage team without owner/partner role';
end $$;
reset role;

set role authenticated;
select pg_temp.phase9_act_as('00000000-0000-0000-0000-000000000682');
select public.manage_investor_membership_roles(
  (select id from public.investors where slug='individual-angel-test'),
  '00000000-0000-0000-0000-000000000689',
  array['observer','partner']::text[],
  'set_roles'
);
reset role;

do $$ begin
  assert exists(
    select 1 from public.investor_memberships
    where user_id='00000000-0000-0000-0000-000000000689'
      and roles @> array['observer','partner']::text[]
  ), 'owner or partner can replace the complete set of assigned roles';
end $$;

\echo 'Phase 9 multi-role investor membership tests passed'

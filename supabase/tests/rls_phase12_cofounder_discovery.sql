-- Phase 12: co-founder discovery access boundaries.
\set ON_ERROR_STOP on
set search_path = "$user", public, extensions;

insert into auth.users (id,email,email_confirmed_at,raw_user_meta_data) values
 ('00000000-0000-0000-0000-000000000811','cofounder-a-phase12@test.dev',now(),'{"display_name":"Co-founder A"}'),
 ('00000000-0000-0000-0000-000000000812','cofounder-b-phase12@test.dev',now(),'{"display_name":"Co-founder B"}'),
 ('00000000-0000-0000-0000-000000000813','cofounder-pending-phase12@test.dev',now(),'{"display_name":"Pending Co-founder"}');

insert into public.cofounder_profiles(user_id,headline,bio,opted_in,approval_status,is_paused)
values
 ('00000000-0000-0000-0000-000000000811','Founder A seeking product partner','A sufficiently long biography describing the founder and their company building experience.',true,'approved',false),
 ('00000000-0000-0000-0000-000000000812','Founder B seeking engineering partner','A sufficiently long biography describing the founder and their company building experience.',true,'approved',false),
 ('00000000-0000-0000-0000-000000000813','Pending founder profile','A sufficiently long biography describing the founder and their company building experience.',true,'pending',false);

set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000813',false);
do $$ begin
 assert not exists(select 1 from public.cofounder_profiles where user_id='00000000-0000-0000-0000-000000000811'),
   'unapproved members cannot discover approved profiles';
end $$;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000811',false);
do $$ begin
 assert exists(select 1 from public.cofounder_profiles where user_id='00000000-0000-0000-0000-000000000812'),
   'approved opted-in members can discover other approved members';
end $$;
insert into public.cofounder_connections(sender_id,recipient_id,message)
values ('00000000-0000-0000-0000-000000000811','00000000-0000-0000-0000-000000000812',
 'I would like to discuss whether our complementary experience could build a company together.');
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000812',false);
update public.cofounder_connections set status='accepted'
where sender_id='00000000-0000-0000-0000-000000000811' and recipient_id='00000000-0000-0000-0000-000000000812';
insert into public.cofounder_messages(connection_id,sender_id,body)
select id,'00000000-0000-0000-0000-000000000812','A private message for the accepted connection.'
from public.cofounder_connections
where sender_id='00000000-0000-0000-0000-000000000811' and recipient_id='00000000-0000-0000-0000-000000000812';
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000813',false);
do $$ begin
 assert not exists(select 1 from public.cofounder_messages),
   'unrelated users cannot read private co-founder messages';
end $$;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000813',false);
do $$ begin
 begin
  insert into public.cofounder_connections(sender_id,recipient_id,message)
  values ('00000000-0000-0000-0000-000000000813','00000000-0000-0000-0000-000000000812',
   'An unauthorized connection request should be rejected by row-level security.');
  raise exception 'unapproved user unexpectedly created a connection';
 exception when insufficient_privilege then null;
 end;
end $$;
reset role;

-- A member can never create a connection to themselves, even with direct SQL.
do $$ begin
 begin
  insert into public.cofounder_connections(sender_id,recipient_id,message)
  values ('00000000-0000-0000-0000-000000000811','00000000-0000-0000-0000-000000000811',
   'This invalid self-connection must be rejected by the table constraint.');
  raise exception 'self connection unexpectedly succeeded';
 exception when check_violation then null;
 end;
end $$;

update public.cofounder_profiles set is_paused=true where user_id='00000000-0000-0000-0000-000000000812';
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000811',false);
do $$ begin
 assert not exists(select 1 from public.cofounder_profiles where user_id='00000000-0000-0000-0000-000000000812'),
   'paused profiles are excluded from discovery';
end $$;
reset role;

\echo 'Phase 12 co-founder discovery tests passed'

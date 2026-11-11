-- Phase 10: Work marketplace RLS, invitation, contract, milestone and payment lifecycle.
\set ON_ERROR_STOP on
set search_path = "$user", public, extensions;
create function pg_temp.act_as(p_uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub',coalesce(p_uid,''),false);
  perform set_config('request.jwt.claim.role','authenticated',false);
end $$;

insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
 ('00000000-0000-0000-0000-000000000701','work-employer@test.dev',now(),'{"display_name":"Work Employer"}'),
 ('00000000-0000-0000-0000-000000000702','work-freelancer@test.dev',now(),'{"display_name":"Work Freelancer"}'),
 ('00000000-0000-0000-0000-000000000703','work-invitee@test.dev',now(),'{"display_name":"Invited Freelancer"}'),
 ('00000000-0000-0000-0000-000000000704','work-outsider@test.dev',now(),'{"display_name":"Work Outsider"}');
update public.profiles set username='work-employer',is_public_profile=true where id='00000000-0000-0000-0000-000000000701';
update public.profiles set username='work-freelancer',is_public_profile=true where id='00000000-0000-0000-0000-000000000702';
update public.profiles set username='work-invitee',is_public_profile=true where id='00000000-0000-0000-0000-000000000703';
update public.profiles set username='work-outsider',is_public_profile=true where id='00000000-0000-0000-0000-000000000704';

set role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-000000000702');
insert into public.work_profiles(user_id,headline,bio,skills,languages,experience_level,availability,is_public)
values('00000000-0000-0000-0000-000000000702','Full-stack product developer','I build accessible web products and help early-stage teams ship reliable software.',array['React','TypeScript'],array['English','Amharic'],'intermediate','available',true);
select pg_temp.act_as('00000000-0000-0000-0000-000000000703');
insert into public.work_profiles(user_id,headline,bio,skills,languages,experience_level,availability,is_public)
values('00000000-0000-0000-0000-000000000703','Brand and product designer','I design thoughtful digital products and brand systems for growing teams.',array['Figma','Product design'],array['English'],'expert','available',true);
reset role;

set role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-000000000701');
insert into public.work_projects(slug,employer_id,title,summary,description,category,skills,budget_type,budget_min,budget_max,currency,experience_level,work_location,status)
values('work-marketplace-test','00000000-0000-0000-0000-000000000701','Build a founder dashboard','Build a clean dashboard for an early-stage company.','The freelancer will build a responsive founder dashboard with authentication, a clear data overview, settings, and a documented handoff. Acceptance requires mobile support and a working deployment.','Software development',array['React','TypeScript'],'fixed',4000,6000,'ETB','intermediate','remote','published')
returning id as project_id \gset
select set_config('test.work_project_id', :'project_id', false);
reset role;

set role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-000000000702');
insert into public.work_proposals(project_id,freelancer_id,cover_letter,proposed_amount,estimated_days)
values(:'project_id','00000000-0000-0000-0000-000000000702',
'I can deliver this dashboard with a responsive interface, reusable components, accessible states, and a concise handoff. I have shipped similar React products and will agree on milestones before starting.',5000,14)
returning id as proposal_id \gset
select set_config('test.work_proposal_id', :'proposal_id', false);
reset role;

set role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-000000000701');
select public.hire_work_proposal(current_setting('test.work_proposal_id')::uuid) as contract_id \gset
select set_config('test.work_contract_id', :'contract_id', false);
reset role;

do $$ begin
 assert exists(select 1 from public.work_contracts where id=current_setting('test.work_contract_id')::uuid and status='active'),'hiring creates a private active contract';
 assert exists(select 1 from public.work_milestones where contract_id=current_setting('test.work_contract_id')::uuid and amount=5000),'hiring creates the agreed delivery milestone';
end $$;

select id as milestone_id from public.work_milestones where contract_id=current_setting('test.work_contract_id')::uuid \gset
select set_config('test.work_milestone_id', :'milestone_id', false);
set role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-000000000702');
insert into storage.objects(bucket_id,name,owner) values('work-deliverables',current_setting('test.work_contract_id')||'/00000000-0000-0000-0000-000000000702/deliverable.pdf','00000000-0000-0000-0000-000000000702');
select public.transition_work_milestone(current_setting('test.work_milestone_id')::uuid,'submit',current_setting('test.work_contract_id')||'/00000000-0000-0000-0000-000000000702/deliverable.pdf','Initial deliverable submitted for review.');
insert into storage.objects(bucket_id,name,owner) values('work-deliverables',current_setting('test.work_contract_id')||'/00000000-0000-0000-0000-000000000702/message.txt','00000000-0000-0000-0000-000000000702');
insert into public.work_messages(contract_id,sender_id,body,attachment_path)
values(current_setting('test.work_contract_id')::uuid,'00000000-0000-0000-0000-000000000702','I have submitted the first deliverable. Please review the dashboard.',current_setting('test.work_contract_id')||'/00000000-0000-0000-0000-000000000702/message.txt');
reset role;

set role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-000000000701');
select public.transition_work_milestone(current_setting('test.work_milestone_id')::uuid,'approve',null,'Approved after review.');
reset role;

insert into public.work_payment_transactions(milestone_id,contract_id,employer_id,freelancer_id,merchant_reference,amount_minor,currency)
values(current_setting('test.work_milestone_id')::uuid,current_setting('test.work_contract_id')::uuid,'00000000-0000-0000-0000-000000000701','00000000-0000-0000-0000-000000000702','BWPHASE10TEST00001',500000,'ETB')
returning id as payment_id \gset
select set_config('test.work_payment_id', :'payment_id', false);
set role service_role;
select set_config('request.jwt.claim.role','service_role',false);
select public.finalize_work_payment(current_setting('test.work_payment_id')::uuid,'CHAPA-PHASE10-TEST',500000,'ETB');
reset role;

do $$ begin
 assert exists(select 1 from public.work_payment_transactions where id=current_setting('test.work_payment_id')::uuid and status='succeeded'),'verified payment is recorded';
 assert exists(select 1 from public.work_milestones where id=current_setting('test.work_milestone_id')::uuid and status='paid'),'payment closes the milestone';
 assert exists(select 1 from public.work_contracts where id=current_setting('test.work_contract_id')::uuid and status='completed'),'all paid milestones complete the contract';
 assert exists(select 1 from public.work_public_history where id=current_setting('test.work_contract_id')::uuid),'completed work is exposed in the public work-history projection';
end $$;

set role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-000000000701');
insert into public.work_reviews(contract_id,reviewer_id,reviewee_id,rating,comment)
values(current_setting('test.work_contract_id')::uuid,'00000000-0000-0000-0000-000000000701','00000000-0000-0000-0000-000000000702',5,'Excellent communication, careful delivery and a reliable handoff.');
reset role;
set role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-000000000702');
insert into public.work_reviews(contract_id,reviewer_id,reviewee_id,rating,comment)
values(current_setting('test.work_contract_id')::uuid,'00000000-0000-0000-0000-000000000702','00000000-0000-0000-0000-000000000701',5,'Clear scope, responsive feedback and a professional working relationship.');
reset role;

-- Employer invites a second freelancer to another project; the response creates a normal proposal.
set role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-000000000701');
insert into public.work_projects(slug,employer_id,title,summary,description,category,skills,budget_type,budget_min,budget_max,currency,experience_level,work_location,status)
values('work-invitation-test','00000000-0000-0000-0000-000000000701','Design a product identity','Create a brand identity for a new digital product.','Create a compact brand system with logo direction, typography, color palette, and export-ready assets. Deliver source files and a short usage guide for the founding team.','Design',array['Figma','Brand design'],'fixed',1000,3000,'ETB','expert','remote','published')
returning id as invite_project_id \gset
select set_config('test.work_invite_project_id', :'invite_project_id', false);
insert into public.work_invitations(project_id,employer_id,freelancer_id,message)
values(current_setting('test.work_invite_project_id')::uuid,'00000000-0000-0000-0000-000000000701','00000000-0000-0000-0000-000000000703','Your product design portfolio looks relevant to this project. Would you like to submit a proposal?')
returning id as invitation_id \gset
select set_config('test.work_invitation_id', :'invitation_id', false);
reset role;
set role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-000000000703');
select public.respond_work_invitation(current_setting('test.work_invitation_id')::uuid,'accept',
'I would create a consistent visual system, test the core identity in product contexts, and deliver editable source files plus a short brand guide. I have experience designing brand systems for early-stage teams.',2000,10,'https://example.com/portfolio');
reset role;

do $$ begin
 assert exists(select 1 from public.work_invitations where id=current_setting('test.work_invitation_id')::uuid and status='accepted'),'invitation response is recorded';
 assert exists(select 1 from public.work_proposals where project_id=current_setting('test.work_invite_project_id')::uuid and freelancer_id='00000000-0000-0000-0000-000000000703'),'accepted invitation creates a proposal';
end $$;

-- A stranger cannot read private contract data or mutate a milestone.
set role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-000000000704');
do $$ begin
 assert (select count(*) from public.work_contracts where id=current_setting('test.work_contract_id')::uuid)=0,'non-participants cannot read contracts';
 assert (select count(*) from public.work_messages where contract_id=current_setting('test.work_contract_id')::uuid)=0,'non-participants cannot read private messages';
end $$;
reset role;

\echo 'Phase 10 Work marketplace tests passed'

-- Phase 10: progressive company intelligence, provenance and visibility.
\set ON_ERROR_STOP on
set search_path = "$user", public, extensions;

insert into auth.users (id,email,email_confirmed_at,raw_user_meta_data)
values ('00000000-0000-0000-0000-000000000701','company-intel-founder@test.dev',now(),'{"display_name":"Company Intel Founder"}');

insert into public.startups (id,slug,name,tagline,description,country,created_by,status)
values ('00000000-0000-0000-0000-000000000702','company-intel-test','Company Intel Test','Test company','A test company profile','ET','00000000-0000-0000-0000-000000000701','draft');

set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000701',false);

insert into public.startup_metrics (startup_id,metric_key,value,currency,visibility,source_status,created_by,reviewed_by,reviewed_at,review_note)
values
 ('00000000-0000-0000-0000-000000000702','revenue',12000,'USD','public','verified','00000000-0000-0000-0000-000000000701','00000000-0000-0000-0000-000000000701',now(),'fake review'),
 ('00000000-0000-0000-0000-000000000702','customers',40,null,'private','founder_reported','00000000-0000-0000-0000-000000000701',null,null,null),
 ('00000000-0000-0000-0000-000000000702','revenue_growth_pct',-12.5,null,'private','founder_reported','00000000-0000-0000-0000-000000000701',null,null,null);

insert into public.startup_funding_rounds (startup_id,round_name,amount,currency,visibility,source_status,created_by,reviewed_by,reviewed_at,review_note)
values ('00000000-0000-0000-0000-000000000702','Pre-seed',50000,'USD','public','verified','00000000-0000-0000-0000-000000000701','00000000-0000-0000-0000-000000000701',now(),'fake review');

insert into public.startup_data_claims (startup_id,claim_type,claim_text,visibility,source_status,created_by,reviewed_by,reviewed_at,review_note)
values ('00000000-0000-0000-0000-000000000702','customers','We serve 40 customers','public','verified','00000000-0000-0000-0000-000000000701','00000000-0000-0000-0000-000000000701',now(),'fake review');

insert into public.founder_company_history (founder_id,company_name,role_title,visibility)
values
 ('00000000-0000-0000-0000-000000000701','Private Previous Co','Founder','private'),
 ('00000000-0000-0000-0000-000000000701','Public Previous Co','Engineer','public');
reset role;

-- Promote only the fixture so public-policy visibility can be tested.
update public.startups set status='published' where id='00000000-0000-0000-0000-000000000702';

do $$ begin
 assert (select source_status='founder_reported' from public.startup_metrics where metric_key='revenue' and startup_id='00000000-0000-0000-0000-000000000702'),
   'founders cannot mark their own metrics verified';
 assert (select source_status='founder_reported' from public.startup_funding_rounds where startup_id='00000000-0000-0000-0000-000000000702'),
   'founders cannot mark their own funding rounds verified';
 assert (select source_status='founder_reported' from public.startup_data_claims where startup_id='00000000-0000-0000-0000-000000000702'),
   'founders cannot mark their own claims verified';
 assert (select reviewed_by is null and reviewed_at is null and review_note is null from public.startup_metrics where metric_key='revenue' and startup_id='00000000-0000-0000-0000-000000000702'),
   'founders cannot forge metric review metadata';
 assert (select reviewed_by is null and reviewed_at is null and review_note is null from public.startup_funding_rounds where startup_id='00000000-0000-0000-0000-000000000702'),
   'founders cannot forge funding-round review metadata';
 assert (select reviewed_by is null and reviewed_at is null and review_note is null from public.startup_data_claims where startup_id='00000000-0000-0000-0000-000000000702'),
   'founders cannot forge claim review metadata';
 assert (select count(*)=3 from public.startup_metrics where startup_id='00000000-0000-0000-0000-000000000702'),
   'founders can submit optional company metrics';
 assert (select value=-12.5 from public.startup_metrics where startup_id='00000000-0000-0000-0000-000000000702' and metric_key='revenue_growth_pct'),
   'negative growth percentages can represent contraction';
end $$;

set role anon;
select set_config('request.jwt.claim.sub','',false);
do $$ begin
 assert exists(select 1 from public.startup_metrics where startup_id='00000000-0000-0000-0000-000000000702' and metric_key='revenue'),
   'anonymous visitors can read the explicitly public revenue metric';
 assert not exists(select 1 from public.startup_metrics where startup_id='00000000-0000-0000-0000-000000000702' and visibility<>'public'),
   'anonymous visitors cannot read private or investor-only metrics';
 assert (select count(*)=1 from public.startup_funding_rounds where startup_id='00000000-0000-0000-0000-000000000702'),
   'anonymous visitors see only explicitly public funding rounds';
 assert (select count(*)=1 from public.founder_company_history where company_name in ('Private Previous Co','Public Previous Co')),
   'anonymous visitors see only explicitly public founder history';
end $$;
reset role;

\echo 'Phase 10 progressive company intelligence tests passed'

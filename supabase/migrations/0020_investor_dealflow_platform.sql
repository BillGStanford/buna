-- Buna 0020 — startup investment profiles and investor deal-flow workspace.
-- Adds structured company intelligence, saved thesis searches, private data rooms,
-- investor pipeline, company updates, and founder-interest analytics.

alter table public.startups
  add column problem_statement text,
  add column solution text,
  add column target_customers text[] not null default '{}',
  add column target_geographies text[] not null default '{}',
  add column market_opportunity text,
  add column business_model text,
  add column funding_round text,
  add column fundraising_status text not null default 'not_raising',
  add column funding_target numeric(14,2),
  add column funding_currency char(3) not null default 'USD',
  add constraint startups_problem_len check (problem_statement is null or char_length(problem_statement) <= 3000),
  add constraint startups_solution_len check (solution is null or char_length(solution) <= 3000),
  add constraint startups_market_len check (market_opportunity is null or char_length(market_opportunity) <= 3000),
  add constraint startups_business_model_len check (business_model is null or char_length(business_model) <= 80),
  add constraint startups_target_customers_size check (cardinality(target_customers) <= 12),
  add constraint startups_target_geographies_size check (cardinality(target_geographies) <= 12),
  add constraint startups_funding_round_check check (funding_round is null or funding_round in ('pre_seed','seed','series_a','series_b','series_c','growth','debt','grant','other')),
  add constraint startups_fundraising_status_check check (fundraising_status in ('not_raising','raising','open_to_conversations','closed')),
  add constraint startups_funding_target_check check (funding_target is null or funding_target >= 0),
  add constraint startups_funding_currency_check check (funding_currency ~ '^[A-Z]{3}$');

create index startups_fundraising_idx on public.startups(fundraising_status, funding_round) where status = 'published';
create index startups_target_geographies_idx on public.startups using gin(target_geographies);
create index startups_target_customers_idx on public.startups using gin(target_customers);

create table public.investor_saved_searches (
  id uuid primary key default gen_random_uuid(),
  investor_id uuid not null references public.investors(id) on delete cascade,
  name text not null,
  criteria jsonb not null default '{}'::jsonb,
  alerts_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint investor_saved_search_name_len check (char_length(name) between 2 and 80),
  constraint investor_saved_search_criteria_object check (jsonb_typeof(criteria) = 'object')
);
create index investor_saved_searches_investor_idx on public.investor_saved_searches(investor_id, created_at desc);
create trigger investor_saved_searches_updated_at before update on public.investor_saved_searches
  for each row execute function public.set_updated_at();
alter table public.investor_saved_searches enable row level security;
grant select, insert, update, delete on public.investor_saved_searches to authenticated;
create policy investor_saved_searches_owner_all on public.investor_saved_searches
  for all to authenticated using (public.is_active_user() and exists (
    select 1 from public.investor_accounts ia where ia.investor_id = investor_saved_searches.investor_id and ia.user_id = auth.uid()
  )) with check (public.is_active_user() and exists (
    select 1 from public.investor_accounts ia where ia.investor_id = investor_saved_searches.investor_id and ia.user_id = auth.uid()
  ));

create table public.investor_deals (
  id uuid primary key default gen_random_uuid(),
  investor_id uuid not null references public.investors(id) on delete cascade,
  startup_id uuid not null references public.startups(id) on delete cascade,
  stage text not null default 'discovered',
  notes text,
  source text not null default 'discovery',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint investor_deal_stage_check check (stage in ('discovered','contacted','reviewing','meeting','passed')),
  constraint investor_deal_notes_len check (notes is null or char_length(notes) <= 3000),
  unique(investor_id, startup_id)
);
create index investor_deals_pipeline_idx on public.investor_deals(investor_id, stage, updated_at desc);
create trigger investor_deals_updated_at before update on public.investor_deals
  for each row execute function public.set_updated_at();
alter table public.investor_deals enable row level security;
grant select, insert, update, delete on public.investor_deals to authenticated;
create policy investor_deals_owner_all on public.investor_deals
  for all to authenticated using (public.is_active_user() and exists (
    select 1 from public.investor_accounts ia where ia.investor_id = investor_deals.investor_id and ia.user_id = auth.uid()
  )) with check (public.is_active_user() and exists (
    select 1 from public.investor_accounts ia where ia.investor_id = investor_deals.investor_id and ia.user_id = auth.uid()
  ) and exists (select 1 from public.startups s where s.id = investor_deals.startup_id and s.status = 'published'));

create table public.startup_document_access_requests (
  id uuid primary key default gen_random_uuid(),
  startup_id uuid not null references public.startups(id) on delete cascade,
  investor_id uuid not null references public.investors(id) on delete cascade,
  requested_by uuid not null references public.profiles(id) on delete cascade,
  message text,
  status text not null default 'pending',
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint startup_doc_request_status_check check (status in ('pending','approved','declined')),
  constraint startup_doc_request_message_len check (message is null or char_length(message) <= 1000),
  unique(startup_id, investor_id)
);
create index startup_doc_requests_startup_idx on public.startup_document_access_requests(startup_id, status);
alter table public.startup_document_access_requests enable row level security;
grant select, insert on public.startup_document_access_requests to authenticated;
revoke update on public.startup_document_access_requests from authenticated;
grant update (status, message, reviewed_by, reviewed_at) on public.startup_document_access_requests to authenticated;
create policy startup_doc_requests_party_select on public.startup_document_access_requests for select to authenticated using (
  public.is_active_user() and (
    requested_by = auth.uid()
    or exists (select 1 from public.investor_accounts ia where ia.investor_id = startup_document_access_requests.investor_id and ia.user_id = auth.uid())
    or public.can_edit_startup(startup_id)
    or public.is_staff()
  )
);
create policy startup_doc_requests_investor_insert on public.startup_document_access_requests for insert to authenticated with check (
  requested_by = auth.uid() and status = 'pending' and reviewed_by is null and reviewed_at is null
  and public.is_active_user()
  and exists (select 1 from public.investor_accounts ia where ia.investor_id = investor_id and ia.user_id = auth.uid())
  and exists (select 1 from public.startups s where s.id = startup_id and s.status = 'published')
);
create policy startup_doc_requests_founder_review on public.startup_document_access_requests for update to authenticated
  using (public.is_active_user() and public.can_edit_startup(startup_id) and status = 'pending')
  with check (public.is_active_user() and public.can_edit_startup(startup_id) and status in ('approved','declined'));

create table public.startup_documents (
  id uuid primary key default gen_random_uuid(),
  startup_id uuid not null references public.startups(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  name text not null,
  document_type text not null default 'other',
  storage_path text not null unique,
  description text,
  created_at timestamptz not null default now(),
  constraint startup_document_name_len check (char_length(name) between 2 and 120),
  constraint startup_document_type_check check (document_type in ('pitch_deck','financials','product','legal','traction','other')),
  constraint startup_document_desc_len check (description is null or char_length(description) <= 500)
);
create index startup_documents_startup_idx on public.startup_documents(startup_id, created_at desc);
alter table public.startup_documents enable row level security;
grant select, insert, delete on public.startup_documents to authenticated;
create policy startup_documents_team_select on public.startup_documents for select to authenticated using (
  public.is_active_user() and public.can_edit_startup(startup_id)
);
create policy startup_documents_approved_investor_select on public.startup_documents for select to authenticated using (
  public.is_active_user() and exists (
    select 1 from public.startup_document_access_requests r
    join public.investor_accounts ia on ia.investor_id = r.investor_id
    where r.startup_id = startup_documents.startup_id and r.status = 'approved' and ia.user_id = auth.uid()
  )
);
create policy startup_documents_team_insert on public.startup_documents for insert to authenticated with check (
  uploaded_by = auth.uid() and public.is_active_user() and public.can_edit_startup(startup_id)
);
create policy startup_documents_team_delete on public.startup_documents for delete to authenticated using (
  public.is_active_user() and public.can_edit_startup(startup_id)
);

create table public.startup_updates (
  id uuid primary key default gen_random_uuid(),
  startup_id uuid not null references public.startups(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete restrict,
  title text not null,
  body text not null,
  created_at timestamptz not null default now(),
  constraint startup_update_title_len check (char_length(title) between 3 and 120),
  constraint startup_update_body_len check (char_length(body) between 10 and 3000)
);
create index startup_updates_startup_idx on public.startup_updates(startup_id, created_at desc);
alter table public.startup_updates enable row level security;
grant select, insert, delete on public.startup_updates to authenticated;
create policy startup_updates_team_all on public.startup_updates for all to authenticated using (
  public.is_active_user() and public.can_edit_startup(startup_id)
) with check (
  author_id = auth.uid() and public.is_active_user() and public.can_edit_startup(startup_id)
);
create policy startup_updates_interested_investor_select on public.startup_updates for select to authenticated using (
  public.is_active_user() and exists (
    select 1 from public.investor_accounts ia
    where ia.user_id = auth.uid() and (
      ia.investor_id in (select ss.investor_id from public.investor_saved_startups ss where ss.startup_id = startup_updates.startup_id)
      or ia.investor_id in (select sub.investor_id from public.investor_submissions sub where sub.startup_id = startup_updates.startup_id)
      or ia.investor_id in (select req.investor_id from public.startup_document_access_requests req where req.startup_id = startup_updates.startup_id)
    )
  )
);

-- Founder interest is counted from actual, authenticated introductions and deck-access requests.
create or replace view public.investor_interest_analytics
with (security_invoker = true) as
select i.id as investor_id,
       count(distinct s.id) filter (where s.created_at >= now() - interval '30 days') as founder_submissions_30d,
       count(distinct r.id) filter (where r.created_at >= now() - interval '30 days') as document_requests_30d,
       count(distinct s.id) as founder_submissions_total
from public.investors i
left join public.investor_submissions s on s.investor_id = i.id
left join public.startup_document_access_requests r on r.investor_id = i.id
group by i.id;
grant select on public.investor_interest_analytics to authenticated;

-- Saved thesis searches generate in-app deal alerts when a matching startup is published
-- or changes into active fundraising. Email delivery remains governed by existing notification preferences.
create or replace function public.notify_investor_saved_search_matches() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_search record;
  v_owner uuid;
  v_is_new_match boolean;
begin
  if new.status <> 'published' or new.is_demo then return new; end if;
  if tg_op = 'UPDATE' and old.status = 'published' and old.fundraising_status = new.fundraising_status
    and old.updated_at = new.updated_at then return new; end if;

  for v_search in
    select ss.id, ss.investor_id, ss.name, ss.criteria
    from public.investor_saved_searches ss
    where ss.alerts_enabled
      and (not (ss.criteria ? 'sectors') or jsonb_array_length(ss.criteria->'sectors') = 0 or exists (select 1 from public.categories c where c.id = new.category_id and (c.slug = any(array(select jsonb_array_elements_text(ss.criteria->'sectors'))) or c.id::text = any(array(select jsonb_array_elements_text(ss.criteria->'sectors'))))))
      and (not (ss.criteria ? 'stages') or jsonb_array_length(ss.criteria->'stages') = 0 or new.stage::text = any(array(select jsonb_array_elements_text(ss.criteria->'stages'))))
      and (not (ss.criteria ? 'geographies') or jsonb_array_length(ss.criteria->'geographies') = 0 or new.country = any(array(select jsonb_array_elements_text(ss.criteria->'geographies'))) or new.target_geographies && array(select jsonb_array_elements_text(ss.criteria->'geographies')))
      and (not (ss.criteria ? 'businessModels') or jsonb_array_length(ss.criteria->'businessModels') = 0 or new.business_model = any(array(select jsonb_array_elements_text(ss.criteria->'businessModels'))))
      and (not (ss.criteria ? 'fundingRounds') or jsonb_array_length(ss.criteria->'fundingRounds') = 0 or new.funding_round = any(array(select jsonb_array_elements_text(ss.criteria->'fundingRounds'))))
      and (coalesce(ss.criteria->>'fundraisingOnly','false') <> 'true' or new.fundraising_status in ('raising','open_to_conversations'))
      and (coalesce(ss.criteria->>'minTarget','') = '' or new.funding_target >= (ss.criteria->>'minTarget')::numeric)
      and (coalesce(ss.criteria->>'maxTarget','') = '' or new.funding_target <= (ss.criteria->>'maxTarget')::numeric)
      and (coalesce(ss.criteria->>'fundingCurrency','') = '' or new.funding_currency = upper(ss.criteria->>'fundingCurrency'))
  loop
    select ia.user_id into v_owner from public.investor_accounts ia where ia.investor_id = v_search.investor_id;
    if v_owner is not null then
      perform public.create_notification(v_owner, 'investor', 'A startup matches your saved search',
        new.name || ' matches "' || v_search.name || '" on Buna.',
        '/startups/' || new.slug, 'saved-search:' || v_search.id::text || ':' || new.id::text || ':' || new.updated_at::text, null);
    end if;
  end loop;
  return new;
end $$;
drop trigger if exists startups_saved_search_alert_trg on public.startups;
create trigger startups_saved_search_alert_trg after insert or update of status, category_id, stage, country, target_geographies, business_model, funding_round, fundraising_status, funding_currency on public.startups
for each row execute function public.notify_investor_saved_search_matches();

create or replace function public.notify_investors_of_startup_update() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_owner record;
begin
  for v_owner in
    select distinct ia.user_id
    from public.investor_accounts ia
    where ia.investor_id in (
      select ss.investor_id from public.investor_saved_startups ss where ss.startup_id = new.startup_id
      union
      select sub.investor_id from public.investor_submissions sub where sub.startup_id = new.startup_id
      union
      select req.investor_id from public.startup_document_access_requests req where req.startup_id = new.startup_id
    )
  loop
    perform public.create_notification(v_owner.user_id, 'investor', 'Startup activity update',
      new.title || ' — a startup on your saved list posted an update.',
      '/dashboard/investor/startups', 'startup-update:' || new.id::text || ':' || v_owner.user_id::text, null);
  end loop;
  return new;
end $$;
create trigger startup_update_investor_notification_trg after insert on public.startup_updates
for each row execute function public.notify_investors_of_startup_update();

-- Founders can see incoming interest without exposing investor private contact details.

-- Private storage for startup data rooms. Files are never exposed through public URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('startup-documents', 'startup-documents', false, 20971520,
  array['application/pdf','application/vnd.openxmlformats-officedocument.presentationml.presentation','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain'])
on conflict (id) do update set public = false, file_size_limit = 20971520;

create policy startup_documents_storage_team_insert on storage.objects for insert to authenticated
with check (
  case when bucket_id = 'startup-documents'
    and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  then public.can_edit_startup(((storage.foldername(name))[1])::uuid)
  else false end
);
create policy startup_documents_storage_team_select on storage.objects for select to authenticated
using (
  case when bucket_id = 'startup-documents'
    and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  then public.can_edit_startup(((storage.foldername(name))[1])::uuid)
    or exists (
      select 1 from public.startup_document_access_requests r
      join public.investor_accounts ia on ia.investor_id = r.investor_id
      where r.startup_id = ((storage.foldername(name))[1])::uuid and r.status = 'approved' and ia.user_id = auth.uid()
    )
  else false end
);
create policy startup_documents_storage_team_delete on storage.objects for delete to authenticated
using (
  case when bucket_id = 'startup-documents'
    and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  then public.can_edit_startup(((storage.foldername(name))[1])::uuid)
  else false end
);

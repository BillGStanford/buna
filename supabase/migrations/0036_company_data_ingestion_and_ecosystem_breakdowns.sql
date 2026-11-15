-- 0036: external-source staging and saved-search trigger correctness.
create table public.company_data_import_runs (
 id uuid primary key default gen_random_uuid(),
 source_id uuid not null references public.company_data_sources(id) on delete restrict,
 started_by uuid references public.profiles(id) on delete set null,
 status text not null default 'queued' check (status in ('queued','running','completed','failed','cancelled')),
 records_seen integer not null default 0 check (records_seen >= 0),
 records_imported integer not null default 0 check (records_imported >= 0),
 error_summary text check (error_summary is null or char_length(error_summary) <= 2000),
 started_at timestamptz,
 completed_at timestamptz,
 created_at timestamptz not null default now()
);
create table public.company_source_records (
 id uuid primary key default gen_random_uuid(),
 source_id uuid not null references public.company_data_sources(id) on delete restrict,
 import_run_id uuid references public.company_data_import_runs(id) on delete set null,
 external_record_id text,
 source_url text check (source_url is null or source_url ~* '^https?://'),
 proposed_company_name text not null check (char_length(proposed_company_name) between 2 and 160),
 normalized_name text not null,
 country char(2),
 raw_payload jsonb not null default '{}'::jsonb check (jsonb_typeof(raw_payload)='object'),
 proposed_startup_id uuid references public.startups(id) on delete set null,
 match_confidence numeric(4,3) check (match_confidence is null or match_confidence between 0 and 1),
 review_status text not null default 'pending' check (review_status in ('pending','matched','created','duplicate','rejected')),
 reviewed_by uuid references public.profiles(id) on delete set null,
 reviewed_at timestamptz,
 review_note text check (review_note is null or char_length(review_note) <= 1000),
 first_seen_at timestamptz not null default now(),
 last_seen_at timestamptz not null default now(),
 created_at timestamptz not null default now()
);
create unique index company_source_external_record_unique on public.company_source_records(source_id,external_record_id) where external_record_id is not null;
create index company_source_records_review_idx on public.company_source_records(review_status,created_at);
create index company_source_records_name_idx on public.company_source_records using gin(normalized_name gin_trgm_ops);
alter table public.company_data_import_runs enable row level security;
alter table public.company_source_records enable row level security;
grant select,insert,update on public.company_data_import_runs to authenticated;
grant select,insert,update on public.company_source_records to authenticated;
create policy company_import_runs_staff_all on public.company_data_import_runs for all to authenticated
 using (public.is_staff()) with check (public.is_staff());
create policy company_source_records_staff_all on public.company_source_records for all to authenticated
 using (public.is_staff()) with check (public.is_staff());

-- Saved-search alerts must re-evaluate when the target amount itself changes.
drop trigger if exists startups_saved_search_alert_trg on public.startups;
create trigger startups_saved_search_alert_trg
 after insert or update of status,category_id,stage,country,target_geographies,business_model,funding_round,fundraising_status,funding_target,funding_currency
 on public.startups for each row execute function public.notify_investor_saved_search_matches();

create or replace function public.published_ecosystem_country_breakdown()
returns table(country text, company_count bigint)
language sql stable security definer set search_path = '' as $$
 select s.country, count(*) from public.startups s
 where s.status='published' and s.is_demo=false and s.country is not null
 group by s.country order by count(*) desc, s.country
$$;
create or replace function public.published_ecosystem_sector_breakdown()
returns table(sector text, company_count bigint)
language sql stable security definer set search_path = '' as $$
 select c.name, count(*) from public.startups s
 join public.categories c on c.id=s.category_id
 where s.status='published' and s.is_demo=false
 group by c.name order by count(*) desc, c.name
$$;
revoke all on function public.published_ecosystem_country_breakdown() from public;
revoke all on function public.published_ecosystem_sector_breakdown() from public;
grant execute on function public.published_ecosystem_country_breakdown() to anon,authenticated;
grant execute on function public.published_ecosystem_sector_breakdown() to anon,authenticated;

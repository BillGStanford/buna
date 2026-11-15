-- 0033: progressive company intelligence. All enrichment is optional and never
-- participates in startup publication eligibility.
create table public.startup_metrics (
  id uuid primary key default gen_random_uuid(),
  startup_id uuid not null references public.startups(id) on delete cascade,
  metric_key text not null check (metric_key in ('revenue','customers','active_users','employees','revenue_growth_pct','customer_growth_pct')),
  value numeric(20,4) not null check (value >= 0),
  currency char(3),
  period_start date,
  period_end date,
  visibility text not null default 'investors' check (visibility in ('public','investors','private')),
  source_status text not null default 'founder_reported' check (source_status in ('founder_reported','verified','publicly_reported','estimated')),
  notes text check (notes is null or char_length(notes) <= 1000),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint startup_metrics_period_check check (period_start is null or period_end is null or period_start <= period_end),
  constraint startup_metrics_currency_check check (currency is null or currency ~ '^[A-Z]{3}$')
);
create unique index startup_metrics_period_unique on public.startup_metrics(startup_id, metric_key, coalesce(period_start, date '0001-01-01'), coalesce(period_end, date '0001-01-01'));
create index startup_metrics_startup_idx on public.startup_metrics(startup_id, metric_key, period_end desc);
create trigger startup_metrics_updated_at before update on public.startup_metrics for each row execute function public.set_updated_at();
alter table public.startup_metrics enable row level security;
grant select on public.startup_metrics to anon, authenticated;
grant insert, update, delete on public.startup_metrics to authenticated;
create policy startup_metrics_team_all on public.startup_metrics for all to authenticated
 using (public.is_active_user() and public.can_edit_startup(startup_id))
 with check (public.is_active_user() and public.can_edit_startup(startup_id));
create policy startup_metrics_public_read on public.startup_metrics for select to anon, authenticated
 using (visibility = 'public' and exists(select 1 from public.startups s where s.id = startup_id and s.status = 'published'));
create policy startup_metrics_approved_investor_read on public.startup_metrics for select to authenticated
 using (public.is_active_user() and visibility = 'investors' and exists (
   select 1 from public.investor_memberships im
   join public.startups s on s.id = startup_metrics.startup_id
   where im.user_id = auth.uid() and im.status = 'active' and s.status = 'published'
 ));

create table public.startup_funding_rounds (
 id uuid primary key default gen_random_uuid(),
 startup_id uuid not null references public.startups(id) on delete cascade,
 round_name text not null check (char_length(round_name) between 2 and 80),
 amount numeric(20,2) check (amount is null or amount >= 0),
 currency char(3) check (currency is null or currency ~ '^[A-Z]{3}$'),
 announced_on date,
 lead_investor text check (lead_investor is null or char_length(lead_investor) <= 160),
 other_investors text[] not null default '{}',
 source_url text check (source_url is null or source_url ~* '^https?://'),
 visibility text not null default 'investors' check (visibility in ('public','investors','private')),
 source_status text not null default 'founder_reported' check (source_status in ('founder_reported','verified','publicly_reported','estimated')),
 created_by uuid references public.profiles(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index startup_funding_rounds_startup_idx on public.startup_funding_rounds(startup_id, announced_on desc nulls last);
create trigger startup_funding_rounds_updated_at before update on public.startup_funding_rounds for each row execute function public.set_updated_at();
alter table public.startup_funding_rounds enable row level security;
grant select on public.startup_funding_rounds to anon, authenticated;
grant insert, update, delete on public.startup_funding_rounds to authenticated;
create policy startup_funding_rounds_team_all on public.startup_funding_rounds for all to authenticated
 using (public.is_active_user() and public.can_edit_startup(startup_id))
 with check (public.is_active_user() and public.can_edit_startup(startup_id));
create policy startup_funding_rounds_public_read on public.startup_funding_rounds for select to anon, authenticated
 using (visibility = 'public' and exists(select 1 from public.startups s where s.id = startup_id and s.status = 'published'));
create policy startup_funding_rounds_approved_investor_read on public.startup_funding_rounds for select to authenticated
 using (public.is_active_user() and visibility = 'investors' and exists (
   select 1 from public.investor_memberships im
   join public.startups s on s.id = startup_funding_rounds.startup_id
   where im.user_id = auth.uid() and im.status = 'active' and s.status = 'published'
 ));

create table public.startup_data_claims (
 id uuid primary key default gen_random_uuid(),
 startup_id uuid not null references public.startups(id) on delete cascade,
 claim_type text not null check (claim_type in ('founding_date','revenue','customers','growth','funding','market_presence','other')),
 claim_text text not null check (char_length(claim_text) between 2 and 2000),
 source_status text not null default 'founder_reported' check (source_status in ('founder_reported','verified','publicly_reported','estimated','disputed','not_disclosed')),
 visibility text not null default 'investors' check (visibility in ('public','investors','private')),
 reporting_period text,
 reviewed_by uuid references public.profiles(id) on delete set null,
 reviewed_at timestamptz,
 created_by uuid references public.profiles(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index startup_data_claims_startup_idx on public.startup_data_claims(startup_id, created_at desc);
create trigger startup_data_claims_updated_at before update on public.startup_data_claims for each row execute function public.set_updated_at();
alter table public.startup_data_claims enable row level security;
grant select on public.startup_data_claims to anon, authenticated;
grant insert, update, delete on public.startup_data_claims to authenticated;
create policy startup_claims_team_all on public.startup_data_claims for all to authenticated
 using (public.is_active_user() and public.can_edit_startup(startup_id))
 with check (public.is_active_user() and public.can_edit_startup(startup_id));
create policy startup_claims_public_read on public.startup_data_claims for select to anon, authenticated
 using (visibility = 'public' and exists(select 1 from public.startups s where s.id = startup_id and s.status = 'published'));
create policy startup_claims_approved_investor_read on public.startup_data_claims for select to authenticated
 using (public.is_active_user() and visibility = 'investors' and exists (
   select 1 from public.investor_memberships im
   join public.startups s on s.id = startup_data_claims.startup_id
   where im.user_id = auth.uid() and im.status = 'active' and s.status = 'published'
 ));

create table public.startup_claim_evidence (
 id uuid primary key default gen_random_uuid(),
 claim_id uuid not null references public.startup_data_claims(id) on delete cascade,
 evidence_url text not null check (evidence_url ~* '^https?://'),
 description text check (description is null or char_length(description) <= 500),
 added_by uuid references public.profiles(id) on delete set null,
 created_at timestamptz not null default now()
);
alter table public.startup_claim_evidence enable row level security;
grant select on public.startup_claim_evidence to anon, authenticated;
grant insert, delete on public.startup_claim_evidence to authenticated;
create policy startup_claim_evidence_team_all on public.startup_claim_evidence for all to authenticated
 using (exists(select 1 from public.startup_data_claims c where c.id = claim_id and public.can_edit_startup(c.startup_id)))
 with check (added_by = auth.uid() and exists(select 1 from public.startup_data_claims c where c.id = claim_id and public.can_edit_startup(c.startup_id)));
create policy startup_claim_evidence_public_read on public.startup_claim_evidence for select to anon, authenticated
 using (exists(select 1 from public.startup_data_claims c join public.startups s on s.id=c.startup_id where c.id=claim_id and c.visibility='public' and s.status='published'));
create policy startup_claim_evidence_investor_read on public.startup_claim_evidence for select to authenticated
 using (public.is_active_user() and exists(
   select 1 from public.startup_data_claims c
   join public.investor_memberships im on im.user_id=auth.uid() and im.status='active'
   join public.startups s on s.id=c.startup_id and s.status='published'
   where c.id=claim_id and c.visibility='investors'
 ));

create table public.founder_company_history (
 id uuid primary key default gen_random_uuid(),
 founder_id uuid not null references public.profiles(id) on delete cascade,
 startup_id uuid references public.startups(id) on delete set null,
 company_name text not null check (char_length(company_name) between 2 and 120),
 role_title text not null check (char_length(role_title) between 2 and 100),
 started_on date,
 ended_on date,
 description text check (description is null or char_length(description) <= 1000),
 visibility text not null default 'private' check (visibility in ('public','investors','private')),
 created_at timestamptz not null default now(),
 constraint founder_history_dates check (ended_on is null or started_on is null or ended_on >= started_on)
);
alter table public.founder_company_history enable row level security;
grant select on public.founder_company_history to anon, authenticated;
grant insert, update, delete on public.founder_company_history to authenticated;
create policy founder_history_owner_all on public.founder_company_history for all to authenticated
 using (founder_id = auth.uid() and public.is_active_user())
 with check (founder_id = auth.uid() and public.is_active_user());
create policy founder_history_public_read on public.founder_company_history for select to anon, authenticated
 using (visibility = 'public');

-- One notification per founder/startup/milestone. Dismissal and delivery are distinct.
create table public.startup_enrichment_nudges (
 id uuid primary key default gen_random_uuid(),
 startup_id uuid not null references public.startups(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 nudge_key text not null,
 delivered_at timestamptz not null default now(),
 dismissed_at timestamptz,
 unique(startup_id, user_id, nudge_key)
);
alter table public.startup_enrichment_nudges enable row level security;
grant select, update on public.startup_enrichment_nudges to authenticated;
create policy enrichment_nudges_owner_read on public.startup_enrichment_nudges for select to authenticated
 using (user_id = auth.uid());
create policy enrichment_nudges_owner_dismiss on public.startup_enrichment_nudges for update to authenticated
 using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Staff-managed source catalogue. No crawler is permitted to publish directly from this table.
create table public.company_data_sources (
 id uuid primary key default gen_random_uuid(),
 name text not null check (char_length(name) between 2 and 120),
 source_type text not null check (source_type in ('registry','accelerator','publication','company_website','open_dataset','licensed_provider','manual')),
 base_url text check (base_url is null or base_url ~* '^https?://'),
 country char(2),
 terms_url text check (terms_url is null or terms_url ~* '^https?://'),
 is_active boolean not null default true,
 notes text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.company_data_sources enable row level security;
grant select, insert, update, delete on public.company_data_sources to authenticated;
create policy company_data_sources_staff_all on public.company_data_sources for all to authenticated
 using (public.is_staff()) with check (public.is_staff());

create or replace function public.published_ecosystem_overview()
returns table(total_companies bigint, countries bigint, sectors bigint, disclosed_funding_rounds bigint)
language sql stable security definer set search_path = '' as $$
 select count(distinct s.id),
        count(distinct s.country),
        count(distinct s.category_id),
        (select count(*) from public.startup_funding_rounds f join public.startups fs on fs.id=f.startup_id where fs.status='published' and f.visibility='public' and f.amount is not null)
 from public.startups s where s.status='published' and s.is_demo=false
$$;
revoke all on function public.published_ecosystem_overview() from public;
grant execute on function public.published_ecosystem_overview() to anon, authenticated;

-- Buna 0022 — first-party audience intelligence.
-- Raw events contain only pseudonymous random IDs and coarse dimensions; never store IP addresses,
-- full referrer URLs, query strings, emails, or browser fingerprints.

create table public.startup_analytics_events (
  id bigint generated always as identity primary key,
  startup_id uuid not null references public.startups(id) on delete cascade,
  event_type text not null check (event_type in ('page_view', 'product_click', 'website_click', 'launch_view', 'follow', 'inquiry')),
  visitor_id uuid not null,
  session_id uuid not null,
  source text not null default 'direct' check (char_length(source) between 1 and 80),
  campaign text,
  referrer_domain text,
  country_code text not null default 'ZZ' check (country_code ~ '^[A-Z]{2}
  device_type text not null default 'unknown' check (device_type in ('mobile', 'desktop', 'tablet', 'unknown')),
  path text not null default '/' check (char_length(path) <= 180 and left(path, 1) = '/' and path !~ '[?]'),
  occurred_at timestamptz not null default now()
);
create index startup_analytics_events_startup_time_idx on public.startup_analytics_events(startup_id, occurred_at desc);
create index startup_analytics_events_startup_type_time_idx on public.startup_analytics_events(startup_id, event_type, occurred_at desc);
create index startup_analytics_events_startup_visitor_idx on public.startup_analytics_events(startup_id, visitor_id, occurred_at);
create index startup_analytics_events_source_idx on public.startup_analytics_events(startup_id, source, occurred_at desc);

create table public.startup_analytics_visitors (
  startup_id uuid not null references public.startups(id) on delete cascade,
  visitor_id uuid not null,
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  first_source text not null,
  first_country_code text not null default 'ZZ',
  primary key (startup_id, visitor_id)
);
create index startup_analytics_visitors_first_seen_idx on public.startup_analytics_visitors(startup_id, first_seen_at);

create table public.startup_analytics_daily_visitors (
  startup_id uuid not null references public.startups(id) on delete cascade,
  day date not null,
  visitor_id uuid not null,
  source text not null,
  country_code text,
  device_type text not null,
  primary key (startup_id, day, visitor_id, source, country_code, device_type)
);

create table public.startup_analytics_daily (
  startup_id uuid not null references public.startups(id) on delete cascade,
  day date not null,
  event_type text not null,
  source text not null,
  country_code text,
  device_type text not null,
  event_count bigint not null default 0,
  unique_visitors bigint not null default 0,
  primary key (startup_id, day, event_type, source, country_code, device_type)
);
create index startup_analytics_daily_lookup_idx on public.startup_analytics_daily(startup_id, day desc);

create function public.aggregate_startup_analytics_event() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_day date := (new.occurred_at at time zone 'utc')::date;
  v_new_visitor boolean;
  v_inserted bigint;
begin
  insert into public.startup_analytics_visitors
    (startup_id, visitor_id, first_seen_at, last_seen_at, first_source, first_country_code)
  values (new.startup_id, new.visitor_id, new.occurred_at, new.occurred_at, new.source, new.country_code)
  on conflict (startup_id, visitor_id) do update
    set last_seen_at = greatest(public.startup_analytics_visitors.last_seen_at, excluded.last_seen_at);

  insert into public.startup_analytics_daily_visitors
    (startup_id, day, visitor_id, source, country_code, device_type)
  values (new.startup_id, v_day, new.visitor_id, new.source, new.country_code, new.device_type)
  on conflict do nothing;
  get diagnostics v_inserted = row_count;
  v_new_visitor := v_inserted > 0;

  insert into public.startup_analytics_daily
    (startup_id, day, event_type, source, country_code, device_type, event_count, unique_visitors)
  values (new.startup_id, v_day, new.event_type, new.source, new.country_code, new.device_type, 1,
          case when v_new_visitor then 1 else 0 end)
  on conflict (startup_id, day, event_type, source, country_code, device_type)
  do update set event_count = public.startup_analytics_daily.event_count + 1,
                unique_visitors = public.startup_analytics_daily.unique_visitors + excluded.unique_visitors;
  return new;
end $$;
create trigger startup_analytics_event_aggregate
  after insert on public.startup_analytics_events
  for each row execute function public.aggregate_startup_analytics_event();

-- No browser or signed-in client can read or write analytics tables directly.
alter table public.startup_analytics_events enable row level security;
alter table public.startup_analytics_visitors enable row level security;
alter table public.startup_analytics_daily_visitors enable row level security;
alter table public.startup_analytics_daily enable row level security;
revoke all on public.startup_analytics_events, public.startup_analytics_visitors,
  public.startup_analytics_daily_visitors, public.startup_analytics_daily from anon, authenticated;
grant select, insert, delete on public.startup_analytics_events to service_role;
grant select, insert, update, delete on public.startup_analytics_visitors to service_role;
grant select, insert, update, delete on public.startup_analytics_daily_visitors to service_role;
grant select, insert, update, delete on public.startup_analytics_daily to service_role;
grant usage, select on sequence public.startup_analytics_events_id_seq to service_role;

-- Raw event retention: keep 13 months for longitudinal cohorts; aggregate tables remain available.
create function public.prune_startup_analytics_events() returns bigint
language plpgsql security definer set search_path = '' as $$
declare v_deleted bigint;
begin
  delete from public.startup_analytics_events where occurred_at < now() - interval '13 months';
  get diagnostics v_deleted = row_count;
  return v_deleted;
end $$;
revoke all on function public.prune_startup_analytics_events() from public, anon, authenticated;
grant execute on function public.prune_startup_analytics_events() to service_role;
),
  device_type text not null default 'unknown' check (device_type in ('mobile', 'desktop', 'tablet', 'unknown')),
  path text not null default '/' check (char_length(path) <= 180 and left(path, 1) = '/' and path !~ '[?]'),
  occurred_at timestamptz not null default now()
);
create index startup_analytics_events_startup_time_idx on public.startup_analytics_events(startup_id, occurred_at desc);
create index startup_analytics_events_startup_type_time_idx on public.startup_analytics_events(startup_id, event_type, occurred_at desc);
create index startup_analytics_events_startup_visitor_idx on public.startup_analytics_events(startup_id, visitor_id, occurred_at);
create index startup_analytics_events_source_idx on public.startup_analytics_events(startup_id, source, occurred_at desc);

create table public.startup_analytics_visitors (
  startup_id uuid not null references public.startups(id) on delete cascade,
  visitor_id uuid not null,
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  first_source text not null,
  first_country_code text,
  primary key (startup_id, visitor_id)
);
create index startup_analytics_visitors_first_seen_idx on public.startup_analytics_visitors(startup_id, first_seen_at);

create table public.startup_analytics_daily_visitors (
  startup_id uuid not null references public.startups(id) on delete cascade,
  day date not null,
  visitor_id uuid not null,
  source text not null,
  country_code text,
  device_type text not null,
  primary key (startup_id, day, visitor_id, source, country_code, device_type)
);

create table public.startup_analytics_daily (
  startup_id uuid not null references public.startups(id) on delete cascade,
  day date not null,
  event_type text not null,
  source text not null,
  country_code text,
  device_type text not null,
  event_count bigint not null default 0,
  unique_visitors bigint not null default 0,
  primary key (startup_id, day, event_type, source, country_code, device_type)
);
create index startup_analytics_daily_lookup_idx on public.startup_analytics_daily(startup_id, day desc);

create function public.aggregate_startup_analytics_event() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_day date := (new.occurred_at at time zone 'utc')::date;
  v_new_visitor boolean;
begin
  insert into public.startup_analytics_visitors
    (startup_id, visitor_id, first_seen_at, last_seen_at, first_source, first_country_code)
  values (new.startup_id, new.visitor_id, new.occurred_at, new.occurred_at, new.source, new.country_code)
  on conflict (startup_id, visitor_id) do update
    set last_seen_at = greatest(public.startup_analytics_visitors.last_seen_at, excluded.last_seen_at);

  insert into public.startup_analytics_daily_visitors
    (startup_id, day, visitor_id, source, country_code, device_type)
  values (new.startup_id, v_day, new.visitor_id, new.source, new.country_code, new.device_type)
  on conflict do nothing;
  get diagnostics v_new_visitor = row_count;

  insert into public.startup_analytics_daily
    (startup_id, day, event_type, source, country_code, device_type, event_count, unique_visitors)
  values (new.startup_id, v_day, new.event_type, new.source, new.country_code, new.device_type, 1,
          case when v_new_visitor then 1 else 0 end)
  on conflict (startup_id, day, event_type, source, country_code, device_type)
  do update set event_count = public.startup_analytics_daily.event_count + 1,
                unique_visitors = public.startup_analytics_daily.unique_visitors + excluded.unique_visitors;
  return new;
end $$;
create trigger startup_analytics_event_aggregate
  after insert on public.startup_analytics_events
  for each row execute function public.aggregate_startup_analytics_event();

-- No browser or signed-in client can read or write analytics tables directly.
alter table public.startup_analytics_events enable row level security;
alter table public.startup_analytics_visitors enable row level security;
alter table public.startup_analytics_daily_visitors enable row level security;
alter table public.startup_analytics_daily enable row level security;
revoke all on public.startup_analytics_events, public.startup_analytics_visitors,
  public.startup_analytics_daily_visitors, public.startup_analytics_daily from anon, authenticated;
grant select, insert, delete on public.startup_analytics_events to service_role;
grant select, insert, update, delete on public.startup_analytics_visitors to service_role;
grant select, insert, update, delete on public.startup_analytics_daily_visitors to service_role;
grant select, insert, update, delete on public.startup_analytics_daily to service_role;
grant usage, select on sequence public.startup_analytics_events_id_seq to service_role;

-- Raw event retention: keep 13 months for longitudinal cohorts; aggregate tables remain available.
create function public.prune_startup_analytics_events() returns bigint
language plpgsql security definer set search_path = '' as $$
declare v_deleted bigint;
begin
  delete from public.startup_analytics_events where occurred_at < now() - interval '13 months';
  get diagnostics v_deleted = row_count;
  return v_deleted;
end $$;
revoke all on function public.prune_startup_analytics_events() from public, anon, authenticated;
grant execute on function public.prune_startup_analytics_events() to service_role;

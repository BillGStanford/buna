-- 0040: first-party platform analytics, separate from startup analytics.
create table public.platform_analytics_events (
 id bigint generated always as identity primary key,
 event_type text not null check(event_type in ('page_view','signup_created','email_verified','onboarding_completed','launch_view','launch_published','launch_vote')),
 visitor_id uuid, session_id uuid,
 path text not null default '/' check(char_length(path)<=180 and left(path,1)='/' and path !~ '[?]'),
 source text not null default 'direct' check(char_length(source) between 1 and 80),
 campaign text check(campaign is null or char_length(campaign)<=120),
 referrer_domain text check(referrer_domain is null or char_length(referrer_domain)<=180),
 country_code text not null default 'ZZ' check(country_code ~ '^[A-Z]{2}$'),
 device_type text not null default 'unknown' check(device_type in ('mobile','desktop','tablet','unknown')),
 occurred_at timestamptz not null default now()
);
create index platform_analytics_events_time_idx on public.platform_analytics_events(occurred_at desc);
create index platform_analytics_events_type_time_idx on public.platform_analytics_events(event_type,occurred_at desc);
create table public.platform_analytics_visitors(visitor_id uuid primary key,first_seen_at timestamptz not null,last_seen_at timestamptz not null,first_source text not null,first_campaign text,first_referrer_domain text,first_country_code text not null default 'ZZ');
create table public.platform_analytics_daily(day date not null,event_type text not null,source text not null,campaign text not null default '',country_code text not null default 'ZZ',device_type text not null default 'unknown',event_count bigint not null default 0,unique_visitors bigint not null default 0,primary key(day,event_type,source,campaign,country_code,device_type));
create index platform_analytics_daily_day_idx on public.platform_analytics_daily(day desc);
create table public.platform_analytics_daily_visitors(day date not null,visitor_id uuid not null,source text not null,campaign text not null default '',country_code text not null default 'ZZ',device_type text not null default 'unknown',primary key(day,visitor_id));
create function public.aggregate_platform_analytics_event() returns trigger language plpgsql security definer set search_path='' as $$
declare d date := (new.occurred_at at time zone 'utc')::date; inserted bigint:=0;
begin
 if new.visitor_id is not null then
  insert into public.platform_analytics_visitors values(new.visitor_id,new.occurred_at,new.occurred_at,new.source,new.campaign,new.referrer_domain,new.country_code)
  on conflict(visitor_id) do update set last_seen_at=greatest(public.platform_analytics_visitors.last_seen_at,excluded.last_seen_at);
  if new.event_type='page_view' then
   insert into public.platform_analytics_daily_visitors values(d,new.visitor_id,new.source,coalesce(new.campaign,''),new.country_code,new.device_type) on conflict(day,visitor_id) do nothing;
   get diagnostics inserted=row_count;
  end if;
 end if;
 insert into public.platform_analytics_daily values(d,new.event_type,new.source,coalesce(new.campaign,''),new.country_code,new.device_type,1,inserted)
 on conflict(day,event_type,source,campaign,country_code,device_type) do update set event_count=public.platform_analytics_daily.event_count+1,unique_visitors=public.platform_analytics_daily.unique_visitors+excluded.unique_visitors;
 return new;
end $$;
create trigger platform_analytics_event_aggregate after insert on public.platform_analytics_events for each row execute function public.aggregate_platform_analytics_event();
alter table public.platform_analytics_events enable row level security;
alter table public.platform_analytics_visitors enable row level security;
alter table public.platform_analytics_daily enable row level security;
alter table public.platform_analytics_daily_visitors enable row level security;
revoke all on public.platform_analytics_events,public.platform_analytics_visitors,public.platform_analytics_daily,public.platform_analytics_daily_visitors from anon,authenticated;
grant select,insert,delete on public.platform_analytics_events to service_role;
grant select,insert,update,delete on public.platform_analytics_visitors,public.platform_analytics_daily,public.platform_analytics_daily_visitors to service_role;
grant usage,select on sequence public.platform_analytics_events_id_seq to service_role;
create function public.prune_platform_analytics_events() returns bigint language plpgsql security definer set search_path='' as $$
declare n bigint;
begin delete from public.platform_analytics_events where occurred_at<now()-interval '13 months'; get diagnostics n=row_count;
delete from public.platform_analytics_daily_visitors where day<(now()-interval '13 months')::date;
delete from public.platform_analytics_visitors where last_seen_at<now()-interval '13 months'; return n; end $$;
revoke all on function public.prune_platform_analytics_events() from public,anon,authenticated;
grant execute on function public.prune_platform_analytics_events() to service_role;
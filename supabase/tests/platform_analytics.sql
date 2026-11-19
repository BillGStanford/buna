-- Platform analytics aggregation and access-control regression checks.
do $$
declare
  v uuid := gen_random_uuid();
  d date := (now() at time zone 'utc')::date;
  event_total bigint;
  unique_total bigint;
begin
  if not (select relrowsecurity from pg_class where oid='public.platform_analytics_events'::regclass) then
    raise exception 'platform analytics events must have RLS enabled';
  end if;
  if has_table_privilege('anon','public.platform_analytics_events','select')
     or has_table_privilege('authenticated','public.platform_analytics_events','select') then
    raise exception 'platform analytics events must not be readable by anon/authenticated';
  end if;

  insert into public.platform_analytics_events(event_type,visitor_id,session_id,path,source,campaign,referrer_domain,country_code,device_type)
  values('page_view',v,gen_random_uuid(),'/about','reddit','launch-week','reddit.com','US','desktop');
  insert into public.platform_analytics_events(event_type,visitor_id,session_id,path,source,campaign,referrer_domain,country_code,device_type)
  values('page_view',v,gen_random_uuid(),'/launches','reddit','launch-week','reddit.com','US','desktop');

  if not exists(select 1 from public.platform_analytics_visitors where visitor_id=v and first_source='reddit') then
    raise exception 'first-touch visitor attribution was not recorded';
  end if;
  select coalesce(sum(event_count),0),coalesce(sum(unique_visitors),0)
    into event_total,unique_total
    from public.platform_analytics_daily
    where day=d and event_type='page_view' and source='reddit' and campaign='launch-week';
  if event_total<>2 then raise exception 'expected 2 page views in daily aggregate, got %',event_total; end if;
  if unique_total<>1 then raise exception 'expected 1 unique visitor for 2 page views, got %',unique_total; end if;
end $$;

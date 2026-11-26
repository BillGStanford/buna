-- regression-test: supabase/tests/admin_operations_suite.sql
-- 0054: operational support, disputes, imports, announcements and featured campaigns.
create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  email text not null check (char_length(email) between 3 and 320),
  subject text not null check (char_length(btrim(subject)) between 3 and 180),
  body text not null check (char_length(btrim(body)) between 5 and 8000),
  status text not null default 'open' check (status in ('open','triaged','waiting','resolved','closed')),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  assigned_to uuid references public.profiles(id) on delete set null,
  resolution_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index support_tickets_queue_idx on public.support_tickets(status, priority, created_at desc);
create trigger support_tickets_updated_at before update on public.support_tickets for each row execute function public.set_updated_at();

create table public.user_disputes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  subject text not null check (char_length(btrim(subject)) between 3 and 180),
  details text not null check (char_length(btrim(details)) between 5 and 8000),
  disputed_action text not null check (char_length(btrim(disputed_action)) between 2 and 120),
  status text not null default 'submitted' check (status in ('submitted','under_review','resolved','rejected')),
  decision text,
  reviewer_id uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index user_disputes_queue_idx on public.user_disputes(status, created_at desc);
create trigger user_disputes_updated_at before update on public.user_disputes for each row execute function public.set_updated_at();

alter table public.startups add column if not exists merged_into_startup_id uuid references public.startups(id) on delete set null;
create table public.startup_merge_history (
  id uuid primary key default gen_random_uuid(),
  source_startup_id uuid not null references public.startups(id) on delete restrict,
  target_startup_id uuid not null references public.startups(id) on delete restrict,
  actor_id uuid references public.profiles(id) on delete set null,
  note text not null check (char_length(btrim(note)) between 5 and 1000),
  created_at timestamptz not null default now(),
  check (source_startup_id <> target_startup_id),
  unique(source_startup_id)
);

create table public.admin_import_batches (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('startup','opportunity')),
  status text not null default 'preview' check (status in ('preview','processed','failed')),
  rows jsonb not null default '[]'::jsonb,
  row_count integer not null default 0 check (row_count between 0 and 1000),
  imported_count integer not null default 0,
  error_summary jsonb not null default '[]'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);
create index admin_import_batches_created_idx on public.admin_import_batches(created_at desc);

create table public.platform_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 3 and 160),
  body text not null check (char_length(btrim(body)) between 5 and 5000),
  target text not null default 'all' check (target in ('all','founders','investors')),
  target_url text,
  scheduled_at timestamptz not null default now(),
  status text not null default 'scheduled' check (status in ('scheduled','sent','cancelled')),
  sent_at timestamptz,
  sent_count integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (target_url is null or target_url ~ '^/')
);
create index platform_announcements_due_idx on public.platform_announcements(scheduled_at) where status='scheduled';

create table public.featured_startup_campaigns (
  id uuid primary key default gen_random_uuid(),
  startup_id uuid not null references public.startups(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 3 and 120),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled','active','completed','cancelled')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index featured_startup_campaigns_window_idx on public.featured_startup_campaigns(status, starts_at, ends_at);

alter table public.support_tickets enable row level security;
alter table public.user_disputes enable row level security;
alter table public.startup_merge_history enable row level security;
alter table public.admin_import_batches enable row level security;
alter table public.platform_announcements enable row level security;
alter table public.featured_startup_campaigns enable row level security;
revoke all on public.support_tickets, public.user_disputes, public.startup_merge_history, public.admin_import_batches, public.platform_announcements, public.featured_startup_campaigns from anon, authenticated;
grant all on public.support_tickets, public.user_disputes, public.startup_merge_history, public.admin_import_batches, public.platform_announcements, public.featured_startup_campaigns to service_role;

create or replace function public.admin_merge_startups(p_source uuid, p_target uuid, p_note text)
returns void language plpgsql security definer set search_path='' as $$
declare src public.startups%rowtype; dst public.startups%rowtype;
begin
 if not public.is_admin() then raise exception 'forbidden' using errcode='42501'; end if;
 if p_source = p_target or coalesce(length(btrim(p_note)),0)<5 then raise exception 'invalid_merge' using errcode='22023'; end if;
 select * into src from public.startups where id=p_source for update;
 select * into dst from public.startups where id=p_target for update;
 if src.id is null or dst.id is null then raise exception 'not_found' using errcode='P0002'; end if;
 if src.merged_into_startup_id is not null or src.status='removed' then raise exception 'invalid_state' using errcode='55000'; end if;
 if dst.status <> 'published' then raise exception 'target_must_be_published' using errcode='55000'; end if;
 insert into public.startup_merge_history(source_startup_id,target_startup_id,actor_id,note)
 values(p_source,p_target,auth.uid(),left(btrim(p_note),1000));
 insert into public.startup_members(startup_id,user_id,role,is_public,public_title)
 select p_target,user_id,role,is_public,public_title from public.startup_members where startup_id=p_source
 on conflict(startup_id,user_id) do nothing;
 delete from public.startup_members where startup_id=p_source;
 delete from public.startup_links sl where sl.startup_id=p_source and exists(select 1 from public.startup_links tl where tl.startup_id=p_target and tl.kind=sl.kind and tl.url=sl.url);
 update public.startup_products set startup_id=p_target where startup_id=p_source;
 update public.startup_media set startup_id=p_target where startup_id=p_source;
 update public.startup_links set startup_id=p_target where startup_id=p_source;
 update public.startup_changelog set startup_id=p_target where startup_id=p_source;
 update public.startup_milestones set startup_id=p_target where startup_id=p_source;
 update public.startup_announcements set startup_id=p_target where startup_id=p_source;
 update public.startup_correction_requests set startup_id=p_target where startup_id=p_source;
 update public.startups set status='removed',is_featured=false,merged_into_startup_id=p_target where id=p_source;
 perform public.audit('startup.merge','startup',p_source::text,jsonb_build_object('target_startup_id',p_target,'note',left(btrim(p_note),1000)));
end $$;
revoke all on function public.admin_merge_startups(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.admin_merge_startups(uuid,uuid,text) to authenticated;

create or replace function public.dispatch_due_platform_announcements()
returns integer language plpgsql security definer set search_path='' as $$
declare a public.platform_announcements%rowtype; n integer:=0;
begin
 for a in select * from public.platform_announcements where status='scheduled' and scheduled_at<=now() order by scheduled_at for update skip locked loop
   insert into public.notifications(user_id,type,title,body,url,data,dedupe_key)
   select p.id,'platform_announcement',a.title,a.body,a.target_url,jsonb_build_object('announcement_id',a.id), 'platform-announcement:'||a.id::text||':'||p.id::text
   from public.profiles p
   where not p.is_suspended and (a.target='all' or (a.target='founders' and p.founder_status in ('founder','cofounder_seeking')) or (a.target='investors' and p.founder_status='investor'))
   on conflict(user_id,dedupe_key) do nothing;
   get diagnostics n = row_count;
   update public.platform_announcements set status='sent',sent_at=now(),sent_count=n where id=a.id;
 end loop;
 return n;
end $$;
revoke all on function public.dispatch_due_platform_announcements() from public, anon, authenticated;
grant execute on function public.dispatch_due_platform_announcements() to service_role;

alter table public.featured_startup_campaigns add column if not exists was_featured_before boolean not null default false;
create or replace function public.sync_featured_startup_campaigns()
returns integer language plpgsql security definer set search_path='' as $$
declare changed integer:=0; n integer:=0;
begin
 update public.featured_startup_campaigns set status='completed'
 where status='scheduled' and ends_at<=now();
 get diagnostics n=row_count; changed:=changed+n;
 update public.featured_startup_campaigns set status='active'
 where status='scheduled' and starts_at<=now() and ends_at>now();
 get diagnostics n=row_count; changed:=changed+n;
 update public.startups s set is_featured=true
 where exists(select 1 from public.featured_startup_campaigns c where c.startup_id=s.id and c.status='active' and c.starts_at<=now() and c.ends_at>now());
 update public.featured_startup_campaigns set status='completed'
 where status='active' and ends_at<=now();
 get diagnostics n=row_count; changed:=changed+n;
 update public.startups s set is_featured=coalesce((
   select c.was_featured_before from public.featured_startup_campaigns c
   where c.startup_id=s.id and c.status='completed' order by c.ends_at desc limit 1
 ),false)
 where not exists(select 1 from public.featured_startup_campaigns c where c.startup_id=s.id and c.status='active');
 return changed;
end $$;
revoke all on function public.sync_featured_startup_campaigns() from public,anon,authenticated;
grant execute on function public.sync_featured_startup_campaigns() to service_role;

create or replace function public.resolve_merged_startup_slug(p_slug citext)
returns citext language sql stable security definer set search_path='' as $$
 select target.slug
 from public.startups source
 join public.startups target on target.id=source.merged_into_startup_id
 where source.slug=p_slug and target.status='published'
 limit 1
$$;
revoke all on function public.resolve_merged_startup_slug(citext) from public;
grant execute on function public.resolve_merged_startup_slug(citext) to anon,authenticated;

-- Preserve downstream references and analytics when a listing is merged.
create or replace function public.transfer_merged_startup_references()
returns trigger language plpgsql security definer set search_path='' as $$
declare source_id uuid:=new.id; target_id uuid:=new.merged_into_startup_id;
begin
 if target_id is null or old.merged_into_startup_id is not null then return new; end if;
 update public.launches set startup_id=target_id where startup_id=source_id;
 update public.investor_submissions set startup_id=target_id where startup_id=source_id;
 delete from public.investor_saved_startups x where x.startup_id=source_id and exists(select 1 from public.investor_saved_startups y where y.startup_id=target_id and y.investor_id=x.investor_id);
 update public.investor_saved_startups set startup_id=target_id where startup_id=source_id;
 delete from public.investor_deals x where x.startup_id=source_id and exists(select 1 from public.investor_deals y where y.startup_id=target_id and y.investor_id=x.investor_id);
 update public.investor_deals set startup_id=target_id where startup_id=source_id;
 delete from public.startup_document_access_requests x where x.startup_id=source_id and exists(select 1 from public.startup_document_access_requests y where y.startup_id=target_id and y.investor_id=x.investor_id);
 update public.startup_document_access_requests set startup_id=target_id where startup_id=source_id;
 update public.startup_documents set startup_id=target_id where startup_id=source_id;
 update public.startup_updates set startup_id=target_id where startup_id=source_id;
 update public.startup_metrics set startup_id=target_id where startup_id=source_id;
 update public.startup_funding_rounds set startup_id=target_id where startup_id=source_id;
 update public.startup_data_claims set startup_id=target_id where startup_id=source_id;
 update public.founder_company_history set startup_id=target_id where startup_id=source_id;
 delete from public.startup_enrichment_nudges x where x.startup_id=source_id and exists(select 1 from public.startup_enrichment_nudges y where y.startup_id=target_id and y.user_id=x.user_id and y.nudge_key=x.nudge_key);
 update public.startup_enrichment_nudges set startup_id=target_id where startup_id=source_id;
 update public.company_source_records set proposed_startup_id=target_id where proposed_startup_id=source_id;
 update public.startup_profile_change_log set startup_id=target_id where startup_id=source_id;
 update public.startup_analytics_events set startup_id=target_id where startup_id=source_id;
 insert into public.startup_analytics_visitors(startup_id,visitor_id,first_seen_at,last_seen_at,first_source,first_country_code)
 select target_id,visitor_id,first_seen_at,last_seen_at,first_source,first_country_code from public.startup_analytics_visitors where startup_id=source_id
 on conflict(startup_id,visitor_id) do update set first_seen_at=least(public.startup_analytics_visitors.first_seen_at,excluded.first_seen_at),last_seen_at=greatest(public.startup_analytics_visitors.last_seen_at,excluded.last_seen_at);
 delete from public.startup_analytics_visitors where startup_id=source_id;
 delete from public.startup_analytics_daily_visitors x where x.startup_id=source_id and exists(select 1 from public.startup_analytics_daily_visitors y where y.startup_id=target_id and y.day=x.day and y.visitor_id=x.visitor_id);
 update public.startup_analytics_daily_visitors set startup_id=target_id where startup_id=source_id;
 insert into public.startup_analytics_daily(startup_id,day,event_type,source,country_code,device_type,event_count,unique_visitors)
 select target_id,day,event_type,source,country_code,device_type,event_count,unique_visitors from public.startup_analytics_daily where startup_id=source_id
 on conflict(startup_id,day,event_type,source,country_code,device_type) do update set event_count=public.startup_analytics_daily.event_count+excluded.event_count,unique_visitors=greatest(public.startup_analytics_daily.unique_visitors,excluded.unique_visitors);
 delete from public.startup_analytics_daily where startup_id=source_id;
 return new;
end $$;
create trigger startups_transfer_merge_references after update of merged_into_startup_id on public.startups
for each row when (new.merged_into_startup_id is not null and old.merged_into_startup_id is null)
execute function public.transfer_merged_startup_references();
revoke all on function public.transfer_merged_startup_references() from public,anon,authenticated;

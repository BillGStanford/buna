-- Buna 0025 — individual investors and multi-member investor organisations.
-- Existing investor_accounts remain the canonical owner/private-contact record for backwards compatibility.
alter table public.investors
  add column if not exists entity_kind text not null default 'organization'
    check (entity_kind in ('individual','organization'));

alter table public.investor_applications
  add column if not exists entity_kind text not null default 'organization'
    check (entity_kind in ('individual','organization')),
  add column if not exists requested_role text not null default 'owner'
    check (requested_role in ('owner','partner','investment_manager','analyst','associate','member','observer'));

create table if not exists public.investor_memberships (
  id uuid primary key default gen_random_uuid(),
  investor_id uuid not null references public.investors(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member'
    check (role in ('owner','partner','investment_manager','analyst','associate','member','observer')),
  status text not null default 'active' check (status in ('active','suspended')),
  is_public boolean not null default true,
  added_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (investor_id,user_id)
);
create index if not exists investor_memberships_user_idx on public.investor_memberships(user_id,status);
create index if not exists investor_memberships_investor_idx on public.investor_memberships(investor_id,role);

-- Backfill the existing single-account owners into the team model.
insert into public.investor_memberships(investor_id,user_id,role,added_by)
select investor_id,user_id,'owner',user_id from public.investor_accounts
on conflict (investor_id,user_id) do nothing;

create trigger investor_memberships_updated_at before update on public.investor_memberships
  for each row execute function public.set_updated_at();

alter table public.investor_memberships enable row level security;
revoke all on public.investor_memberships from anon,authenticated;
grant select on public.investor_memberships to authenticated;

create or replace function public.has_investor_permission(p_investor uuid,p_permission text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.investor_memberships m
    where m.investor_id=p_investor and m.user_id=auth.uid() and m.status='active'
      and case p_permission
        when 'manage_team' then m.role in ('owner','partner')
        when 'manage_profile' then m.role in ('owner','partner','investment_manager')
        when 'manage_dealflow' then m.role in ('owner','partner','investment_manager','analyst','associate','member')
        when 'view_dealflow' then m.role in ('owner','partner','investment_manager','analyst','associate','member','observer')
        else false end
  )
$$;
revoke all on function public.has_investor_permission(uuid,text) from public,anon;
grant execute on function public.has_investor_permission(uuid,text) to authenticated;

create or replace function public.current_investor_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select m.investor_id from public.investor_memberships m
  where m.user_id=auth.uid() and m.status='active'
  order by case m.role when 'owner' then 0 when 'partner' then 1 else 2 end, m.created_at
  limit 1
$$;
revoke all on function public.current_investor_id() from public,anon;
grant execute on function public.current_investor_id() to authenticated;

create policy investor_memberships_read_team on public.investor_memberships for select to authenticated
using (public.has_investor_permission(investor_id,'view_dealflow') or user_id=auth.uid() or public.is_staff());

-- Membership writes are only possible through the guarded RPC below.
create or replace function public.manage_investor_membership(
  p_investor uuid,p_target_user uuid,p_role text,p_action text
) returns void language plpgsql security definer set search_path = '' as $$
declare v_actor_role text;
begin
  if not public.is_active_user() then raise exception 'inactive_user' using errcode='42501'; end if;
  select role into v_actor_role from public.investor_memberships
   where investor_id=p_investor and user_id=auth.uid() and status='active';
  if v_actor_role is null or v_actor_role not in ('owner','partner') then
    raise exception 'team_management_forbidden' using errcode='42501';
  end if;
  if p_action='remove' then
    if exists(select 1 from public.investor_memberships where investor_id=p_investor and user_id=p_target_user and role='owner') then
      raise exception 'cannot_remove_owner' using errcode='42501';
    end if;
    delete from public.investor_memberships where investor_id=p_investor and user_id=p_target_user;
  elsif p_action='set_role' then
    if p_role not in ('partner','investment_manager','analyst','associate','member','observer') then
      raise exception 'invalid_role' using errcode='22023';
    end if;
    if exists(select 1 from public.investor_memberships where investor_id=p_investor and user_id=p_target_user and role='owner') then
      raise exception 'cannot_change_owner_role' using errcode='42501';
    end if;
    update public.investor_memberships set role=p_role where investor_id=p_investor and user_id=p_target_user;
    if not found then raise exception 'member_not_found' using errcode='P0002'; end if;
  elsif p_action='add' then
    if p_role not in ('partner','investment_manager','analyst','associate','member','observer') then
      raise exception 'invalid_role' using errcode='22023';
    end if;
    if not exists(select 1 from public.profiles where id=p_target_user and not is_suspended) then
      raise exception 'member_unavailable' using errcode='P0002';
    end if;
    insert into public.investor_memberships(investor_id,user_id,role,added_by)
    values(p_investor,p_target_user,p_role,auth.uid())
    on conflict(investor_id,user_id) do update set role=excluded.role,status='active',added_by=auth.uid();
  else
    raise exception 'invalid_action' using errcode='22023';
  end if;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(auth.uid(),'investor.team.'||p_action,'investor',p_investor::text,
    jsonb_build_object('member_id',p_target_user,'role',p_role));
end $$;
revoke all on function public.manage_investor_membership(uuid,uuid,text,text) from public,anon;
grant execute on function public.manage_investor_membership(uuid,uuid,text,text) to authenticated;

-- The application review RPC now supports a natural person profile and approved team-member requests.
create or replace function public.review_investor_application(p_application uuid,p_decision text,p_note text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_app public.investor_applications%rowtype;
  v_investor uuid;
  v_slug text;
begin
  perform public.assert_staff();
  if p_decision not in ('approve','reject') then raise exception 'invalid_decision' using errcode='22023'; end if;
  select * into v_app from public.investor_applications where id=p_application for update;
  if not found then raise exception 'not_found' using errcode='P0002'; end if;
  if v_app.status<>'pending' then raise exception 'invalid_state' using errcode='22023'; end if;

  if p_decision='approve' then
    if v_app.existing_investor_id is not null then
      select i.id into v_investor from public.investors i
       where i.id=v_app.existing_investor_id and i.is_demo=false for update;
      if v_investor is null then raise exception 'listing_unavailable' using errcode='23505'; end if;
      if v_app.requested_role='owner' and exists(select 1 from public.investor_accounts where investor_id=v_investor) then
        raise exception 'listing_already_claimed' using errcode='23505';
      end if;
      if v_app.requested_role<>'owner' and not exists(select 1 from public.investor_accounts where investor_id=v_investor) then
        raise exception 'listing_requires_owner' using errcode='23505';
      end if;
      if v_app.requested_role='owner' then
        insert into public.investor_accounts(investor_id,user_id,contact_email,private_background)
        values(v_investor,v_app.user_id,v_app.contact_email,v_app.background);
      end if;
      insert into public.investor_memberships(investor_id,user_id,role,added_by)
      values(v_investor,v_app.user_id,v_app.requested_role,auth.uid())
      on conflict(investor_id,user_id) do update set role=excluded.role,status='active';
    else
      if v_app.requested_role<>'owner' then raise exception 'new_listing_requires_owner' using errcode='22023'; end if;
      v_slug:=trim(both '-' from left(regexp_replace(lower(v_app.organization_name),'[^a-z0-9]+','-','g'),50));
      if v_slug='' then v_slug:='investor'; end if;
      if exists(select 1 from public.investors where slug=v_slug) then
        v_slug:=left(v_slug,40)||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,8);
      end if;
      insert into public.investors(
        slug,name,description,website_url,contact_url,country,regions,stages,sectors,thesis,
        verification_status,is_published,created_by,investor_type,investment_min,investment_max,
        investment_currency,portfolio,entity_kind
      ) values(
        v_slug,v_app.organization_name,
        left(v_app.organization_name||' is an '||replace(v_app.investor_type,'_',' ')||
          case when cardinality(v_app.markets)>0 then ' investor active in '||array_to_string(v_app.markets,', ') else ' investor' end||'.',3000),
        v_app.website_url,null,null,v_app.markets,v_app.stages,v_app.sectors,null,
        'pending',true,v_app.user_id,v_app.investor_type,v_app.investment_min,v_app.investment_max,
        v_app.investment_currency,v_app.portfolio,v_app.entity_kind
      ) returning id into v_investor;
      insert into public.investor_accounts(investor_id,user_id,contact_email,private_background)
      values(v_investor,v_app.user_id,v_app.contact_email,v_app.background);
      insert into public.investor_memberships(investor_id,user_id,role,added_by)
      values(v_investor,v_app.user_id,'owner',v_app.user_id);
    end if;

    update public.investors set
      investor_type=v_app.investor_type,
      investment_min=coalesce(v_app.investment_min,investment_min),
      investment_max=coalesce(v_app.investment_max,investment_max),
      investment_currency=case when v_app.investment_min is not null or v_app.investment_max is not null then v_app.investment_currency else investment_currency end,
      portfolio=coalesce(v_app.portfolio,portfolio),
      website_url=coalesce(v_app.website_url,website_url),
      regions=case when cardinality(v_app.markets)>0 then v_app.markets else regions end,
      stages=case when cardinality(v_app.stages)>0 then v_app.stages else stages end,
      sectors=case when cardinality(v_app.sectors)>0 then v_app.sectors else sectors end,
      entity_kind=v_app.entity_kind
    where id=v_investor;
    update public.investor_applications set status='approved',review_note=nullif(left(coalesce(p_note,''),500),''),
      reviewed_by=auth.uid(),reviewed_at=now() where id=p_application;
    insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
      values(auth.uid(),'investor_application.approve','investor_application',p_application::text,
        jsonb_build_object('investor_id',v_investor,'user_id',v_app.user_id,'role',v_app.requested_role));
    perform public.create_notification(v_app.user_id,'investor','Investor access approved',
      'Your investor access has been approved. Open Investor Desk to continue.',
      '/dashboard/investor','investor-application:'||p_application::text,null);
  else
    update public.investor_applications set status='rejected',review_note=nullif(left(coalesce(p_note,''),500),''),
      reviewed_by=auth.uid(),reviewed_at=now() where id=p_application;
    insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
      values(auth.uid(),'investor_application.reject','investor_application',p_application::text,jsonb_build_object('user_id',v_app.user_id));
    perform public.create_notification(v_app.user_id,'investor','Investor application update',
      coalesce(nullif(left(coalesce(p_note,''),500),''),'Your application was not approved.'),
      '/dashboard/investor-portal','investor-application:'||p_application::text,null);
  end if;
  return v_investor;
end $$;
revoke all on function public.review_investor_application(uuid,text,text) from public,anon;
grant execute on function public.review_investor_application(uuid,text,text) to authenticated;

-- Replace legacy owner-only RLS with explicit team permissions.
drop policy if exists investor_submissions_party_select on public.investor_submissions;
create policy investor_submissions_party_select on public.investor_submissions for select to authenticated
using(public.is_active_user() and (founder_id=auth.uid() or public.has_investor_permission(investor_id,'view_dealflow') or public.is_staff()));
drop policy if exists investor_submissions_investor_update on public.investor_submissions;
create policy investor_submissions_investor_update on public.investor_submissions for update to authenticated
using(public.is_active_user() and public.has_investor_permission(investor_id,'manage_dealflow'))
with check(public.is_active_user() and public.has_investor_permission(investor_id,'manage_dealflow'));

drop policy if exists investor_messages_party_select on public.investor_submission_messages;
create policy investor_messages_party_select on public.investor_submission_messages for select to authenticated
using(public.is_active_user() and exists(
  select 1 from public.investor_submissions s where s.id=submission_id
  and (s.founder_id=auth.uid() or public.has_investor_permission(s.investor_id,'view_dealflow'))
));
drop policy if exists investor_messages_party_insert on public.investor_submission_messages;
create policy investor_messages_party_insert on public.investor_submission_messages for insert to authenticated
with check(sender_id=auth.uid() and public.is_active_user() and exists(
  select 1 from public.investor_submissions s where s.id=submission_id
  and (s.founder_id=auth.uid() or public.has_investor_permission(s.investor_id,'manage_dealflow'))
));

drop policy if exists investor_saved_startups_owner_all on public.investor_saved_startups;
drop policy if exists investor_saved_startups_team_all on public.investor_saved_startups;
create policy investor_saved_startups_team_all on public.investor_saved_startups for all to authenticated
using(public.is_active_user() and public.has_investor_permission(investor_id,'view_dealflow'))
with check(public.is_active_user() and public.has_investor_permission(investor_id,'manage_dealflow')
  and exists(select 1 from public.startups st where st.id=startup_id and st.status='published'));

-- Update team-facing investor RLS policies introduced by 0020.
drop policy if exists investor_saved_searches_owner_all on public.investor_saved_searches;
create policy investor_saved_searches_team_all on public.investor_saved_searches for all to authenticated
using(public.is_active_user() and public.has_investor_permission(investor_id,'view_dealflow'))
with check(public.is_active_user() and public.has_investor_permission(investor_id,'manage_dealflow'));
drop policy if exists investor_deals_owner_all on public.investor_deals;
create policy investor_deals_team_all on public.investor_deals for all to authenticated
using(public.is_active_user() and public.has_investor_permission(investor_id,'view_dealflow'))
with check(public.is_active_user() and public.has_investor_permission(investor_id,'manage_dealflow'));
drop policy if exists startup_doc_requests_party_select on public.startup_document_access_requests;
create policy startup_doc_requests_party_select on public.startup_document_access_requests for select to authenticated
using(public.is_active_user() and (
  requested_by=auth.uid() or public.is_staff() or public.has_investor_permission(investor_id,'view_dealflow')
  or exists(select 1 from public.startup_members sm where sm.startup_id=startup_document_access_requests.startup_id and sm.user_id=auth.uid() and sm.role in ('owner','admin','editor'))
));
drop policy if exists startup_doc_requests_investor_insert on public.startup_document_access_requests;
create policy startup_doc_requests_investor_insert on public.startup_document_access_requests for insert to authenticated
with check(public.is_active_user() and requested_by=auth.uid() and status='pending'
  and public.has_investor_permission(investor_id,'manage_dealflow'));
drop policy if exists startup_documents_approved_investor_select on public.startup_documents;
create policy startup_documents_approved_investor_select on public.startup_documents for select to authenticated
using(exists(select 1 from public.startup_document_access_requests r
  where r.startup_id=startup_documents.startup_id and r.status='approved'
  and public.has_investor_permission(r.investor_id,'view_dealflow')));
drop policy if exists startup_updates_interested_investor_select on public.startup_updates;
create policy startup_updates_interested_investor_select on public.startup_updates for select to authenticated
using(exists(select 1 from public.investor_saved_startups s
  where s.startup_id=startup_updates.startup_id and public.has_investor_permission(s.investor_id,'view_dealflow')));

-- Public roster is limited to explicitly active memberships and public profile fields.
grant select on public.investor_memberships to anon;
create policy investor_memberships_public_roster on public.investor_memberships for select to anon,authenticated
using(status='active' and is_public=true);

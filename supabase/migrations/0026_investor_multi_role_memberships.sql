-- Allow one investor team member to hold multiple simultaneous roles.
alter table public.investor_memberships
  add column if not exists roles text[] not null default array['member']::text[];

update public.investor_memberships
set roles = array[role]::text[]
where roles is null or roles = array['member']::text[] and role <> 'member';

alter table public.investor_memberships
  drop constraint if exists investor_memberships_roles_chk;
alter table public.investor_memberships
  add constraint investor_memberships_roles_chk check (
    cardinality(roles) between 1 and 6
    and roles <@ array['owner','partner','investment_manager','analyst','associate','member','observer']::text[]
    and cardinality(roles) = (select count(distinct r) from unnest(roles) r)
    and (not ('owner'=any(roles)) or cardinality(roles)=1)
  );

create or replace function public.sync_investor_membership_role()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op='INSERT' then
    if new.roles is null or new.roles=array['member']::text[] and new.role<>'member' then
      new.roles:=array[new.role]::text[];
    elsif cardinality(new.roles)>0 then
      new.role:=new.roles[1];
    end if;
  elsif new.roles is distinct from old.roles then
    new.role:=new.roles[1];
  elsif new.role is distinct from old.role then
    new.roles:=array[new.role]::text[];
  end if;
  return new;
end $$;

drop trigger if exists investor_memberships_sync_roles on public.investor_memberships;
create trigger investor_memberships_sync_roles
before insert or update of role,roles on public.investor_memberships
for each row execute function public.sync_investor_membership_role();

create or replace function public.has_investor_permission(p_investor uuid,p_permission text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.investor_memberships m
    where m.investor_id=p_investor and m.user_id=auth.uid() and m.status='active'
      and case p_permission
        when 'manage_team' then m.roles && array['owner','partner']::text[]
        when 'manage_profile' then m.roles && array['owner','partner','investment_manager']::text[]
        when 'manage_dealflow' then m.roles && array['owner','partner','investment_manager','analyst','associate','member']::text[]
        when 'view_dealflow' then m.roles && array['owner','partner','investment_manager','analyst','associate','member','observer']::text[]
        else false end
  )
$$;

create or replace function public.current_investor_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select m.investor_id from public.investor_memberships m
  where m.user_id=auth.uid() and m.status='active'
  order by case when 'owner'=any(m.roles) then 0 when 'partner'=any(m.roles) then 1 else 2 end, m.created_at
  limit 1
$$;

create or replace function public.manage_investor_membership_roles(
  p_investor uuid,p_target_user uuid,p_roles text[],p_action text
) returns void language plpgsql security definer set search_path = '' as $$
declare v_actor_roles text[];
begin
  if not public.is_active_user() then raise exception 'inactive_user' using errcode='42501'; end if;
  select roles into v_actor_roles from public.investor_memberships
   where investor_id=p_investor and user_id=auth.uid() and status='active';
  if v_actor_roles is null or not (v_actor_roles && array['owner','partner']::text[]) then
    raise exception 'team_management_forbidden' using errcode='42501';
  end if;

  if p_action='remove' then
    if exists(select 1 from public.investor_memberships where investor_id=p_investor and user_id=p_target_user and 'owner'=any(roles)) then
      raise exception 'cannot_remove_owner' using errcode='42501';
    end if;
    delete from public.investor_memberships where investor_id=p_investor and user_id=p_target_user;
  elsif p_action in ('add','set_roles') then
    if p_roles is null or cardinality(p_roles)<1 or cardinality(p_roles)>6
       or not (p_roles <@ array['partner','investment_manager','analyst','associate','member','observer']::text[])
       or cardinality(p_roles)<>(select count(distinct r) from unnest(p_roles) r) then
      raise exception 'invalid_roles' using errcode='22023';
    end if;
    if not exists(select 1 from public.profiles where id=p_target_user and not is_suspended) then
      raise exception 'member_unavailable' using errcode='P0002';
    end if;
    if exists(select 1 from public.investor_memberships where investor_id=p_investor and user_id=p_target_user and 'owner'=any(roles)) then
      raise exception 'cannot_change_owner_role' using errcode='42501';
    end if;
    if p_action='add' then
      insert into public.investor_memberships(investor_id,user_id,role,roles,added_by)
      values(p_investor,p_target_user,p_roles[1],p_roles,auth.uid())
      on conflict(investor_id,user_id) do update set role=excluded.role,roles=excluded.roles,status='active',added_by=auth.uid();
    else
      update public.investor_memberships set role=p_roles[1],roles=p_roles
       where investor_id=p_investor and user_id=p_target_user;
      if not found then raise exception 'member_not_found' using errcode='P0002'; end if;
    end if;
  else
    raise exception 'invalid_action' using errcode='22023';
  end if;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(auth.uid(),'investor.team.'||p_action,'investor',p_investor::text,
    jsonb_build_object('member_id',p_target_user,'roles',coalesce(to_jsonb(p_roles),'[]'::jsonb)));
end $$;
revoke all on function public.manage_investor_membership_roles(uuid,uuid,text[],text) from public,anon;
grant execute on function public.manage_investor_membership_roles(uuid,uuid,text[],text) to authenticated;

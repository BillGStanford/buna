-- regression-test: supabase/tests/member_block_management.sql
-- Buna 0047 — harden follow checks and let members manage their private block list.

create function public.member_block_relationship(p_target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.user_blocks b
     where (b.blocker_id = auth.uid() and b.blocked_id = p_target)
        or (b.blocker_id = p_target and b.blocked_id = auth.uid())
  )
$$;
revoke all on function public.member_block_relationship(uuid) from public, anon;
grant execute on function public.member_block_relationship(uuid) to authenticated;

drop policy follows_insert on public.follows;
create policy follows_insert on public.follows for insert to authenticated
  with check (
    follower_id = auth.uid()
    and public.is_active_user()
    and (target_type <> 'user' or not public.member_block_relationship(target_id))
  );

create or replace function public.get_public_profile_network_count(p_user uuid, p_kind text)
returns bigint
language plpgsql stable security definer set search_path = '' as $$
declare v_count bigint;
begin
  if p_kind not in ('followers', 'following') then
    raise exception 'invalid_network_kind' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.profiles p
     where p.id = p_user and not p.is_suspended
       and (p.is_public_profile or p.id = auth.uid())
       and (p.show_network or p.id = auth.uid())
  ) then return 0; end if;
  if auth.uid() is not null and exists (
    select 1 from public.user_blocks b
     where (b.blocker_id = p_user and b.blocked_id = auth.uid())
        or (b.blocker_id = auth.uid() and b.blocked_id = p_user)
  ) then return 0; end if;
  select count(*) into v_count
    from public.follows f
    join public.public_profiles pp
      on pp.id = case when p_kind = 'followers' then f.follower_id else f.target_id end
   where f.target_type = 'user'
     and (case when p_kind = 'followers' then f.target_id = p_user else f.follower_id = p_user end)
     and not exists (
       select 1 from public.user_blocks b
        where (b.blocker_id = p_user and b.blocked_id = pp.id)
           or (b.blocker_id = pp.id and b.blocked_id = p_user)
     );
  return coalesce(v_count, 0);
end
$$;

create function public.get_blocked_members()
returns table (id uuid, username text, display_name text, avatar_url text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.username::text, p.display_name, p.avatar_url
    from public.user_blocks b
    join public.profiles p on p.id = b.blocked_id
   where b.blocker_id = auth.uid()
   order by b.created_at desc, p.username
   limit 500
$$;
revoke all on function public.get_blocked_members() from public, anon;
grant execute on function public.get_blocked_members() to authenticated;

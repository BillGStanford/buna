-- regression-test: supabase/tests/personal_profiles_and_member_blocks.sql
-- Buna 0046 — richer member identity, controlled network visibility and member blocking.
-- Profile enrichment remains optional: no new field is required to publish a startup or use Buna.

alter table public.profiles
  add column banner_url text,
  add column show_network boolean not null default false,
  add constraint profiles_banner_url_chk
    check (banner_url is null or banner_url ~* '^https?://');
grant update (banner_url, show_network) on public.profiles to authenticated;

-- Member blocks are private. Neither party is notified and the relationship is not public.
create table public.user_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint user_blocks_no_self check (blocker_id <> blocked_id)
);
create index user_blocks_blocked_idx on public.user_blocks (blocked_id, blocker_id);
alter table public.user_blocks enable row level security;
grant select, insert, delete on public.user_blocks to authenticated;
create policy user_blocks_select_own on public.user_blocks
  for select to authenticated using (blocker_id = auth.uid());
create policy user_blocks_insert_own on public.user_blocks
  for insert to authenticated
  with check (blocker_id = auth.uid() and public.is_active_user());
create policy user_blocks_delete_own on public.user_blocks
  for delete to authenticated using (blocker_id = auth.uid());

-- Replace the public projection without widening access to private profile data.
-- Keep the original column order and append the new public-safe fields.
create or replace view public.public_profiles as
select
  p.id, p.username, p.display_name, p.avatar_url,
  case when p.is_public_profile then p.headline end as headline,
  case when p.is_public_profile then p.bio end as bio,
  case when p.is_public_profile and p.show_location then p.country end as country,
  case when p.is_public_profile and p.show_location then p.city end as city,
  case when p.is_public_profile then p.website_url end as website_url,
  case when p.is_public_profile then p.expertise else '{}'::text[] end as expertise,
  case when p.is_public_profile then p.interests else '{}'::text[] end as interests,
  (p.is_public_profile and p.is_discoverable_founder) as is_discoverable_founder,
  p.is_public_profile,
  case when p.is_public_profile and p.is_discoverable_founder then p.open_to else '{}'::text[] end as open_to,
  case when p.is_public_profile then p.banner_url end as banner_url,
  (p.is_public_profile and p.show_network) as show_network,
  case when p.is_public_profile then p.professional_role end as professional_role,
  case when p.is_public_profile then p.founder_status end as founder_status
from public.profiles p
where not p.is_suspended
  and (
    auth.uid() is null
    or p.id = auth.uid()
    or not exists (
      select 1 from public.user_blocks b
       where (b.blocker_id = p.id and b.blocked_id = auth.uid())
          or (b.blocker_id = auth.uid() and b.blocked_id = p.id)
    )
  );

-- Block/unblock is atomic with removing any existing follows in either direction.
create function public.block_member(p_target uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.is_active_user() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_target is null or p_target = auth.uid() then
    raise exception 'invalid_target' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_target and not p.is_suspended) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  insert into public.user_blocks (blocker_id, blocked_id)
  values (auth.uid(), p_target) on conflict do nothing;
  delete from public.follows f
   where f.target_type = 'user'
     and ((f.follower_id = auth.uid() and f.target_id = p_target)
       or (f.follower_id = p_target and f.target_id = auth.uid()));
end
$$;

create function public.unblock_member(p_target uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.is_active_user() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from public.user_blocks where blocker_id = auth.uid() and blocked_id = p_target;
end
$$;
revoke all on function public.block_member(uuid) from public, anon;
revoke all on function public.unblock_member(uuid) from public, anon;
grant execute on function public.block_member(uuid) to authenticated;
grant execute on function public.unblock_member(uuid) to authenticated;

-- Do not allow new follows across a block in either direction.
drop policy follows_insert on public.follows;
create policy follows_insert on public.follows for insert to authenticated
  with check (
    follower_id = auth.uid()
    and public.is_active_user()
    and (
      target_type <> 'user'
      or not exists (
        select 1 from public.user_blocks b
         where (b.blocker_id = auth.uid() and b.blocked_id = target_id)
            or (b.blocker_id = target_id and b.blocked_id = auth.uid())
      )
    )
  );

-- Public network lists are opt-in. The owner can always inspect their own lists.
create function public.get_public_profile_network(p_user uuid, p_kind text)
returns table (id uuid, username text, display_name text, avatar_url text, headline text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_kind not in ('followers', 'following') then
    raise exception 'invalid_network_kind' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.profiles p
     where p.id = p_user and not p.is_suspended
       and (p.is_public_profile or p.id = auth.uid())
       and (p.show_network or p.id = auth.uid())
  ) then return; end if;
  if auth.uid() is not null and exists (
    select 1 from public.user_blocks b
     where (b.blocker_id = p_user and b.blocked_id = auth.uid())
        or (b.blocker_id = auth.uid() and b.blocked_id = p_user)
  ) then return; end if;

  return query
  select pp.id, pp.username::text, pp.display_name, pp.avatar_url, pp.headline
    from public.follows f
    join public.public_profiles pp
      on pp.id = case when p_kind = 'followers' then f.follower_id else f.target_id end
   where f.target_type = 'user'
     and (case when p_kind = 'followers' then f.target_id = p_user else f.follower_id = p_user end)
   order by f.created_at desc, pp.username
   limit 100;
end
$$;

create function public.get_public_profile_network_count(p_user uuid, p_kind text)
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
  select count(*) into v_count from public.follows f
   where f.target_type = 'user'
     and (case when p_kind = 'followers' then f.target_id = p_user else f.follower_id = p_user end);
  return coalesce(v_count, 0);
end
$$;

revoke all on function public.get_public_profile_network(uuid, text) from public;
revoke all on function public.get_public_profile_network_count(uuid, text) from public;
grant execute on function public.get_public_profile_network(uuid, text) to anon, authenticated;
grant execute on function public.get_public_profile_network_count(uuid, text) to anon, authenticated;

-- Public profile banners are separate from avatars so users can change either independently.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-banners', 'profile-banners', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
create policy profile_banners_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'profile-banners' and (storage.foldername(name))[1] = auth.uid()::text and public.is_active_user());
create policy profile_banners_update on storage.objects for update to authenticated
  using (bucket_id = 'profile-banners' and (storage.foldername(name))[1] = auth.uid()::text);
create policy profile_banners_delete on storage.objects for delete to authenticated
  using (bucket_id = 'profile-banners' and (storage.foldername(name))[1] = auth.uid()::text);

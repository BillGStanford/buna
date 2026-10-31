-- Buna 0012 — expose only public profile social links through a narrow RPC.
-- The profiles.social_links column already exists; this migration adds a safe read path
-- without widening the public_profiles view or exposing any other profile columns.

create or replace function public.get_public_profile_social_links(p_user uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(p.social_links, '{}'::jsonb)
    from public.profiles p
   where p.id = p_user
     and not p.is_suspended
     and (p.is_public_profile or p.id = auth.uid())
$$;

revoke all on function public.get_public_profile_social_links(uuid) from public;
grant execute on function public.get_public_profile_social_links(uuid) to anon, authenticated;

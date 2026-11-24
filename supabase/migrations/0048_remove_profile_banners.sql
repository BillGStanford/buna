-- regression-test: supabase/tests/remove_profile_banners.sql
-- Remove profile banner support. Storage object deletion must use the Storage API;
-- this migration disables the legacy bucket and leaves existing objects for API cleanup.
drop policy if exists profile_banners_insert on storage.objects;
drop policy if exists profile_banners_update on storage.objects;
drop policy if exists profile_banners_delete on storage.objects;
update storage.buckets set public = false where id = 'profile-banners';

-- Rebuild the public projection without banner_url before dropping its source column.
drop view public.public_profiles;
create view public.public_profiles as
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
grant select on public.public_profiles to anon, authenticated;
alter table public.profiles drop constraint if exists profiles_banner_url_chk;
alter table public.profiles drop column if exists banner_url;

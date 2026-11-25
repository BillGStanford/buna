-- regression-test: supabase/tests/profile_contact_preferences.sql
-- Add a public contact address and preferred contact channel.
alter table public.profiles
  add column if not exists contact_email text,
  add column if not exists primary_contact_method text not null default 'none';

alter table public.profiles
  drop constraint if exists profiles_primary_contact_method_check,
  add constraint profiles_primary_contact_method_check
    check (primary_contact_method in ('none','email','website','linkedin','x','github','instagram','youtube','tiktok','facebook','threads','bluesky','mastodon','other')),
  drop constraint if exists profiles_contact_email_check,
  add constraint profiles_contact_email_check
    check (contact_email is null or (position('@' in contact_email) > 1 and position('.' in split_part(contact_email, '@', 2)) > 1));

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
  (p.is_public_profile and p.show_network) as show_network,
  case when p.is_public_profile then p.professional_role end as professional_role,
  case when p.is_public_profile then p.founder_status end as founder_status,
  case when p.is_public_profile then p.contact_email end as contact_email,
  case when p.is_public_profile then p.primary_contact_method else 'none' end as primary_contact_method
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

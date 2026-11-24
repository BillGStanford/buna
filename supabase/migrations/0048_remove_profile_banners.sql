-- regression-test: supabase/tests/remove_profile_banners.sql
-- Remove profile banner images; avatars remain the sole profile image.
drop policy if exists profile_banners_insert on storage.objects;
drop policy if exists profile_banners_update on storage.objects;
drop policy if exists profile_banners_delete on storage.objects;
delete from storage.objects where bucket_id = 'profile-banners';
delete from storage.buckets where id = 'profile-banners';
alter table public.profiles drop constraint if exists profiles_banner_url_chk;
alter table public.profiles drop column if exists banner_url;

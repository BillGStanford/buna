-- Buna 0006 — storage buckets and policies.
--   avatars          public  — path: {user_id}/{file}
--   startup-media    public  — path: {startup_id}/{file}
--   verification-docs private — path: {startup_id}/{file}

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp']),
  ('startup-media', 'startup-media', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('verification-docs', 'verification-docs', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Parses the first path segment as a startup id; returns null instead of erroring on junk.
create function public.storage_startup_id(p_name text) returns uuid
language plpgsql immutable set search_path = '' as $$
declare v text := (storage.foldername(p_name))[1];
begin
  if v ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return v::uuid;
  end if;
  return null;
end $$;

create policy avatars_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text and public.is_active_user());
create policy avatars_update on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_delete on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy startup_media_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'startup-media' and public.is_active_user()
              and public.can_edit_startup(public.storage_startup_id(name)));
create policy startup_media_update on storage.objects for update to authenticated
  using (bucket_id = 'startup-media' and public.can_edit_startup(public.storage_startup_id(name)));
create policy startup_media_delete on storage.objects for delete to authenticated
  using (bucket_id = 'startup-media' and public.can_edit_startup(public.storage_startup_id(name)));

create policy verification_docs_select on storage.objects for select to authenticated
  using (bucket_id = 'verification-docs' and (
    public.is_staff()
    or public.is_startup_member(public.storage_startup_id(name), array['owner', 'admin']::public.member_role[])));
create policy verification_docs_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'verification-docs' and public.is_active_user()
              and public.is_startup_member(public.storage_startup_id(name), array['owner', 'admin']::public.member_role[]));

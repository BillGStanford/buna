-- Staff need a narrowly scoped path to review pending profiles.
create policy cofounder_profiles_staff_read on public.cofounder_profiles
for select to authenticated using (public.is_staff());
create policy cofounder_profiles_staff_update on public.cofounder_profiles
for update to authenticated using (public.is_staff()) with check (public.is_staff());

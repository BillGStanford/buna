-- 0037: staff review metadata for operating metrics and funding rounds.
alter table public.startup_metrics add column reviewed_by uuid references public.profiles(id) on delete set null;
alter table public.startup_metrics add column reviewed_at timestamptz;
alter table public.startup_metrics add column review_note text check (review_note is null or char_length(review_note)<=1000);
alter table public.startup_funding_rounds add column reviewed_by uuid references public.profiles(id) on delete set null;
alter table public.startup_funding_rounds add column reviewed_at timestamptz;
alter table public.startup_funding_rounds add column review_note text check (review_note is null or char_length(review_note)<=1000);
create policy startup_metrics_staff_all on public.startup_metrics for all to authenticated
 using (public.is_staff()) with check (public.is_staff());
create policy startup_funding_rounds_staff_all on public.startup_funding_rounds for all to authenticated
 using (public.is_staff()) with check (public.is_staff());

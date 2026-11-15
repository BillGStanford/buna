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

create trigger company_data_sources_updated_at before update on public.company_data_sources
 for each row execute function public.set_updated_at();

-- Once review metadata exists on all record types, prevent founders from forging
-- reviewer identity, timestamps, or staff rationale through direct table updates.
create or replace function public.guard_company_intelligence_provenance()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if not public.is_staff() then
   new.source_status := 'founder_reported';
   new.reviewed_by := null;
   new.reviewed_at := null;
   new.review_note := null;
 end if;
 return new;
end $$;

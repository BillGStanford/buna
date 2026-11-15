-- 0034: founders can submit evidence, but cannot self-assign verification.
create or replace function public.guard_company_intelligence_provenance()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if not public.is_staff() then
   new.source_status := 'founder_reported';
   if tg_table_name = 'startup_data_claims' then
     new.reviewed_by := null;
     new.reviewed_at := null;
   end if;
 end if;
 return new;
end $$;
create trigger startup_metrics_provenance_guard before insert or update on public.startup_metrics
 for each row execute function public.guard_company_intelligence_provenance();
create trigger startup_funding_provenance_guard before insert or update on public.startup_funding_rounds
 for each row execute function public.guard_company_intelligence_provenance();
create trigger startup_claims_provenance_guard before insert or update on public.startup_data_claims
 for each row execute function public.guard_company_intelligence_provenance();

create policy founder_history_approved_investor_read on public.founder_company_history for select to authenticated
 using (visibility = 'investors' and exists (
   select 1 from public.investor_memberships im
   where im.user_id=auth.uid() and im.status='active'
 ));

create policy startup_claims_staff_all on public.startup_data_claims for all to authenticated
 using (public.is_staff()) with check (public.is_staff());
create policy startup_claim_evidence_staff_read on public.startup_claim_evidence for select to authenticated
 using (public.is_staff());

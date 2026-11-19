-- Buna 0039 — prevent launch makers and startup teammates from voting on their own launches.
-- The helper is SECURITY DEFINER so the RLS policy can inspect every membership,
-- including private team memberships that the voter cannot otherwise enumerate.

create or replace function public.can_vote_for_launch(p_launch_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.launches l
     where l.id = p_launch_id
       and l.submitted_by is distinct from auth.uid()
       and not exists (
         select 1
           from public.startup_members sm
          where sm.startup_id = l.startup_id
            and sm.user_id = auth.uid()
       )
  )
$$;

revoke all on function public.can_vote_for_launch(uuid) from public, anon;
grant execute on function public.can_vote_for_launch(uuid) to authenticated;

drop policy votes_insert on public.launch_votes;
create policy votes_insert on public.launch_votes
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.is_active_user()
    and public.has_verified_email()
    and public.can_vote_for_launch(launch_id)
    and exists (
      select 1
        from public.launches l
       where l.id = launch_id
         and l.status = 'published'
         and l.competition_ends_at > now()
    )
  );

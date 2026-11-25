-- 0052: Published launch discussions remain open after the voting competition closes.
-- Voting is time-bounded; product discussion is part of the permanent launch archive.
drop policy comments_insert on public.comments;
create policy comments_insert on public.comments for insert to authenticated
  with check (
    author_id = auth.uid()
    and public.is_active_user()
    and public.has_verified_email()
    and exists (
      select 1
      from public.launches l
      where l.id = launch_id
        and l.status = 'published'
    )
  );

-- Authenticated onboarding preview: expose the invited startup ID only to a signed-in,
-- active user who possesses the one-time invitation token. The public invite preview
-- in 0010 remains unchanged and continues to omit IDs.
create function public.get_invitation_onboarding_preview(p_token_hash text)
returns table (
  startup_id uuid,
  startup_name text,
  status public.invitation_status,
  expired boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not public.is_active_user() then
    raise exception 'account_suspended' using errcode = '42501';
  end if;

  return query
    select s.id, s.name, i.status, (i.expires_at < now())
    from public.team_invitations i
    join public.startups s on s.id = i.startup_id
    where i.token_hash = p_token_hash;
end;
$$;

revoke all on function public.get_invitation_onboarding_preview(text) from public, anon;
grant execute on function public.get_invitation_onboarding_preview(text) to authenticated;

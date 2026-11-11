-- Guard co-founder review decisions and connection state transitions.
create or replace function public.guard_cofounder_profile_review()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null and auth.uid()=new.user_id and not public.is_staff() then
      new.approval_status := 'pending';
    end if;
    return new;
  end if;
  if auth.uid() is not null and auth.uid()=old.user_id and not public.is_staff() then
    new.approval_status := old.approval_status;
  end if;
  return new;
end;
$$;
drop trigger if exists cofounder_profile_review_guard on public.cofounder_profiles;
create trigger cofounder_profile_review_guard before insert or update on public.cofounder_profiles
for each row execute function public.guard_cofounder_profile_review();

create or replace function public.guard_cofounder_connection_transition()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  if old.status <> 'pending' then
    raise exception 'connection_already_resolved' using errcode='55000';
  end if;
  if auth.uid()=old.recipient_id then
    if new.status not in ('accepted','declined') then
      raise exception 'invalid_recipient_transition' using errcode='42501';
    end if;
  elsif auth.uid()=old.sender_id then
    if new.status <> 'withdrawn' then
      raise exception 'invalid_sender_transition' using errcode='42501';
    end if;
  else
    raise exception 'not_connection_party' using errcode='42501';
  end if;
  if new.sender_id<>old.sender_id or new.recipient_id<>old.recipient_id then
    raise exception 'connection_parties_immutable' using errcode='42501';
  end if;
  return new;
end;
$$;
drop trigger if exists cofounder_connection_transition_guard on public.cofounder_connections;
create trigger cofounder_connection_transition_guard before update on public.cofounder_connections
for each row execute function public.guard_cofounder_connection_transition();

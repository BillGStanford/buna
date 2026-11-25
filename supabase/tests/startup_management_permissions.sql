-- Regression coverage for startup management column-level grants.
begin;

do $$
begin
  if not has_column_privilege('authenticated', 'public.startups', 'hiring_status', 'UPDATE') then
    raise exception 'authenticated is missing UPDATE privilege on startups.hiring_status';
  end if;
  if not has_column_privilege('authenticated', 'public.startups', 'is_product_live', 'UPDATE') then
    raise exception 'authenticated is missing UPDATE privilege on startups.is_product_live';
  end if;
  if not has_column_privilege('authenticated', 'public.startups', 'last_public_update_at', 'UPDATE') then
    raise exception 'authenticated is missing UPDATE privilege on startups.last_public_update_at';
  end if;
end $$;

rollback;

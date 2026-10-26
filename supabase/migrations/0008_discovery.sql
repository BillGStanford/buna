-- Buna 0008 — discovery support: category counts and hard limits on startup child records.

-- Published-startup counts per sector (public; exposes only counts of already-public rows).
create function public.published_category_counts()
returns table (slug citext, name text, startup_count bigint)
language sql stable security definer set search_path = '' as $$
  select c.slug, c.name, count(s.id) as startup_count
    from public.categories c
    left join public.startups s on s.category_id = c.id and s.status = 'published'
   where c.is_active
   group by c.id, c.slug, c.name, c.sort_order
   order by c.sort_order, c.name
$$;
revoke all on function public.published_category_counts() from public;
grant execute on function public.published_category_counts() to anon, authenticated, service_role;

-- Limits live in the database so they cannot be bypassed by calling the API directly.
create function public.enforce_startup_child_limits() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_count int;
  v_limit int;
begin
  -- Callers who may not edit this startup get the plain RLS rejection, not a limit message
  -- (BEFORE triggers run ahead of RLS checks, and counts of someone else's rows must not leak).
  if auth.uid() is not null and not public.can_edit_startup(new.startup_id) then
    return new;
  end if;
  if tg_table_name = 'startup_products' then
    v_limit := 12;
    select count(*) into v_count from public.startup_products where startup_id = new.startup_id;
  elsif tg_table_name = 'startup_links' then
    v_limit := 10;
    select count(*) into v_count from public.startup_links where startup_id = new.startup_id;
  elsif tg_table_name = 'startup_media' then
    v_limit := 6;
    select count(*) into v_count from public.startup_media where startup_id = new.startup_id and kind = 'gallery';
    if new.kind <> 'gallery' then return new; end if;
  else
    return new;
  end if;
  if v_count >= v_limit then
    raise exception 'limit_reached' using errcode = '54000', detail = format('%s allows at most %s rows per startup', tg_table_name, v_limit);
  end if;
  return new;
end $$;

create trigger startup_products_limit before insert on public.startup_products
  for each row execute function public.enforce_startup_child_limits();
create trigger startup_links_limit before insert on public.startup_links
  for each row execute function public.enforce_startup_child_limits();
create trigger startup_media_limit before insert on public.startup_media
  for each row execute function public.enforce_startup_child_limits();

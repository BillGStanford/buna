-- regression-test: supabase/tests/startup_publication_logo.sql
-- 0056: require a company logo before a startup can be published.
-- Gallery/product images remain optional and can be added after the profile is complete.

create or replace function public.set_startup_publication(p_startup_id uuid, p_publish boolean)
returns public.startup_status
language plpgsql security definer set search_path = '' as $$
declare
  v_startup public.startups%rowtype;
  v_review boolean;
  v_new public.startup_status;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not public.is_active_user() then
    raise exception 'account_suspended' using errcode = '42501';
  end if;
  if not public.is_startup_member(p_startup_id, array['owner', 'admin']::public.member_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into v_startup from public.startups where id = p_startup_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_startup.status in ('removed', 'rejected') then
    raise exception 'blocked_by_moderation' using errcode = '42501';
  end if;

  if p_publish then
    if not public.has_verified_email() then
      raise exception 'email_not_verified' using errcode = '42501';
    end if;
    if coalesce(btrim(v_startup.tagline), '') = '' or coalesce(btrim(v_startup.description), '') = ''
       or v_startup.category_id is null or v_startup.country is null
       or coalesce(btrim(v_startup.logo_url), '') = '' then
      raise exception 'profile_incomplete' using errcode = '23514';
    end if;
    select coalesce((s.value #>> '{}')::boolean, false) into v_review
      from public.platform_settings s where s.key = 'startups_require_review';
    v_new := case when coalesce(v_review, false) then 'pending_review' else 'published' end;
  else
    v_new := 'unpublished';
  end if;

  update public.startups
     set status = v_new,
         published_at = case when v_new = 'published' then coalesce(published_at, now()) else published_at end
   where id = p_startup_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), case when p_publish then 'startup.publish' else 'startup.unpublish' end,
          'startup', p_startup_id::text, jsonb_build_object('resulting_status', v_new));
  return v_new;
end $$;

revoke all on function public.set_startup_publication(uuid, boolean) from public, anon;
grant execute on function public.set_startup_publication(uuid, boolean) to authenticated;

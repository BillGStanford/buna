-- Buna 0028: close final integration gaps in Work visibility and comment notifications.

-- RLS policies must not query profiles directly as anon/authenticated: the profiles
-- table intentionally does not grant broad SELECT. Keep the visibility decision inside
-- a narrow SECURITY DEFINER predicate that returns only a boolean.
create or replace function public.is_public_member_profile(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = p_user
      and p.is_public_profile
      and not p.is_suspended
  );
$$;
revoke all on function public.is_public_member_profile(uuid) from public, anon, authenticated;
grant execute on function public.is_public_member_profile(uuid) to anon, authenticated, service_role;

create or replace function public.is_active_member_profile(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $
  select exists (
    select 1 from public.profiles p
    where p.id = p_user and not p.is_suspended
  );
$;
revoke all on function public.is_active_member_profile(uuid) from public, anon, authenticated;
grant execute on function public.is_active_member_profile(uuid) to anon, authenticated, service_role;

drop policy if exists work_profiles_public_read on public.work_profiles;
create policy work_profiles_public_read on public.work_profiles for select to anon, authenticated
using ((is_public and public.is_public_member_profile(user_id)) or user_id = auth.uid());

drop policy if exists work_portfolio_public_read on public.work_portfolio_items;
create policy work_portfolio_public_read on public.work_portfolio_items for select to anon, authenticated
using (
  (exists (
    select 1 from public.work_profiles wp
    where wp.user_id = work_portfolio_items.user_id
      and wp.is_public
      and public.is_public_member_profile(wp.user_id)
  ))
  or user_id = auth.uid()
);

drop policy if exists work_projects_public_read on public.work_projects;
create policy work_projects_public_read on public.work_projects for select to anon, authenticated
using (
  (status = 'published' and public.is_active_member_profile(employer_id))
  or employer_id = auth.uid()
  or public.is_staff()
  or public.is_work_project_applicant(id)
  or public.is_work_project_manager(id)
);

-- Reinstall the comment trigger explicitly and insert both recipient notifications
-- in one place. This preserves email preference handling and makes reply delivery
-- independent of unrelated overloads/default arguments on create_notification().
create or replace function public.comments_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_launch record;
  v_parent_author uuid;
  v_who text;
  v_email boolean := false;
begin
  select l.slug, l.name, l.submitted_by
    into v_launch
    from public.launches l
   where l.id = new.launch_id;

  if not found then
    return new;
  end if;

  select coalesce(nullif(p.display_name, ''), '@' || p.username)
    into v_who
    from public.profiles p
   where p.id = new.author_id;

  if new.parent_id is not null then
    select c.author_id
      into v_parent_author
      from public.comments c
     where c.id = new.parent_id
       and c.launch_id = new.launch_id
       and c.parent_id is null
       and c.status = 'visible';

    if v_parent_author is not null and v_parent_author is distinct from new.author_id then
      v_email := false;
      select coalesce(np.email_replies, false)
        into v_email
        from public.notification_preferences np
       where np.user_id = v_parent_author;

      insert into public.notifications
        (user_id, type, title, body, url, dedupe_key, email_status)
      values
        (v_parent_author, 'reply',
         coalesce(v_who, 'Someone') || ' replied to your comment on ' || v_launch.name,
         left(new.body, 140),
         '/launches/' || v_launch.slug || '#comment-' || new.id,
         'comment:' || new.id,
         case when coalesce(v_email, false) then 'pending'::public.email_delivery_status end)
      on conflict (user_id, dedupe_key) do nothing;
    end if;
  end if;

  if v_launch.submitted_by is not null
     and v_launch.submitted_by is distinct from new.author_id
     and v_launch.submitted_by is distinct from v_parent_author then
    v_email := false;
    select coalesce(np.email_comments, false)
      into v_email
      from public.notification_preferences np
     where np.user_id = v_launch.submitted_by;

    insert into public.notifications
      (user_id, type, title, body, url, dedupe_key, email_status)
    values
      (v_launch.submitted_by, 'comment',
       coalesce(v_who, 'Someone') || ' commented on ' || v_launch.name,
       left(new.body, 140),
       '/launches/' || v_launch.slug || '#comment-' || new.id,
       'comment:' || new.id,
       case when coalesce(v_email, false) then 'pending'::public.email_delivery_status end)
    on conflict (user_id, dedupe_key) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists comments_notify_trg on public.comments;
create trigger comments_notify_trg
after insert on public.comments
for each row execute function public.comments_notify();

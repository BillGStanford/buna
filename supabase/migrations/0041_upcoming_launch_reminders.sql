-- 0041: member reminders for scheduled launch dates.
alter table public.notification_preferences
  add column if not exists email_launch_reminders boolean not null default true;

create table public.launch_reminders (
  launch_id uuid not null references public.launches(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  reminder_sent_at timestamptz,
  primary key (launch_id, user_id)
);
create index launch_reminders_user_idx on public.launch_reminders(user_id, created_at desc);
create index launch_reminders_pending_idx on public.launch_reminders(launch_id) where reminder_sent_at is null;

alter table public.launch_reminders enable row level security;
revoke all on public.launch_reminders from anon, authenticated;
grant select, insert, delete on public.launch_reminders to authenticated;
create policy launch_reminders_select_own on public.launch_reminders for select to authenticated using (user_id = (select auth.uid()));
create policy launch_reminders_insert_own on public.launch_reminders for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists (select 1 from public.launches l where l.id = launch_id and l.status = 'scheduled' and l.is_demo = false)
);
create policy launch_reminders_delete_own on public.launch_reminders for delete to authenticated using (user_id = (select auth.uid()));

create or replace function public.queue_launch_reminders()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare queued bigint := 0;
begin
  with due as (
    select lr.launch_id, lr.user_id, l.slug, l.name, l.launch_date,
           coalesce(np.email_launch_reminders, true) as email_enabled
      from public.launch_reminders lr
      join public.launches l on l.id = lr.launch_id
      left join public.notification_preferences np on np.user_id = lr.user_id
     where lr.reminder_sent_at is null
       and l.status = 'scheduled'
       and l.is_demo = false
       and l.launch_date = current_date + 1
     for update of lr skip locked
  ), inserted as (
    insert into public.notifications
      (user_id, type, title, body, url, dedupe_key, email_status)
    select d.user_id, 'launch_reminder',
           'A launch you’re following is coming tomorrow',
           d.name || ' is scheduled to launch tomorrow.',
           '/launches/' || d.slug,
           'launch-reminder:' || d.launch_id::text || ':' || d.user_id::text,
           case when d.email_enabled then 'pending'::public.email_delivery_status else null end
      from due d
    on conflict (user_id, dedupe_key) do nothing
    returning user_id, dedupe_key
  )
  update public.launch_reminders lr
     set reminder_sent_at = now()
    from due d
   where lr.launch_id = d.launch_id and lr.user_id = d.user_id
     and lr.reminder_sent_at is null;
  get diagnostics queued = row_count;
  return queued;
end;
$$;
revoke all on function public.queue_launch_reminders() from public, anon, authenticated;
grant execute on function public.queue_launch_reminders() to service_role;

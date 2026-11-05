-- Buna 0016 — investor contact routes and structured community discussions.

alter table public.investor_applications
  add column if not exists contact_phone text,
  add column if not exists contact_whatsapp text,
  add column if not exists contact_telegram text,
  add column if not exists contact_facebook text,
  add column if not exists contact_other_url text;

do $migration$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.investor_applications'::regclass and conname = 'investor_app_phone_len') then
    alter table public.investor_applications add constraint investor_app_phone_len check (contact_phone is null or char_length(contact_phone) <= 40);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.investor_applications'::regclass and conname = 'investor_app_whatsapp_len') then
    alter table public.investor_applications add constraint investor_app_whatsapp_len check (contact_whatsapp is null or char_length(contact_whatsapp) <= 80);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.investor_applications'::regclass and conname = 'investor_app_telegram_len') then
    alter table public.investor_applications add constraint investor_app_telegram_len check (contact_telegram is null or char_length(contact_telegram) <= 80);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.investor_applications'::regclass and conname = 'investor_app_facebook_len') then
    alter table public.investor_applications add constraint investor_app_facebook_len check (contact_facebook is null or char_length(contact_facebook) <= 300);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.investor_applications'::regclass and conname = 'investor_app_other_contact_chk') then
    alter table public.investor_applications add constraint investor_app_other_contact_chk check (contact_other_url is null or contact_other_url ~* '^https?://');
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.investor_applications'::regclass and conname = 'investor_app_contact_required') then
    alter table public.investor_applications add constraint investor_app_contact_required check (
      nullif(btrim(contact_email::text), '') is not null or nullif(btrim(contact_phone), '') is not null
      or nullif(btrim(contact_whatsapp), '') is not null or nullif(btrim(contact_telegram), '') is not null
      or nullif(btrim(contact_facebook), '') is not null or nullif(btrim(contact_other_url), '') is not null
    ) not valid;
  end if;
end
$migration$;

alter table public.investor_accounts
  add column if not exists contact_phone text,
  add column if not exists contact_whatsapp text,
  add column if not exists contact_telegram text,
  add column if not exists contact_facebook text,
  add column if not exists contact_other_url text;

grant insert (contact_phone, contact_whatsapp, contact_telegram, contact_facebook, contact_other_url)
  on public.investor_applications to authenticated;
grant update (contact_phone, contact_whatsapp, contact_telegram, contact_facebook, contact_other_url)
  on public.investor_accounts to authenticated;

-- Discussion board: deliberately separate from the activity feed and launch comments.
create table public.community_threads (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  category text not null,
  title text not null,
  body text not null,
  status text not null default 'published',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint community_thread_category check (category in ('founder-networking','hiring-talent','investor-questions','legal-registration','feedback')),
  constraint community_thread_title_len check (char_length(btrim(title)) between 8 and 140),
  constraint community_thread_body_len check (char_length(btrim(body)) between 20 and 5000),
  constraint community_thread_status check (status in ('published','hidden','deleted'))
);
create index community_threads_listing_idx on public.community_threads(category, created_at desc) where status = 'published';
create index community_threads_author_idx on public.community_threads(author_id, created_at desc);

create table public.community_replies (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.community_threads(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  status text not null default 'published',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint community_reply_body_len check (char_length(btrim(body)) between 1 and 3000),
  constraint community_reply_status check (status in ('published','hidden','deleted'))
);
create index community_replies_thread_idx on public.community_replies(thread_id, created_at asc);

create table public.community_thread_subscriptions (
  thread_id uuid not null references public.community_threads(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (thread_id, user_id)
);
create index community_subscriptions_user_idx on public.community_thread_subscriptions(user_id, created_at desc);

alter table public.community_threads enable row level security;
alter table public.community_replies enable row level security;
alter table public.community_thread_subscriptions enable row level security;

grant select on public.community_threads to anon, authenticated;
grant insert on public.community_threads to authenticated;
grant select on public.community_replies to anon, authenticated;
grant insert on public.community_replies to authenticated;
grant select, insert, delete on public.community_thread_subscriptions to authenticated;
grant update (status) on public.community_threads to authenticated;

create policy community_threads_public_read on public.community_threads for select to anon, authenticated
  using (status = 'published' or (auth.uid() = author_id and status <> 'deleted') or public.is_staff());
create policy community_threads_member_insert on public.community_threads for insert to authenticated
  with check (author_id = auth.uid() and public.is_active_user() and public.has_verified_email() and status = 'published');
create policy community_threads_staff_update on public.community_threads for update to authenticated
  using (public.is_staff() and public.is_active_user())
  with check (public.is_staff() and public.is_active_user());

create policy community_replies_public_read on public.community_replies for select to anon, authenticated
  using (
    status = 'published'
    and exists (select 1 from public.community_threads t where t.id = thread_id and t.status = 'published')
    or (auth.uid() = author_id and status <> 'deleted')
    or public.is_staff()
  );
create policy community_replies_member_insert on public.community_replies for insert to authenticated
  with check (
    author_id = auth.uid() and public.is_active_user() and public.has_verified_email()
    and status = 'published'
    and exists (select 1 from public.community_threads t where t.id = thread_id and t.status = 'published')
  );
create policy community_replies_staff_update on public.community_replies for update to authenticated
  using (public.is_staff() and public.is_active_user())
  with check (public.is_staff() and public.is_active_user());

create policy community_subscriptions_read_own on public.community_thread_subscriptions for select to authenticated
  using (user_id = auth.uid());
create policy community_subscriptions_insert_own on public.community_thread_subscriptions for insert to authenticated
  with check (user_id = auth.uid() and public.is_active_user() and exists (
    select 1 from public.community_threads t where t.id = thread_id and t.status = 'published'
  ));
create policy community_subscriptions_delete_own on public.community_thread_subscriptions for delete to authenticated
  using (user_id = auth.uid());

create or replace function public.community_normalize_insert_timestamps() returns trigger
language plpgsql set search_path = '' as $community$
begin
  new.created_at := now();
  new.updated_at := now();
  return new;
end $community$;
create trigger community_threads_normalize_timestamps before insert on public.community_threads
  for each row execute function public.community_normalize_insert_timestamps();
create trigger community_replies_normalize_timestamps before insert on public.community_replies
  for each row execute function public.community_normalize_insert_timestamps();

create trigger community_threads_updated_at before update on public.community_threads
  for each row execute function public.set_updated_at();
create trigger community_replies_updated_at before update on public.community_replies
  for each row execute function public.set_updated_at();

create or replace function public.community_reply_notifications() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_thread public.community_threads%rowtype;
  v_actor text;
  v_recipient uuid;
begin
  select * into v_thread from public.community_threads where id = new.thread_id;
  select coalesce(nullif(display_name, ''), '@' || username) into v_actor
    from public.profiles where id = new.author_id;

  if v_thread.author_id is distinct from new.author_id then
    perform public.create_notification(
      v_thread.author_id, 'reply', coalesce(v_actor, 'A member') || ' replied to your discussion',
      left(new.body, 140), '/community/' || v_thread.id::text,
      'community-reply:' || new.id::text || ':' || v_thread.author_id::text, 'replies'
    );
  end if;

  for v_recipient in
    select s.user_id from public.community_thread_subscriptions s
     where s.thread_id = new.thread_id and s.user_id <> new.author_id
       and s.user_id <> v_thread.author_id
  loop
    perform public.create_notification(
      v_recipient, 'reply', coalesce(v_actor, 'A member') || ' replied in a discussion you follow',
      left(new.body, 140), '/community/' || v_thread.id::text,
      'community-reply:' || new.id::text || ':' || v_recipient::text, 'replies'
    );
  end loop;
  return new;
end $$;
create trigger community_reply_notify after insert on public.community_replies
  for each row execute function public.community_reply_notifications();

revoke all on function public.community_reply_notifications() from public, anon, authenticated;

-- Copy private contact routes into the owned investor account only after staff approves the application.
create or replace function public.sync_approved_investor_contacts() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'approved' and old.status is distinct from new.status then
    update public.investor_accounts
       set contact_email = new.contact_email,
           contact_phone = new.contact_phone,
           contact_whatsapp = new.contact_whatsapp,
           contact_telegram = new.contact_telegram,
           contact_facebook = new.contact_facebook,
           contact_other_url = new.contact_other_url
     where user_id = new.user_id;
  end if;
  return new;
end $$;
create trigger investor_application_contacts_approved
  after update of status on public.investor_applications
  for each row execute function public.sync_approved_investor_contacts();
revoke all on function public.sync_approved_investor_contacts() from public, anon, authenticated;

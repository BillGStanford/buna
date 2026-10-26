-- Buna 0003 — launches, votes (locked once cast), comments, follows.
-- Tables and invariants are created now so later phases only add behaviour.

create table public.launches (
  id uuid primary key default gen_random_uuid(),
  slug citext not null unique,
  startup_id uuid references public.startups (id) on delete set null,
  submitted_by uuid references public.profiles (id) on delete set null,
  name text not null,
  tagline text not null,
  description text,
  logo_url text,
  product_url text not null,
  demo_video_url text,
  category_id uuid references public.categories (id) on delete set null,
  tags text[] not null default '{}',
  status public.launch_status not null default 'draft',
  launch_date date,
  published_at timestamptz,
  is_featured boolean not null default false,
  moderation_note text,
  vote_count int not null default 0,
  comment_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search tsvector generated always as (
    setweight(to_tsvector('english'::regconfig, coalesce(name, '')), 'A') ||
    setweight(to_tsvector('english'::regconfig, coalesce(tagline, '')), 'B') ||
    setweight(to_tsvector('english'::regconfig, coalesce(description, '')), 'C')
  ) stored,
  constraint launches_slug_fmt check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 80),
  constraint launches_name_len check (char_length(name) between 2 and 80),
  constraint launches_tagline_len check (char_length(tagline) between 5 and 160),
  constraint launches_description_len check (description is null or char_length(description) <= 5000),
  constraint launches_product_url_chk check (product_url ~* '^https?://'),
  constraint launches_video_chk check (demo_video_url is null or demo_video_url ~* '^https?://'),
  constraint launches_counts_chk check (vote_count >= 0 and comment_count >= 0)
);
create trigger launches_updated_at before update on public.launches
  for each row execute function public.set_updated_at();
create index launches_search_idx on public.launches using gin (search);
create index launches_feed_idx on public.launches (status, published_at desc);
create index launches_votes_idx on public.launches (status, vote_count desc);
create index launches_startup_idx on public.launches (startup_id);
create index launches_category_idx on public.launches (category_id) where status = 'published';
create index launches_submitter_idx on public.launches (submitted_by);

-- One vote per user per launch, enforced by the primary key. There is deliberately no
-- UPDATE or DELETE grant for clients: votes are locked once cast (product decision).
create table public.launch_votes (
  launch_id uuid not null references public.launches (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (launch_id, user_id)
);
create index launch_votes_user_idx on public.launch_votes (user_id);
-- supports trending (votes within a recent window)
create index launch_votes_recent_idx on public.launch_votes (launch_id, created_at desc);

-- Denormalised counter maintained inside the same transaction as the vote insert.
-- `update ... set n = n + 1` takes a row lock, so concurrent votes cannot lose updates.
create function public.launch_votes_count() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    update public.launches set vote_count = vote_count + 1 where id = new.launch_id;
    return new;
  else
    update public.launches set vote_count = greatest(vote_count - 1, 0) where id = old.launch_id;
    return old;
  end if;
end $$;
create trigger launch_votes_count_ins after insert on public.launch_votes
  for each row execute function public.launch_votes_count();
create trigger launch_votes_count_del after delete on public.launch_votes
  for each row execute function public.launch_votes_count();

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  launch_id uuid not null references public.launches (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  parent_id uuid references public.comments (id) on delete cascade,
  body text not null,
  status public.comment_status not null default 'visible',
  edited_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint comments_body_len check (char_length(btrim(body)) between 1 and 2000)
);
create trigger comments_updated_at before update on public.comments
  for each row execute function public.set_updated_at();
create index comments_launch_idx on public.comments (launch_id, created_at);
create index comments_parent_idx on public.comments (parent_id);
create index comments_author_idx on public.comments (author_id);

create function public.comments_count() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'visible' then
      update public.launches set comment_count = comment_count + 1 where id = new.launch_id;
    end if;
  elsif tg_op = 'UPDATE' then
    if old.status = 'visible' and new.status <> 'visible' then
      update public.launches set comment_count = greatest(comment_count - 1, 0) where id = new.launch_id;
    elsif old.status <> 'visible' and new.status = 'visible' then
      update public.launches set comment_count = comment_count + 1 where id = new.launch_id;
    end if;
  elsif tg_op = 'DELETE' then
    if old.status = 'visible' then
      update public.launches set comment_count = greatest(comment_count - 1, 0) where id = old.launch_id;
    end if;
  end if;
  return coalesce(new, old);
end $$;
create trigger comments_count_trg after insert or update of status or delete on public.comments
  for each row execute function public.comments_count();

create table public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  target_type text not null,
  target_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (follower_id, target_type, target_id),
  constraint follows_type_chk check (target_type in ('startup', 'user')),
  constraint follows_no_self check (not (target_type = 'user' and follower_id = target_id))
);
create index follows_target_idx on public.follows (target_type, target_id);

-- Replies must stay inside the same launch thread.
create function public.comments_parent_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.parent_id is not null and not exists (
    select 1 from public.comments c where c.id = new.parent_id and c.launch_id = new.launch_id
  ) then
    raise exception 'invalid_parent_comment' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger comments_parent_guard_trg before insert on public.comments
  for each row execute function public.comments_parent_guard();

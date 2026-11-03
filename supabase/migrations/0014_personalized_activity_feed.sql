-- Buna 0014 — personalized activity feed for followed founders and startups.
-- The feed is a read-only projection over existing public activity; no client-written event log.

create or replace function public.get_following_activity(p_limit int default 40)
returns table (
  activity_id text,
  activity_type text,
  actor_id uuid,
  actor_username text,
  actor_display_name text,
  actor_avatar_url text,
  subject text,
  description text,
  href text,
  happened_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with followed_users as (
    select f.target_id
      from public.follows f
     where f.follower_id = auth.uid() and f.target_type = 'user'
  ),
  followed_startups as (
    select f.target_id
      from public.follows f
     where f.follower_id = auth.uid() and f.target_type = 'startup'
  ),
  activity as (
    -- New public launches from followed founders, followed startups, or their public team members.
    select
      'launch:' || l.id::text as activity_id,
      'launch'::text as activity_type,
      l.submitted_by as actor_id,
      l.name as subject,
      coalesce(nullif(l.tagline, ''), 'Published a new launch') as description,
      '/launches/' || l.slug as href,
      coalesce(l.published_at, l.created_at) as happened_at
    from public.launches l
    where l.status = 'published'
      and (
        l.submitted_by in (select fu.target_id from followed_users fu)
        or l.startup_id in (select fs.target_id from followed_startups fs)
        or exists (
          select 1 from public.startup_members sm
           where sm.startup_id = l.startup_id and sm.user_id in (select fu.target_id from followed_users fu)
             and sm.is_public
        )
      )

    union all

    -- Published startup profile creation/updates from followed startups or followed founders' public teams.
    select
      'startup:' || s.id::text || ':' || s.updated_at::text as activity_id,
      'startup_update'::text as activity_type,
      s.created_by as actor_id,
      s.name as subject,
      coalesce(nullif(s.tagline, ''), 'Updated a startup profile') as description,
      '/startups/' || s.slug as href,
      s.updated_at as happened_at
    from public.startups s
    where s.status = 'published'
      and (
        s.id in (select fs.target_id from followed_startups fs)
        or exists (
          select 1 from public.startup_members sm
           where sm.startup_id = s.id and sm.user_id in (select fu.target_id from followed_users fu)
             and sm.is_public
        )
      )

    union all

    -- A followed founder follows another public founder or published startup.
    select
      'follow:' || f.follower_id::text || ':' || f.target_type || ':' || f.target_id::text as activity_id,
      'founder_follow'::text as activity_type,
      f.follower_id as actor_id,
      case when f.target_type = 'startup' then st.name else coalesce(nullif(tp.display_name, ''), '@' || tp.username) end as subject,
      case when f.target_type = 'startup' then 'Started following a startup' else 'Started following a founder' end as description,
      case when f.target_type = 'startup' then '/startups/' || st.slug else '/users/' || tp.username end as href,
      f.created_at as happened_at
    from public.follows f
    left join public.startups st on f.target_type = 'startup' and st.id = f.target_id and st.status = 'published'
    left join public.public_profiles tp on f.target_type = 'user' and tp.id = f.target_id
    where f.follower_id in (select fu.target_id from followed_users fu)
      and (
        (f.target_type = 'startup' and st.id is not null)
        or (f.target_type = 'user' and tp.id is not null)
      )

    union all

    -- A followed founder saves a publicly available opportunity.
    select
      'save:' || so.user_id::text || ':' || so.opportunity_id::text as activity_id,
      'opportunity_save'::text as activity_type,
      so.user_id as actor_id,
      o.title as subject,
      'Saved an opportunity from ' || o.organization as description,
      '/opportunities/' || o.slug as href,
      so.created_at as happened_at
    from public.saved_opportunities so
    join public.opportunities o on o.id = so.opportunity_id and o.status = 'published'
    where so.user_id in (select fu.target_id from followed_users fu)
  )
  select
    a.activity_id, a.activity_type, a.actor_id,
    pp.username::text, pp.display_name, pp.avatar_url,
    a.subject, a.description, a.href, a.happened_at
  from activity a
  left join public.public_profiles pp on pp.id = a.actor_id
  where auth.uid() is not null
  order by a.happened_at desc, a.activity_id desc
  limit least(greatest(coalesce(p_limit, 40), 1), 100);
$$;

revoke all on function public.get_following_activity(int) from public, anon;
grant execute on function public.get_following_activity(int) to authenticated;

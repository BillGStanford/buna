-- Regression coverage for migration 0046.
\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
values
  ('00000000-0000-4000-8000-000000004601', 'profile-a@test.dev', now(), '{"display_name":"Profile A"}'),
  ('00000000-0000-4000-8000-000000004602', 'profile-b@test.dev', now(), '{"display_name":"Profile B"}'),
  ('00000000-0000-4000-8000-000000004603', 'profile-c@test.dev', now(), '{"display_name":"Profile C"}')
on conflict (id) do nothing;

update public.profiles
   set username = case id
     when '00000000-0000-4000-8000-000000004601' then 'profile-a'
     when '00000000-0000-4000-8000-000000004602' then 'profile-b'
     else 'profile-c' end,
       display_name = case id
     when '00000000-0000-4000-8000-000000004601' then 'Profile A'
     when '00000000-0000-4000-8000-000000004602' then 'Profile B'
     else 'Profile C' end,
       is_public_profile = true,
       show_network = true
 where id in (
  '00000000-0000-4000-8000-000000004601',
  '00000000-0000-4000-8000-000000004602',
  '00000000-0000-4000-8000-000000004603'
 );

insert into public.follows (follower_id, target_type, target_id)
values
  ('00000000-0000-4000-8000-000000004601', 'user', '00000000-0000-4000-8000-000000004602'),
  ('00000000-0000-4000-8000-000000004602', 'user', '00000000-0000-4000-8000-000000004601'),
  ('00000000-0000-4000-8000-000000004603', 'user', '00000000-0000-4000-8000-000000004601')
on conflict do nothing;

-- Public-safe banner and network settings are exposed; private profiles remain private.
update public.profiles
   set banner_url = 'https://example.test/profile-banner.webp'
 where id = '00000000-0000-4000-8000-000000004601';
do $$
begin
  assert (select banner_url = 'https://example.test/profile-banner.webp' and show_network
            from public.public_profiles where id = '00000000-0000-4000-8000-000000004601'),
    'public profile projection exposes the banner and opted-in network setting';
end
$$;

-- Blocking removes both follow edges and prevents the blocked member from reading the blocker's profile.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000004601', false);
select public.block_member('00000000-0000-4000-8000-000000004602');
do $$
begin
  assert not exists (
    select 1 from public.follows
     where target_type = 'user'
       and ((follower_id = '00000000-0000-4000-8000-000000004601' and target_id = '00000000-0000-4000-8000-000000004602')
         or (follower_id = '00000000-0000-4000-8000-000000004602' and target_id = '00000000-0000-4000-8000-000000004601'))
  ), 'blocking removes existing follows in both directions';
  assert exists (select 1 from public.user_blocks
                  where blocker_id = auth.uid() and blocked_id = '00000000-0000-4000-8000-000000004602'),
    'member can block another member';
end
$$;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000004602', false);
do $$
begin
  assert not exists (select 1 from public.public_profiles where id = '00000000-0000-4000-8000-000000004601'),
    'blocked member cannot read the blocker's public profile';
  assert (select count(*) = 0 from public.get_public_profile_network('00000000-0000-4000-8000-000000004601', 'followers')),
    'blocked member cannot inspect the blocker's network';
end
$$;
reset role;

-- A member can disable their network independently of the public profile.
update public.profiles set show_network = false
 where id = '00000000-0000-4000-8000-000000004603';
do $$
begin
  assert (select not show_network from public.public_profiles
           where id = '00000000-0000-4000-8000-000000004603'),
    'network visibility is an independent privacy control';
  assert (select count(*) = 0 from public.get_public_profile_network('00000000-0000-4000-8000-000000004603', 'following')),
    'network RPC returns no members when visibility is disabled';
end
$$;

rollback;

-- Regression coverage for migration 0047.
\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
values
  ('00000000-0000-4000-8000-000000004701', 'block-owner@test.dev', now(), '{"display_name":"Block Owner"}'),
  ('00000000-0000-4000-8000-000000004702', 'block-target@test.dev', now(), '{"display_name":"Block Target"}')
on conflict (id) do nothing;
update public.profiles set username = 'block-owner', is_public_profile = true
 where id = '00000000-0000-4000-8000-000000004701';
update public.profiles set username = 'block-target', is_public_profile = true
 where id = '00000000-0000-4000-8000-000000004702';

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000004701', false);
select public.block_member('00000000-0000-4000-8000-000000004702');
do $$
begin
  assert exists (select 1 from public.get_blocked_members()
                  where id = '00000000-0000-4000-8000-000000004702'),
    'members can retrieve their own private block list';
end
$$;
reset role;

-- A blocked user cannot bypass the block by inserting a follow directly.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000004702', false);
do $$
begin
  begin
    insert into public.follows (follower_id, target_type, target_id)
    values (auth.uid(), 'user', '00000000-0000-4000-8000-000000004701');
    raise exception 'blocked follow unexpectedly succeeded';
  exception when insufficient_privilege then
    null;
  end;
end
$$;
reset role;

rollback;

-- Regression: comments remain open on published launches after the competition ends.
do $$
declare
  policy_check text;
begin
  select with_check into policy_check
  from pg_policies
  where schemaname = 'public'
    and tablename = 'comments'
    and policyname = 'comments_insert';

  if policy_check is null then
    raise exception 'comments_insert policy is missing';
  end if;
  if position('published' in policy_check) = 0 then
    raise exception 'comments_insert must require a published launch';
  end if;
  if position('competition_ends_at' in policy_check) > 0 then
    raise exception 'comments_insert must not close discussion when competition ends';
  end if;
  if position('has_verified_email' in policy_check) = 0 then
    raise exception 'comments_insert must require verified email';
  end if;
  if position('is_active_user' in policy_check) = 0 then
    raise exception 'comments_insert must require active profile';
  end if;
end $$;

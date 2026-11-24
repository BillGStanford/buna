begin;

do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'contact_email') then
    raise exception 'profiles.contact_email is missing';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'primary_contact_method') then
    raise exception 'profiles.primary_contact_method is missing';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'public_profiles' and column_name = 'contact_email') then
    raise exception 'public_profiles.contact_email is missing';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'public_profiles' and column_name = 'primary_contact_method') then
    raise exception 'public_profiles.primary_contact_method is missing';
  end if;
end $$;

rollback;

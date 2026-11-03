-- Buna 0016 — investor applicant contact channels.
-- Kept separate from 0015 so developers who already applied 0015 can safely upgrade.

alter table public.investor_applications
  add column if not exists contact_phone text,
  add column if not exists whatsapp text,
  add column if not exists facebook text,
  add column if not exists telegram text;

alter table public.investor_accounts
  add column if not exists contact_phone text,
  add column if not exists whatsapp text,
  add column if not exists facebook text,
  add column if not exists telegram text;

grant update (contact_email, contact_phone, whatsapp, facebook, telegram, private_background)
  on public.investor_accounts to authenticated;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'investor_app_contact_required') then
    alter table public.investor_applications add constraint investor_app_contact_required
      check (
        nullif(trim(contact_email::text), '') is not null or
        nullif(trim(contact_phone), '') is not null or
        nullif(trim(whatsapp), '') is not null or
        nullif(trim(facebook), '') is not null or
        nullif(trim(telegram), '') is not null
      ) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'investor_app_contact_lengths') then
    alter table public.investor_applications add constraint investor_app_contact_lengths
      check (
        (contact_phone is null or char_length(contact_phone) <= 40) and
        (whatsapp is null or char_length(whatsapp) <= 120) and
        (facebook is null or char_length(facebook) <= 200) and
        (telegram is null or char_length(telegram) <= 120)
      ) not valid;
  end if;
end $$;

create or replace function public.review_investor_application(p_application uuid, p_decision text, p_note text default null)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_app public.investor_applications%rowtype;
  v_investor uuid;
  v_slug text;
begin
  perform public.assert_staff();
  if p_decision not in ('approve', 'reject') then raise exception 'invalid_decision' using errcode = '22023'; end if;
  select * into v_app from public.investor_applications where id = p_application for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if v_app.status <> 'pending' then raise exception 'invalid_state' using errcode = '22023'; end if;
  if exists (select 1 from public.investor_accounts ia where ia.user_id = v_app.user_id and ia.investor_id is distinct from v_app.existing_investor_id) then
    raise exception 'user_already_has_investor_account' using errcode = '23505';
  end if;
  if p_decision = 'approve' then
    if v_app.existing_investor_id is not null then
      select i.id into v_investor from public.investors i
       where i.id = v_app.existing_investor_id
         and not exists (select 1 from public.investor_accounts ia where ia.investor_id = i.id and ia.user_id <> v_app.user_id)
       for update;
      if v_investor is null then raise exception 'listing_already_claimed' using errcode = '23505'; end if;
      update public.investors set
        investor_type = v_app.investor_type,
        investment_min = coalesce(v_app.investment_min, investment_min),
        investment_max = coalesce(v_app.investment_max, investment_max),
        investment_currency = case when v_app.investment_min is not null or v_app.investment_max is not null then v_app.investment_currency else investment_currency end,
        portfolio = coalesce(v_app.portfolio, portfolio),
        website_url = coalesce(v_app.website_url, website_url),
        regions = case when cardinality(v_app.markets) > 0 then v_app.markets else regions end,
        stages = case when cardinality(v_app.stages) > 0 then v_app.stages else stages end,
        sectors = case when cardinality(v_app.sectors) > 0 then v_app.sectors else sectors end
      where id = v_investor;
      insert into public.investor_accounts(investor_id, user_id, contact_email, contact_phone, whatsapp, facebook, telegram, private_background)
        values (v_investor, v_app.user_id, v_app.contact_email, v_app.contact_phone, v_app.whatsapp, v_app.facebook, v_app.telegram, v_app.background)
        on conflict (investor_id) do update set contact_email = excluded.contact_email, contact_phone = excluded.contact_phone, whatsapp = excluded.whatsapp, facebook = excluded.facebook, telegram = excluded.telegram, private_background = excluded.private_background
        where public.investor_accounts.user_id = excluded.user_id;
    else
      v_slug := trim(both '-' from left(regexp_replace(lower(v_app.organization_name), '[^a-z0-9]+', '-', 'g'), 50));
      if v_slug = '' then v_slug := 'investor'; end if;
      if exists (select 1 from public.investors where slug = v_slug) then
        v_slug := left(v_slug, 40) || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
      end if;
      insert into public.investors (
        slug, name, description, website_url, contact_url, country, regions, stages, sectors, thesis,
        verification_status, is_published, created_by, investor_type, investment_min,
        investment_max, investment_currency, portfolio
      ) values (
        v_slug, v_app.organization_name, left(v_app.organization_name || ' is an ' || replace(v_app.investor_type, '_', ' ') || case when cardinality(v_app.markets) > 0 then ' investor active in ' || array_to_string(v_app.markets, ', ') else ' investor' end || '.', 3000), v_app.website_url, null, null,
        v_app.markets, v_app.stages, v_app.sectors, null,
        'pending', true, v_app.user_id, v_app.investor_type, v_app.investment_min,
        v_app.investment_max, v_app.investment_currency, v_app.portfolio
      ) returning id into v_investor;
      insert into public.investor_accounts(investor_id, user_id, contact_email, contact_phone, whatsapp, facebook, telegram, private_background)
        values (v_investor, v_app.user_id, v_app.contact_email, v_app.contact_phone, v_app.whatsapp, v_app.facebook, v_app.telegram, v_app.background)
        on conflict (investor_id) do update set contact_email = excluded.contact_email, contact_phone = excluded.contact_phone, whatsapp = excluded.whatsapp, facebook = excluded.facebook, telegram = excluded.telegram, private_background = excluded.private_background
        where public.investor_accounts.user_id = excluded.user_id;
    end if;
    update public.investor_applications set status = 'approved', review_note = nullif(left(coalesce(p_note, ''), 500), ''),
      reviewed_by = auth.uid(), reviewed_at = now() where id = p_application;
    insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
      values (auth.uid(), 'investor_application.approve', 'investor_application', p_application::text,
        jsonb_build_object('investor_id', v_investor, 'user_id', v_app.user_id));
    perform public.create_notification(v_app.user_id, 'investor', 'Investor Mode approved',
      'Your investor account has been approved. You can now manage your investor profile and review founder pitches.',
      '/dashboard/investor', 'investor-application:' || p_application::text, null);
  else
    update public.investor_applications set status = 'rejected', review_note = nullif(left(coalesce(p_note, ''), 500), ''),
      reviewed_by = auth.uid(), reviewed_at = now() where id = p_application;
    insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
      values (auth.uid(), 'investor_application.reject', 'investor_application', p_application::text,
        jsonb_build_object('user_id', v_app.user_id));
    perform public.create_notification(v_app.user_id, 'investor', 'Investor Mode application update',
      coalesce(nullif(left(coalesce(p_note, ''), 500), ''), 'Your application was not approved at this time. You can contact Buna if you believe this was a mistake.'),
      '/dashboard/investor', 'investor-application:' || p_application::text, null);
  end if;
  return v_investor;
end $$;
revoke all on function public.review_investor_application(uuid, text, text) from public, anon;
grant execute on function public.review_investor_application(uuid, text, text) to authenticated;

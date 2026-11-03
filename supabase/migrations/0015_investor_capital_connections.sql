-- Buna 0015 — investor accounts, founder pitches, introductions and deal pipeline.
-- Existing staff-curated investor listings remain compatible. Ownership is explicit and staff-controlled.

alter table public.investors
  add column investor_type text,
  add column investment_min numeric(14,2),
  add column investment_max numeric(14,2),
  add column investment_currency char(3) not null default 'USD',
  add column portfolio text,
  add constraint investors_type_len check (investor_type is null or char_length(investor_type) <= 60),
  add constraint investors_type_value_chk check (investor_type is null or investor_type in ('angel', 'venture_capital', 'accelerator', 'investment_fund', 'corporate', 'family_office', 'development_finance', 'other')),
  add constraint investors_range_check check (
    (investment_min is null or investment_min >= 0) and
    (investment_max is null or investment_max >= 0) and
    (investment_min is null or investment_max is null or investment_max >= investment_min)
  ),
  add constraint investors_currency_check check (investment_currency ~ '^[A-Z]{3}$'),
  add constraint investors_portfolio_len check (portfolio is null or char_length(portfolio) <= 3000),
  add constraint investors_array_sizes_check check (cardinality(regions) <= 8 and cardinality(stages) <= 6 and cardinality(sectors) <= 15);

-- An application is the only path to investor privileges. Approval and listing ownership are
-- performed together in a SECURITY DEFINER transaction, never by trusting client-supplied roles.
create table public.investor_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  existing_investor_id uuid references public.investors(id) on delete set null,
  organization_name text not null,
  investor_type text not null,
  website_url text,
  contact_email citext,
  background text not null,
  sectors text[] not null default '{}',
  stages public.startup_stage[] not null default '{}',
  markets text[] not null default '{}',
  investment_min numeric(14,2),
  investment_max numeric(14,2),
  investment_currency char(3) not null default 'USD',
  portfolio text,
  proof_url text,
  status text not null default 'pending',
  review_note text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint investor_app_org_len check (char_length(organization_name) between 2 and 120),
  constraint investor_app_type_len check (char_length(investor_type) between 2 and 60),
  constraint investor_app_type_value_chk check (investor_type in ('angel', 'venture_capital', 'accelerator', 'investment_fund', 'corporate', 'family_office', 'development_finance', 'other')),
  constraint investor_app_background_len check (char_length(background) between 20 and 3000),
  constraint investor_app_website_chk check (website_url is null or website_url ~* '^https?://'),
  constraint investor_app_proof_chk check (proof_url is null or proof_url ~* '^https?://'),
  constraint investor_app_range_check check (
    (investment_min is null or investment_min >= 0) and
    (investment_max is null or investment_max >= 0) and
    (investment_min is null or investment_max is null or investment_max >= investment_min)
  ),
  constraint investor_app_currency_check check (investment_currency ~ '^[A-Z]{3}$'),
  constraint investor_app_array_sizes_check check (cardinality(sectors) <= 15 and cardinality(stages) <= 6 and cardinality(markets) <= 8),
  constraint investor_app_portfolio_len check (portfolio is null or char_length(portfolio) <= 3000),
  constraint investor_app_status_check check (status in ('pending', 'approved', 'rejected', 'withdrawn'))
);
create unique index investor_app_one_pending_per_user on public.investor_applications(user_id) where status = 'pending';
create index investor_app_review_queue on public.investor_applications(status, created_at);

create trigger investor_applications_updated_at before update on public.investor_applications
  for each row execute function public.set_updated_at();

-- One record represents a founder's pitch or request for an introduction. It is also the
-- investor-side pipeline item; status transitions are visible to both parties.
create table public.investor_submissions (
  id uuid primary key default gen_random_uuid(),
  investor_id uuid not null references public.investors(id) on delete cascade,
  founder_id uuid not null references public.profiles(id) on delete cascade,
  startup_id uuid references public.startups(id) on delete set null,
  submission_type text not null default 'introduction',
  startup_name text not null,
  summary text not null,
  stage public.startup_stage,
  funding_amount numeric(14,2),
  funding_currency char(3) not null default 'USD',
  fit_reason text not null,
  pitch_deck_url text,
  status text not null default 'new',
  investor_response text,
  additional_info text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint investor_submission_type_check check (submission_type in ('introduction', 'pitch')),
  constraint investor_submission_name_len check (char_length(startup_name) between 2 and 120),
  constraint investor_submission_summary_len check (char_length(summary) between 30 and 3000),
  constraint investor_submission_fit_len check (char_length(fit_reason) between 10 and 1500),
  constraint investor_submission_amount_check check (funding_amount is null or funding_amount >= 0),
  constraint investor_submission_currency_check check (funding_currency ~ '^[A-Z]{3}$'),
  constraint investor_submission_deck_check check (pitch_deck_url is null or pitch_deck_url ~* '^https?://'),
  constraint investor_submission_status_check check (status in ('new', 'under_review', 'interested', 'meeting_requested', 'in_discussion', 'declined', 'closed')),
  constraint investor_submission_response_len check (investor_response is null or char_length(investor_response) <= 2000),
  constraint investor_submission_additional_len check (additional_info is null or char_length(additional_info) <= 2000)
);
create index investor_submissions_investor_queue on public.investor_submissions(investor_id, status, created_at desc);
create index investor_submissions_founder_idx on public.investor_submissions(founder_id, created_at desc);
create trigger investor_submissions_updated_at before update on public.investor_submissions
  for each row execute function public.set_updated_at();

create table public.investor_submission_messages (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.investor_submissions(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  constraint investor_message_body_len check (char_length(body) between 1 and 4000)
);
create index investor_messages_thread_idx on public.investor_submission_messages(submission_id, created_at);

create table public.investor_saved_startups (
  investor_id uuid not null references public.investors(id) on delete cascade,
  startup_id uuid not null references public.startups(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (investor_id, startup_id)
);


-- Ownership and private contact details live separately from the public investor directory.
create table public.investor_accounts (
  investor_id uuid primary key references public.investors(id) on delete cascade,
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  contact_email citext,
  private_background text check (private_background is null or char_length(private_background) <= 3000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger investor_accounts_updated_at before update on public.investor_accounts
  for each row execute function public.set_updated_at();
alter table public.investor_accounts enable row level security;
grant select on public.investor_accounts to anon, authenticated;
revoke update on public.investor_accounts from authenticated;
grant update (contact_email, private_background) on public.investor_accounts to authenticated;
create policy investor_accounts_own_select on public.investor_accounts for select to authenticated
  using (user_id = auth.uid());
create policy investor_accounts_own_update on public.investor_accounts for update to authenticated
  using (user_id = auth.uid() and public.is_active_user()) with check (user_id = auth.uid() and public.is_active_user());
create policy investor_accounts_staff_select on public.investor_accounts for select to authenticated
  using (public.is_staff() and public.is_active_user());

create or replace function public.guard_investor_owner_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  if exists (select 1 from public.investor_accounts ia where ia.investor_id = old.id and ia.user_id = auth.uid())
    and not public.is_staff() then
    if new.is_published is distinct from old.is_published
      or new.verification_status is distinct from old.verification_status
      or new.is_demo is distinct from old.is_demo
      or new.created_by is distinct from old.created_by
      or new.created_at is distinct from old.created_at
      or new.id is distinct from old.id
      or new.slug is distinct from old.slug then
      raise exception 'forbidden' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger investors_guard_owner_update before update on public.investors
  for each row execute function public.guard_investor_owner_update();

-- Extend public investor visibility without exposing private applications or deal-flow records.
drop policy investors_select on public.investors;
create policy investors_select on public.investors for select to anon, authenticated
  using (is_published or (public.is_staff() and public.is_active_user()) or exists (select 1 from public.investor_accounts ia where ia.investor_id = investors.id and ia.user_id = auth.uid()));
drop policy investors_staff_write on public.investors;
create policy investors_staff_write on public.investors for all to authenticated
  using (public.is_staff() and public.is_active_user()) with check (public.is_staff() and public.is_active_user());
create policy investors_owner_update on public.investors for update to authenticated
  using (exists (select 1 from public.investor_accounts ia where ia.investor_id = id and ia.user_id = auth.uid()) and public.is_active_user())
  with check (exists (select 1 from public.investor_accounts ia where ia.investor_id = id and ia.user_id = auth.uid()) and public.is_active_user());
grant update (name, description, website_url, country, regions, stages, sectors, thesis, contact_url,
  investor_type, investment_min, investment_max, investment_currency, portfolio)
  on public.investors to authenticated;
grant update (contact_email, private_background) on public.investor_accounts to authenticated;

alter table public.investor_applications enable row level security;
grant select on public.investor_applications to authenticated;
revoke insert on public.investor_applications from authenticated;
grant insert (user_id, existing_investor_id, organization_name, investor_type, website_url, contact_email, background, sectors, stages, markets, investment_min, investment_max, investment_currency, portfolio, proof_url) on public.investor_applications to authenticated;
create policy investor_applications_own_select on public.investor_applications for select to authenticated
  using (user_id = auth.uid());
create policy investor_applications_own_insert on public.investor_applications for insert to authenticated
  with check (user_id = auth.uid() and public.is_active_user() and status = 'pending'
    and reviewed_by is null and reviewed_at is null);
create policy investor_applications_staff_select on public.investor_applications for select to authenticated
  using (public.is_staff() and public.is_active_user());

create or replace function public.investor_accepts_introductions(p_investor uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.investors i
    join public.investor_accounts ia on ia.investor_id = i.id
    where i.id = p_investor and i.is_published and not i.is_demo and (auth.uid() is null or ia.user_id <> auth.uid())
  )
$$;
revoke all on function public.investor_accepts_introductions(uuid) from public;
grant execute on function public.investor_accepts_introductions(uuid) to anon, authenticated;

alter table public.investor_submissions enable row level security;
grant select on public.investor_submissions to authenticated;
revoke insert on public.investor_submissions from authenticated;
grant insert (investor_id, founder_id, startup_id, submission_type, startup_name, summary, stage, funding_amount, funding_currency, fit_reason, pitch_deck_url) on public.investor_submissions to authenticated;
grant update (status, investor_response, additional_info) on public.investor_submissions to authenticated;
create policy investor_submissions_party_select on public.investor_submissions for select to authenticated
  using (public.is_active_user() and (
    founder_id = auth.uid()
    or exists (select 1 from public.investor_accounts ia where ia.investor_id = investor_submissions.investor_id and ia.user_id = auth.uid())
    or public.is_staff()
  ));
create policy investor_submissions_founder_insert on public.investor_submissions for insert to authenticated
  with check (
    founder_id = auth.uid() and public.is_active_user()
    and public.investor_accepts_introductions(investor_id)
    and (startup_id is null or exists (
      select 1 from public.startup_members sm where sm.startup_id = investor_submissions.startup_id
        and sm.user_id = auth.uid() and sm.role in ('owner', 'admin', 'editor')
    ))
    and status = 'new'
  );
create policy investor_submissions_investor_update on public.investor_submissions for update to authenticated
  using (public.is_active_user() and exists (select 1 from public.investor_accounts ia where ia.investor_id = investor_submissions.investor_id and ia.user_id = auth.uid()))
  with check (public.is_active_user() and exists (select 1 from public.investor_accounts ia where ia.investor_id = investor_submissions.investor_id and ia.user_id = auth.uid()));

alter table public.investor_submission_messages enable row level security;
grant select on public.investor_submission_messages to authenticated;
revoke insert on public.investor_submission_messages from authenticated;
grant insert (submission_id, sender_id, body) on public.investor_submission_messages to authenticated;
create policy investor_messages_party_select on public.investor_submission_messages for select to authenticated
  using (public.is_active_user() and exists (
    select 1 from public.investor_submissions s join public.investors i on i.id = s.investor_id
    where s.id = submission_id and (s.founder_id = auth.uid() or exists (select 1 from public.investor_accounts ia where ia.investor_id = i.id and ia.user_id = auth.uid()))
  ));
create policy investor_messages_party_insert on public.investor_submission_messages for insert to authenticated
  with check (sender_id = auth.uid() and public.is_active_user() and exists (
    select 1 from public.investor_submissions s join public.investors i on i.id = s.investor_id
    where s.id = submission_id and (s.founder_id = auth.uid() or exists (select 1 from public.investor_accounts ia where ia.investor_id = i.id and ia.user_id = auth.uid()))
  ));

alter table public.investor_saved_startups enable row level security;
grant select, delete on public.investor_saved_startups to authenticated;
revoke insert on public.investor_saved_startups from authenticated;
grant insert (investor_id, startup_id) on public.investor_saved_startups to authenticated;
create policy investor_saved_startups_owner_all on public.investor_saved_startups for all to authenticated
  using (public.is_active_user() and exists (select 1 from public.investor_accounts ia where ia.investor_id = investor_saved_startups.investor_id and ia.user_id = auth.uid()))
  with check (public.is_active_user() and exists (select 1 from public.investor_accounts ia where ia.investor_id = investor_saved_startups.investor_id and ia.user_id = auth.uid()) and exists (select 1 from public.startups st where st.id = investor_saved_startups.startup_id and st.status = 'published'));

create or replace function public.investor_listing_claimable(p_investor uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.investors i where i.id = p_investor and i.is_published and not i.is_demo)
    and not exists (select 1 from public.investor_accounts ia where ia.investor_id = p_investor)
$$;
revoke all on function public.investor_listing_claimable(uuid) from public;
grant execute on function public.investor_listing_claimable(uuid) to anon, authenticated;

-- Staff approval claims an existing directory listing or creates a new one in the same transaction.
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
      insert into public.investor_accounts(investor_id, user_id, contact_email, private_background)
        values (v_investor, v_app.user_id, v_app.contact_email, v_app.background)
        on conflict (investor_id) do update set contact_email = excluded.contact_email, private_background = excluded.private_background
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
      insert into public.investor_accounts(investor_id, user_id, contact_email, private_background)
        values (v_investor, v_app.user_id, v_app.contact_email, v_app.background)
        on conflict (investor_id) do update set contact_email = excluded.contact_email, private_background = excluded.private_background
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

-- The RPC is the only route for staff to change application review state.

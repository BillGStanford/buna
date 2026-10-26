-- Buna 0005 — row-level security and grants for every table.
-- Model: deny by default, then grant the minimum. Column-level grants stop clients from
-- ever writing privileged columns (role, status, verification, vote counts, ...). Privileged
-- changes go through SECURITY DEFINER functions or the server-side service role.

alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
revoke all on all tables in schema public from anon, authenticated;

-- RLS on for every table in public, including any added later by mistake.
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
end $$;

-- ---------- profiles ----------
grant select on public.profiles to authenticated;
grant update (display_name, username, avatar_url, headline, bio, country, city, professional_role,
              founder_status, interests, expertise, startup_intent, website_url, social_links,
              is_public_profile, show_location, is_discoverable_founder,
              onboarding_completed_at, onboarding_skipped_at)
  on public.profiles to authenticated;
create policy profiles_select_own on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_staff());
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid() and public.is_active_user());

-- Public projection: only what a user chose to publish. Runs with owner rights on purpose.
create view public.public_profiles as
select
  p.id, p.username, p.display_name, p.avatar_url,
  case when p.is_public_profile then p.headline end as headline,
  case when p.is_public_profile then p.bio end as bio,
  case when p.is_public_profile and p.show_location then p.country end as country,
  case when p.is_public_profile and p.show_location then p.city end as city,
  case when p.is_public_profile then p.website_url end as website_url,
  case when p.is_public_profile then p.expertise else '{}'::text[] end as expertise,
  case when p.is_public_profile then p.interests else '{}'::text[] end as interests,
  (p.is_public_profile and p.is_discoverable_founder) as is_discoverable_founder,
  p.is_public_profile
from public.profiles p
where not p.is_suspended;
grant select on public.public_profiles to anon, authenticated;

-- ---------- categories ----------
grant select on public.categories to anon, authenticated;
grant insert, update, delete on public.categories to authenticated;
create policy categories_select on public.categories for select to anon, authenticated
  using (is_active or public.is_admin());
create policy categories_admin_write on public.categories for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------- settings / rate limits: service role only (no client grants) ----------

-- ---------- audit log: admins read; nobody writes from the client ----------
grant select on public.audit_logs to authenticated;
create policy audit_logs_admin_read on public.audit_logs for select to authenticated
  using (public.is_admin());

-- ---------- notifications ----------
grant select, delete on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
create policy notifications_own_select on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notifications_own_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_own_delete on public.notifications for delete to authenticated using (user_id = auth.uid());

grant select on public.notification_preferences to authenticated;
grant update (email_comments, email_replies, email_inquiries, email_moderation, email_opportunity_deadlines)
  on public.notification_preferences to authenticated;
create policy notif_prefs_select on public.notification_preferences for select to authenticated using (user_id = auth.uid());
create policy notif_prefs_update on public.notification_preferences for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- reports ----------
grant select on public.reports to authenticated;
grant insert (reporter_id, target_type, target_id, reason, details) on public.reports to authenticated;
grant update (status, handled_by, handled_at, resolution_note) on public.reports to authenticated;
create policy reports_select on public.reports for select to authenticated
  using (reporter_id = auth.uid() or public.is_staff());
create policy reports_insert on public.reports for insert to authenticated
  with check (reporter_id = auth.uid() and public.is_active_user());
create policy reports_staff_update on public.reports for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- ---------- startups ----------
grant select on public.startups to anon, authenticated;
grant insert (name, slug, tagline, description, logo_url, website_url, country, city, category_id, tags,
              stage, founded_year, created_by) on public.startups to authenticated;
grant update (name, slug, tagline, description, logo_url, website_url, country, city, category_id, tags,
              stage, founded_year) on public.startups to authenticated;
grant delete on public.startups to authenticated;
create policy startups_select_public on public.startups for select to anon, authenticated
  using (status = 'published');
-- created_by is included so INSERT ... RETURNING works before the owner-membership trigger is visible
create policy startups_select_members on public.startups for select to authenticated
  using (created_by = auth.uid() or public.is_startup_member(id));
create policy startups_select_staff on public.startups for select to authenticated
  using (public.is_staff());
create policy startups_insert on public.startups for insert to authenticated
  with check (created_by = auth.uid() and public.is_active_user());
create policy startups_update on public.startups for update to authenticated
  using (public.can_edit_startup(id))
  with check (public.can_edit_startup(id) and public.is_active_user());
create policy startups_delete_draft on public.startups for delete to authenticated
  using (status = 'draft' and public.is_startup_member(id, array['owner']::public.member_role[]));

grant select on public.startup_slug_history to anon, authenticated;
create policy slug_history_select on public.startup_slug_history for select to anon, authenticated
  using (public.startup_is_published(startup_id) or public.is_startup_member(startup_id) or public.is_staff());

-- ---------- memberships (read-only for clients; changes via definer functions / server) ----------
grant select on public.startup_members to anon, authenticated;
create policy members_select on public.startup_members for select to anon, authenticated
  using (
    (is_public and public.startup_is_published(startup_id))
    or user_id = auth.uid()
    or public.is_startup_member(startup_id)
    or public.is_staff()
  );

-- ---------- products / media / links ----------
do $$
declare t text;
begin
  foreach t in array array['startup_products', 'startup_media', 'startup_links'] loop
    execute format('grant select on public.%I to anon, authenticated', t);
    execute format('grant insert, update, delete on public.%I to authenticated', t);
    execute format($p$create policy %I on public.%I for select to anon, authenticated
      using (public.startup_is_published(startup_id) or public.is_startup_member(startup_id) or public.is_staff())$p$,
      t || '_select', t);
    execute format($p$create policy %I on public.%I for insert to authenticated
      with check (public.can_edit_startup(startup_id) and public.is_active_user())$p$, t || '_insert', t);
    execute format($p$create policy %I on public.%I for update to authenticated
      using (public.can_edit_startup(startup_id))
      with check (public.can_edit_startup(startup_id) and public.is_active_user())$p$, t || '_update', t);
    execute format($p$create policy %I on public.%I for delete to authenticated
      using (public.can_edit_startup(startup_id))$p$, t || '_delete', t);
  end loop;
end $$;

-- ---------- verification ----------
grant select on public.verification_requests to authenticated;
grant insert (startup_id, requested_by, notes, evidence_paths) on public.verification_requests to authenticated;
create policy verification_select on public.verification_requests for select to authenticated
  using (public.is_startup_member(startup_id, array['owner', 'admin']::public.member_role[]) or public.is_staff());
create policy verification_insert on public.verification_requests for insert to authenticated
  with check (requested_by = auth.uid() and public.is_active_user()
              and public.is_startup_member(startup_id, array['owner', 'admin']::public.member_role[]));

-- ---------- launches ----------
grant select on public.launches to anon, authenticated;
grant insert (slug, startup_id, submitted_by, name, tagline, description, logo_url, product_url,
              demo_video_url, category_id, tags, launch_date) on public.launches to authenticated;
grant update (slug, startup_id, name, tagline, description, logo_url, product_url, demo_video_url,
              category_id, tags, launch_date) on public.launches to authenticated;
create policy launches_select_public on public.launches for select to anon, authenticated
  using (status = 'published');
create policy launches_select_owner on public.launches for select to authenticated
  using (submitted_by = auth.uid() or (startup_id is not null and public.is_startup_member(startup_id)));
create policy launches_select_staff on public.launches for select to authenticated
  using (public.is_staff());
create policy launches_insert on public.launches for insert to authenticated
  with check (submitted_by = auth.uid() and public.is_active_user()
              and (startup_id is null or public.can_edit_startup(startup_id)));
create policy launches_update on public.launches for update to authenticated
  using ((submitted_by = auth.uid() or (startup_id is not null and public.can_edit_startup(startup_id)))
         and status <> 'removed')
  with check (public.is_active_user()
              and (startup_id is null or public.can_edit_startup(startup_id)));

-- votes: insert-only. No UPDATE/DELETE grant exists, so a cast vote is permanent.
grant select on public.launch_votes to authenticated;
grant insert (launch_id, user_id) on public.launch_votes to authenticated;
create policy votes_select on public.launch_votes for select to authenticated
  using (user_id = auth.uid() or public.is_staff());
create policy votes_insert on public.launch_votes for insert to authenticated
  with check (user_id = auth.uid() and public.is_active_user() and public.has_verified_email()
              and exists (select 1 from public.launches l where l.id = launch_id and l.status = 'published'));

-- ---------- comments ----------
grant select on public.comments to anon, authenticated;
grant insert (launch_id, author_id, parent_id, body) on public.comments to authenticated;
grant update (body, status, edited_at) on public.comments to authenticated;
create policy comments_select_public on public.comments for select to anon, authenticated
  using (status = 'visible'
         and exists (select 1 from public.launches l where l.id = launch_id and l.status = 'published'));
create policy comments_select_own on public.comments for select to authenticated
  using (author_id = auth.uid() or public.is_staff());
create policy comments_insert on public.comments for insert to authenticated
  with check (author_id = auth.uid() and public.is_active_user() and public.has_verified_email()
              and exists (select 1 from public.launches l where l.id = launch_id and l.status = 'published'));
create policy comments_update_own on public.comments for update to authenticated
  using (author_id = auth.uid() and status = 'visible')
  with check (author_id = auth.uid() and status in ('visible', 'deleted') and public.is_active_user());

-- ---------- follows ----------
grant select, insert, delete on public.follows to authenticated;
create policy follows_select on public.follows for select to authenticated using (follower_id = auth.uid());
create policy follows_insert on public.follows for insert to authenticated
  with check (follower_id = auth.uid() and public.is_active_user());
create policy follows_delete on public.follows for delete to authenticated using (follower_id = auth.uid());

-- ---------- opportunities ----------
grant select on public.opportunities to anon, authenticated;
grant insert, update, delete on public.opportunities to authenticated;
create policy opportunities_select on public.opportunities for select to anon, authenticated
  using (status in ('published', 'expired') or public.is_staff());
create policy opportunities_staff_write on public.opportunities for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

grant select, insert, delete on public.saved_opportunities to authenticated;
create policy saved_opps_select on public.saved_opportunities for select to authenticated using (user_id = auth.uid());
create policy saved_opps_insert on public.saved_opportunities for insert to authenticated
  with check (user_id = auth.uid() and public.is_active_user());
create policy saved_opps_delete on public.saved_opportunities for delete to authenticated using (user_id = auth.uid());

-- ---------- investors ----------
grant select on public.investors to anon, authenticated;
grant insert, update, delete on public.investors to authenticated;
create policy investors_select on public.investors for select to anon, authenticated
  using (is_published or public.is_staff());
create policy investors_staff_write on public.investors for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- ---------- inquiries: created server-side (validated + rate limited); owners read/manage ----------
grant select on public.inquiries to authenticated;
grant update (status, read_at) on public.inquiries to authenticated;
create policy inquiries_select on public.inquiries for select to authenticated
  using (public.is_startup_member(startup_id, array['owner', 'admin', 'editor']::public.member_role[]));
create policy inquiries_update on public.inquiries for update to authenticated
  using (public.is_startup_member(startup_id, array['owner', 'admin', 'editor']::public.member_role[]))
  with check (public.is_startup_member(startup_id, array['owner', 'admin', 'editor']::public.member_role[]));

-- ---------- team invitations: created/accepted server-side; owners and admins can see ----------
grant select on public.team_invitations to authenticated;
create policy invitations_select on public.team_invitations for select to authenticated
  using (public.is_startup_member(startup_id, array['owner', 'admin']::public.member_role[]));

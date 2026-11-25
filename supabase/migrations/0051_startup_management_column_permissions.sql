-- regression-test: supabase/tests/startup_management_permissions.sql
-- 0051: grant founders update access to startup-management columns introduced in 0050.
-- Existing startups_update RLS policy still limits these updates to authorized,
-- active startup members (owner/admin/editor).

grant update (hiring_status, is_product_live, last_public_update_at)
  on public.startups to authenticated;

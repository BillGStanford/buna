-- Buna 0044 — grant the authenticated onboarding flow only the profile columns it writes.
-- regression-test: supabase/tests/onboarding_progression.sql

-- Profile UPDATE is deliberately column-scoped. RLS remains responsible for
-- restricting which profile row a member may update.
grant update (
  account_type,
  onboarding_data,
  display_name,
  username,
  headline,
  bio,
  avatar_url,
  website_url,
  professional_role,
  interests,
  country,
  city,
  social_links,
  founder_status,
  startup_intent,
  onboarding_completed_at,
  onboarding_skipped_at
) on public.profiles to authenticated;

-- Buna 0007 — real reference data (not demo data): sectors and default platform settings.
-- Idempotent: safe to re-run.

insert into public.categories (slug, name, sort_order) values
  ('fintech', 'Fintech', 10),
  ('agritech', 'Agritech', 20),
  ('healthtech', 'Healthtech', 30),
  ('edtech', 'Edtech', 40),
  ('ecommerce-marketplaces', 'E-commerce & Marketplaces', 50),
  ('logistics-mobility', 'Logistics & Mobility', 60),
  ('energy-cleantech', 'Energy & Cleantech', 70),
  ('developer-tools-saas', 'Developer Tools & SaaS', 80),
  ('ai-data', 'AI & Data', 90),
  ('creative-media', 'Creative & Media', 100),
  ('govtech-civic-tech', 'Govtech & Civic Tech', 110),
  ('proptech', 'Proptech', 120),
  ('travel-hospitality', 'Travel & Hospitality', 130),
  ('gaming', 'Gaming', 140),
  ('other', 'Other', 999)
on conflict (slug) do nothing;

-- Moderation switches. Change them in the admin settings (phase 5) or directly in SQL.
insert into public.platform_settings (key, value) values
  ('startups_require_review', 'false'::jsonb),   -- false: verified-email owners publish immediately
  ('launches_require_review', 'true'::jsonb)     -- true: launches wait for moderator approval
on conflict (key) do nothing;

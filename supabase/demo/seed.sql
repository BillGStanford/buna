-- DEMO DATA — LOCAL / PREVIEW ENVIRONMENTS ONLY. NEVER RUN AGAINST PRODUCTION.
-- Every row is a fictional company, flagged is_demo = true, labelled "(Demo)" and shown with a
-- "Demo" badge in the UI. Remove it all with supabase/demo/clear.sql.
--   psql "$DATABASE_URL" -v allow_demo=1 -f supabase/demo/seed.sql
\if :{?allow_demo}
\else
  \echo 'Refusing to load demo data. Pass -v allow_demo=1 (and never run this against production).'
  \quit
\endif

insert into public.startups
  (slug, name, tagline, description, country, city, category_id, stage, founded_year, status, is_demo, published_at, tags)
select v.slug, v.name, v.tagline,
       'This is a fictional demo company used to preview Buna layouts. It does not exist and has no real products, customers or funding.',
       v.country, v.city, (select c.id from public.categories c where c.slug = v.cat),
       v.stage::public.startup_stage, v.founded, 'published', true, now() - make_interval(days => v.days), v.tags
from (values
  ('demo-ledgerly',    'Ledgerly (Demo)',    'Bookkeeping for small shops, from a phone.',            'ET', 'Addis Ababa', 'fintech',                'mvp',           2024, 2,  array['payments','smb']),
  ('demo-harvestline', 'Harvestline (Demo)', 'Connects smallholder farms with nearby buyers.',        'KE', 'Nairobi',     'agritech',               'early_revenue', 2023, 5,  array['marketplace']),
  ('demo-clinicloop',  'Clinicloop (Demo)',  'Appointment reminders for community clinics.',          'GH', 'Accra',       'healthtech',             'prototype',     2025, 9,  array['sms']),
  ('demo-tutorbridge', 'Tutorbridge (Demo)', 'Matches university students with school tutors.',       'ET', 'Bahir Dar',   'edtech',                 'idea',          2025, 14, array['education']),
  ('demo-cargoflow',   'Cargoflow (Demo)',   'Shared truckload tracking for regional freight.',       'RW', 'Kigali',      'logistics-mobility',     'growth',        2021, 20, array['freight']),
  ('demo-solarpath',   'Solarpath (Demo)',   'Pay-as-you-go solar kits for rural homes.',             'NG', 'Lagos',       'energy-cleantech',       'scale',         2019, 27, array['solar']),
  ('demo-shelfie',     'Shelfie Market (Demo)', 'A storefront builder for social sellers.',           'ZA', 'Cape Town',   'ecommerce-marketplaces', 'mvp',           2024, 33, array['commerce']),
  ('demo-codeyard',    'Codeyard (Demo)',    'Open tooling for building offline-first apps.',         'ET', 'Addis Ababa', 'developer-tools-saas',   'prototype',     2025, 41, array['developer-tools'])
) as v(slug, name, tagline, country, city, cat, stage, founded, days, tags)
on conflict (slug) do nothing;

insert into public.startup_products (startup_id, name, description, sort_order)
select s.id, p.name, p.description, p.ord
from (values
  ('demo-ledgerly', 'Ledgerly Mobile', 'Record sales and expenses in seconds (fictional).', 1),
  ('demo-ledgerly', 'Ledgerly Reports', 'Weekly summaries for shop owners (fictional).', 2),
  ('demo-harvestline', 'Harvestline Market', 'A buyer and seller directory (fictional).', 1)
) as p(slug, name, description, ord)
join public.startups s on s.slug = p.slug and s.is_demo
where not exists (select 1 from public.startup_products x where x.startup_id = s.id and x.name = p.name);

-- demo launches: published, zero votes and zero comments (no invented activity)
insert into public.launches (slug, name, tagline, description, product_url, category_id, tags, status, published_at, launch_date, is_demo)
select v.slug, v.name, v.tagline, 'A fictional demo product used to preview Buna layouts. It does not exist.',
       'https://example.com/demo', (select c.id from public.categories c where c.slug = v.cat), v.tags, 'published',
       now() - make_interval(hours => v.hours), (now() - make_interval(hours => v.hours))::date, true
from (values
  ('demo-ledgerly-mobile', 'Ledgerly Mobile (Demo)', 'Record sales and expenses in seconds.',        'fintech',            array['payments','mobile'], 3),
  ('demo-harvest-market',  'Harvestline Market (Demo)', 'A buyer and seller directory for farms.',  'agritech',           array['marketplace'],        20),
  ('demo-clinic-reminders','Clinic Reminders (Demo)', 'SMS appointment reminders for clinics.',      'healthtech',         array['sms'],                50),
  ('demo-tutor-match',     'Tutor Match (Demo)', 'Matches students with school tutors.',             'edtech',             array['education'],          80),
  ('demo-truck-tracker',   'Truck Tracker (Demo)', 'Shared truckload tracking for freight.',         'logistics-mobility', array['freight'],            120),
  ('demo-offline-kit',     'Offline Kit (Demo)', 'Tooling for offline-first apps.',                  'developer-tools-saas', array['developer-tools'],  200)
) as v(slug, name, tagline, cat, tags, hours)
on conflict (slug) do nothing;

-- demo opportunities (fictional programmes — not real grants, deadlines or organisations)
insert into public.opportunities (slug, title, organization, description, category, eligibility, countries, deadline, application_url, source_url, published_date, last_checked_at, status, tags, is_demo)
values
  ('demo-seed-grant', 'Demo Seed Grant (Demo)', 'Demo Foundation (fictional)', 'A fictional grant used to preview Buna layouts. It does not exist.', 'grant', 'Early-stage startups (fictional).', array['ET', 'KE'], now() + interval '10 days', 'https://example.com/apply', 'https://example.com/source', current_date - 5, now() - interval '1 day', 'published', array['funding'], true),
  ('demo-accelerator', 'Demo Accelerator Cohort (Demo)', 'Demo Labs (fictional)', 'A fictional accelerator used to preview Buna layouts.', 'accelerator', 'Teams with a working prototype (fictional).', '{}', now() + interval '45 days', 'https://example.com/apply', 'https://example.com/source', current_date - 12, now() - interval '2 days', 'published', array['accelerator'], true),
  ('demo-pitch-night', 'Demo Pitch Night (Demo)', 'Demo Community (fictional)', 'A fictional event used to preview Buna layouts.', 'event', 'Open to everyone (fictional).', array['ET'], now() + interval '2 days', null, 'https://example.com/source', current_date - 2, now(), 'published', array['pitch'], true),
  ('demo-fellowship', 'Demo Rolling Fellowship (Demo)', 'Demo Institute (fictional)', 'A fictional fellowship with no deadline.', 'fellowship', 'Founders and operators (fictional).', '{}', null, 'https://example.com/apply', 'https://example.com/source', current_date - 30, now() - interval '3 days', 'published', array['fellowship'], true),
  ('demo-closed-challenge', 'Demo Closed Challenge (Demo)', 'Demo Forum (fictional)', 'A fictional competition whose deadline has passed.', 'competition', 'Students (fictional).', array['GH'], now() - interval '4 days', null, 'https://example.com/source', current_date - 40, now() - interval '5 days', 'expired', array['competition'], true)
on conflict (slug) do nothing;

-- demo investors (fictional, unverified, no invented fund sizes or portfolios)
insert into public.investors (slug, name, description, website_url, country, regions, stages, sectors, thesis, contact_url, verification_status, is_published, is_demo)
values
  ('demo-capital-partners', 'Demo Capital Partners (Demo)', 'A fictional investor used to preview Buna layouts.', 'https://example.com', 'ET', array['East Africa'], array['idea', 'prototype']::public.startup_stage[], array['fintech', 'agritech'], 'Fictional thesis text for layout previews.', 'https://example.com/contact', 'unverified', true, true),
  ('demo-angel-circle', 'Demo Angel Circle (Demo)', 'A fictional angel network used to preview Buna layouts.', 'https://example.com', 'KE', array['East Africa', 'West Africa'], array['mvp', 'early_revenue']::public.startup_stage[], array['healthtech'], null, null, 'unverified', true, true)
on conflict (slug) do nothing;

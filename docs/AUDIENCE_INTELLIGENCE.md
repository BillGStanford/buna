# Buna Audience Intelligence

## Purpose

Audience Intelligence gives each startup team a truthful picture of how its public Buna profile is discovered and whether that attention turns into meaningful activity. It is not an advertising tracker, a people-search product, or a vanity-views counter.

The principle is simple: **measure what helps a founder make a better decision, and collect no more than the measurement requires.**

## What is measured

- Profile views and distinct pseudonymous visitors.
- New versus returning visitors.
- First-touch source attribution: direct, referral, Reddit, Product Hunt, LinkedIn, Meta, Telegram, Google, Bing, X, or a sanitized UTM source.
- Referring domains and UTM campaign labels.
- Country-level geography when the hosting edge provides it.
- Broad device category: mobile, desktop, tablet, or unknown.
- Product-link clicks, main website clicks, and launch-detail clicks.
- Startup follows and inquiries attributed to a visitor when the first-party visitor cookie is available.
- Existing platform engagement: followers, live launches, votes, comments, inquiries, and aggregate investor saves.
- Weekly profile-view trend and visitor cohorts that returned at least seven days after first discovery.

## Event flow

1. A visitor opens a published, non-demo startup profile.
2. The browser creates a random visitor UUID (first-party, retained for up to 13 months) and a session UUID (session storage).
3. The browser sends a small event payload to `POST /api/analytics/event`.
4. The server validates the event, verifies that the startup is published and not a demo, applies rate limits, and derives a country code from the hosting edge when available.
5. The server stores the event through the service-role client. The database trigger updates the visitor record and daily aggregates atomically.
6. Founder analytics queries run server-side only after the signed-in profile is confirmed as a startup team member with an analytics page permission.

The first recorded source is retained as the visitor's first-touch attribution. Later page views and conversions keep that original source so the dashboard does not overwrite discovery attribution with internal navigation.

## Event types

| Event | Meaning |
| --- | --- |
| `page_view` | A published startup profile was loaded |
| `product_click` | A visitor clicked a listed product link |
| `website_click` | A visitor clicked the startup's website link |
| `launch_view` | A visitor opened a launch associated with the startup |
| `follow` | A visitor followed the startup |
| `inquiry` | A visitor sent a startup inquiry |

Action totals count events, not necessarily distinct people. One visitor may click more than one link or send more than one inquiry.

## Metric definitions

- **Unique visitors (30 days):** distinct random visitor IDs with at least one event in the last 30 days. IDs are browser-specific, not verified human identities.
- **Profile views:** recorded profile-load events in the selected period.
- **New visitors:** active visitor IDs whose first recorded visit was within the last 30 days.
- **Returning visitors:** active visitor IDs first seen before the 30-day window.
- **Source:** first-touch source assigned when the visitor was first recorded.
- **Geography:** country code supplied by the hosting edge; unknown or unavailable locations are excluded from the country ranking.
- **Conversion funnel:** event totals for product clicks, website clicks, follows, and inquiries alongside profile visitors. The action counts are not unique-person counts.
- **Retention cohort:** visitors grouped by the UTC week of their first recorded visit; a visitor is counted as returned when their last recorded visit is at least seven days after first discovery.
- **Investor saves:** aggregate count of times investors saved the startup. Individual investor identities are not exposed in this report.

## Privacy and security rules

- No raw IP address is written to analytics tables.
- No email, name, full referrer URL, URL query string, browser fingerprint, or cross-site tracking ID is collected.
- Referrers are reduced to a hostname; UTM source and campaign values are length-limited and sanitized.
- Geography is country-level only. No city, precise location, or coordinates are collected.
- Visitor IDs are random UUIDs stored first-party. They are not linked to an account identity.
- The tracker respects browser Do Not Track and Global Privacy Control signals, and does not run on demo pages, previews, or for startup team members viewing their own profile.
- Obvious automated user agents are excluded as a heuristic; this is not a guarantee that all bots are removed.
- Analytics tables have RLS enabled and no direct anon/authenticated grants. Only server-side service-role code can read or write them.
- The analytics dashboard checks startup membership before using the service-role client.
- Raw events, visitor rows, and per-day visitor IDs are pruned after 13 months. Daily aggregate totals remain for longitudinal reporting.
- Never expose an individual visitor's identity or sell visitor-level data.

## Operational rollout

1. Merge the feature branch after CI and code review.
2. Apply `supabase/migrations/0022_startup_audience_intelligence.sql` to the Supabase project before deploying the application.
3. Confirm `SUPABASE_SERVICE_ROLE_KEY` and the existing daily cron configuration are present.
4. Verify a published non-demo startup profile produces a `page_view`, then test product/website/launch clicks, follows, and inquiries.
5. Confirm the startup team can see its own analytics and a different account cannot access the same dashboard.
6. Confirm the daily cron reports `analyticsEventsPruned` and that the privacy policy is deployed with the feature.

## Known limitations

- Visitors who block browser storage or opt out through DNT/GPC are not counted.
- A visitor ID represents a browser profile, not a verified person; another device or cleared storage creates a new ID.
- Country data depends on the hosting edge header and may be unavailable.
- Bot filtering is heuristic and cannot eliminate every automated request.
- First-touch attribution favors the original discovery channel; it is not a last-click marketing attribution model.
- Cohort rows are based on recent visitor history returned to the dashboard. Headline visitor totals use exact database counts.

## Later extensions

Only after the first-party measurement is reliable should Buna add saved analytics reports, source comparison over longer periods, founder alerts, carefully anonymized sector/region benchmarks, and aggregate ecosystem reports. Any cross-startup benchmark must use minimum cohort thresholds so small groups cannot be reverse-identified.

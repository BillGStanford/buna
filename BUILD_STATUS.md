# Buna — build status

_Last updated: 2026-10-31 — launch-readiness pass in PR #1; changes are not yet merged or production-verified._

| # | Phase | Status |
|---|---|---|
| 1 | Foundation, schema + RLS, auth, onboarding, profiles (including social links) | **Built** |
| 2 | Startups: directory, profiles, owner workspace, uploads, slug redirects | **Done** |
| 3 | Launches, locked voting, comments, follows, notifications, moderation | **Done** |
| 4 | Opportunities, founder & investor directories, inquiries, teams, account tools, legal pages, brand assets | **Done** (see "Not verified") |
| 5 | Full admin & moderation, verification, security review, accessibility, performance, e2e specs, deployment | In progress — launch blocked on verification |

## Phase 4 — what exists

- **Opportunities** (`/opportunities`, `/opportunities/[slug]`): Open / closing soon / rolling / closed tabs, search, type and country filters, deadline sorting, pagination; save/unsave; closed listings labelled and never offered an Apply button; `/dashboard/saved`; deadline reminders (in-app, email only if opted in); staff management in `/admin/opportunities` (create, edit, publish, expire, archive, "checked today"; stale-listing flag; source link required to publish).
- **Founders** (`/founders`, `/founders/[username]`): opt-in directory with search, country, city, industry, expertise and "open to" filters; "open to" preference added to profiles. Public profiles now support validated social links (LinkedIn, X, GitHub, Instagram, YouTube, TikTok, Facebook and Threads); links are saved in the existing `profiles.social_links` field and exposed through a restricted RPC.
- **Investors** (`/investors`, `/investors/[slug]`): published listings with stage/sector/country filters, verified vs not-verified labelling, explicit non-endorsement and no-brokerage notices; admin management (only admins can verify).
- **Inquiries:** contact form on every published startup (honeypot, rate limits, de-duplication), in-app + email notification to the team, `/dashboard/inquiries` with statuses, mark-read-on-open, reply-by-email link, delivery status and retry. PR #1 adds per-recipient delivery claims so a partial retry skips recipients already sent successfully.
- **Teams:** `/dashboard/startup/[id]/team` — hashed single-use invitations by email (`/invite/[token]`), role changes and removals with escalation protection, last-owner protection, public-team visibility, leave team. **Analytics** tab with real counts only (no page-view tracking).
- **Account:** `/dashboard/settings` — data export (JSON) and permanent account deletion with ownership safeguards; richer dashboard overview.
- **Information pages:** About, Help (FAQ), Contact (stored inbox, `/admin/messages`), Terms, Privacy, Community Guidelines; terms acceptance recorded at signup.
- **Brand & imagery:** logo set, hero and eight empty-state illustrations (single source in `src/lib/art.ts`, exported to SVG/PNG by `npm run assets`), favicon, app icons, web manifest, generated 1200×630 share cards for site, startups, launches and opportunities.
- **Database:** migration 0010 (inquiry/contact functions, team invitation/role/removal functions, last-owner guard, account-deletion preparation, opportunity listing and reminders, founder view, terms columns).

## Verification — what was actually run

| Check | Result |
|---|---|
| `tsc --noEmit` (strict), `next lint` (0 warnings) | Pass |
| Latest completed PR run: 148 unit tests | Pass |
| `next build` | Pass |
| Latest completed PR run: 12 migrations on PostgreSQL 16 + SQL suites, including Phase 6 social-profile privacy and inquiry-delivery idempotency checks | Pass |
| Latest recorded pre-PR integration harness: failed the accessibility scan on six routes (`/launches/[slug]`, `/opportunities/[slug]`, `/founders`, `/investors`, startup analytics and `/admin`). PR #1 corrects the launch, opportunity, analytics and admin markup; founder/investor route markup and the complete suite still require a passing rerun. | Pending |

## Current launch-readiness state\n\n- PR #1 adds social-profile editing/display, platform-specific URL validation tests, a restricted public social-link RPC, per-recipient inquiry email retry tracking, fail-closed rate limiting, and Node.js 22 in CI and local version pinning.\n- The new migration `0012_public_profile_social_links.sql` must be applied before deploying the application code.\n- PR #1 run 28 passed typecheck, ESLint, all 148 unit tests, the 12-file migration check, the production build and the full PostgreSQL 16 SQL suite. Its integration run confirmed the social-profile edit/display/privacy flows, username links, verification fixes and every axe accessibility route pass. One brittle homepage assertion matched the wrong “Featured” label; it has been corrected to target the actual featured-startups section and run 31 is validating that correction.\n- The rate limiter now refuses protected requests if its database check fails; this favors security over availability during a database outage.\n\n## Not verified (be aware)

- **Live Supabase and Resend** (Auth emails, Storage uploads, real email delivery — the inquiry/invitation emails go through the same untested Resend call).
- **Real-browser behaviour** (JavaScript interactions, layout at 320–375 px, keyboard use). Contrast is verified by calculation, not by looking at rendered pages. The artwork was checked by rendering and viewing it. The full axe scan passed on all tested routes in run 28. Real-browser manual keyboard and responsive checks remain outstanding.
- Legal pages have **not** been reviewed by a lawyer.
- Vercel deployment, `npm audit` and production-service smoke tests remain outstanding. The current integration harness includes route, workflow, accessibility and response-time checks.

## Known limitations

- Admin screens for reports, startup review, user management, verification, categories, featured picks, settings and audit logs exist; production-role testing and a manual moderation review are still required.
- A CSP header exists, but production `script-src` still permits `unsafe-inline`; nonce-based hardening remains a security task.
- Minimum age (16) and governing-law wording in the legal pages are assumptions to confirm.

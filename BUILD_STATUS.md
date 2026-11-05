# Buna — build status

_Last updated: 2026-11-05 — community and investor-contact implementation is on `feat/community-board-launch-readiness`; merge and production verification are pending._

| # | Phase | Status |
|---|---|---|
| 1 | Foundation, schema + RLS, auth, signup onboarding, profiles (including social links) | **Built** |
| 2 | Startups: directory, profiles, owner workspace, uploads, slug redirects | **Done** |
| 3 | Launches, locked voting, comments, follows, notifications, moderation | **Done** |
| 4 | Opportunities, founder & investor directories, inquiries, teams, investor capital connections, account tools, legal pages, brand assets | **Built** (see "Not verified") |
| 5 | Community discussion board, investor contact-route enforcement | **Implemented on review branch; CI pending** |
| 6 | Security review, accessibility, performance, deployment and production verification | In progress — launch blocked on verification |


## Signup onboarding

- New accounts collect three existing profile answers at signup: country, what best describes the member (founder, co-founder seeker, startup team member, investor, mentor or explorer), and their Buna goal (create a startup profile, join a startup or explore). No new profile questions were invented.
- Answers are validated by the existing Zod rules, saved as Supabase Auth metadata, and copied into `profiles` by the trusted database trigger. The signup baseline is marked complete so members are not asked the same questions again; optional profile enrichment remains available from the dashboard.
- Migration `0013_signup_profile_basics.sql` updates the auth trigger.

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

## Community discussions and investor contact routes (review branch)

- `/community` is a standalone discussion board, not the personalized activity feed. It has five fixed founder categories, public thread pages, one-level replies, per-thread reply-notification subscriptions, in-app notifications and the existing Resend notification outbox.
- `/admin/community` lets staff publish, hide or remove discussion threads. Reply moderation and user-submitted reports for community content remain follow-up hardening.
- Investor applications now require at least one contact route: email, phone, WhatsApp, Telegram, Facebook or another direct URL. Validation exists in the server schema and database constraint; contact details are stored privately and copied to the owned investor account on staff approval.
- No video-upload feature is part of this work.

## Community discussions and investor contact routes (review branch)

- `/community` is a standalone discussion board, not the personalized activity feed. It has five fixed founder categories, public thread pages, one-level replies, per-thread reply-notification subscriptions, in-app notifications and the existing Resend notification outbox.
- `/admin/community` lets staff publish, hide or remove discussion threads. Reply moderation and user-submitted reports for community content remain follow-up hardening.
- Investor applications now require at least one contact route: email, phone, WhatsApp, Telegram, Facebook or another direct URL. Validation exists in the server schema and database constraint; contact details are stored privately and copied to the owned investor account on staff approval.
- No video-upload feature is part of this work.

## Verification — what was actually run

| Check | Result |
|---|---|
| `tsc --noEmit` (strict), `next lint` (0 warnings) | Run 37: Pass |
| `npm test` | Run 37 discovered 152 tests; 2 older signup fixtures failed because the new optional fields were initially required. The current schema defaults omitted answers; rerun pending. |
| `npm run db:check` | Not reached in run 37; rerun pending. |
| `npm run db:test` | Run 37 stopped in Phase 4 because the first draft of migration 0013 omitted the existing terms-acceptance metadata. Migration 0013 now preserves `terms_accepted_at` and `terms_version`; rerun pending. |
| `next build` | Skipped in run 37 after the unit-test failure; rerun pending. |
| Integration suite | Pending a successful app job and full rerun. |

## Current launch-readiness state

- PR #1 adds social-profile editing/display, platform-specific URL validation tests, a restricted public social-link RPC, per-recipient inquiry email retry tracking, fail-closed rate limiting, and Node.js 22 in CI and local version pinning.
- Migrations `0012_public_profile_social_links.sql` through `0016_investor_contacts_community_board.sql` must be applied before deploying the corresponding application code.
- PR #1 run 28 passed typecheck, ESLint, all 148 unit tests, the 12-file migration check, the production build and the full PostgreSQL 16 SQL suite. Its integration run confirmed the social-profile edit/display/privacy flows, username links, verification fixes and every axe accessibility route pass. One brittle homepage assertion matched the wrong “Featured” label; it has been corrected to target the actual featured-startups section and run 31 is validating that correction.
- The rate limiter now refuses protected requests if its database check fails; this favors security over availability during a database outage.

## Not verified (be aware)

- **Live Supabase and Resend** (Auth email delivery, Storage image uploads, real email delivery — inquiry, invitation, launch and community-reply emails still need real-inbox verification).
- **Real-browser behaviour** (JavaScript interactions, layout at 320–375 px, keyboard use). Contrast is verified by calculation, not by looking at rendered pages. The artwork was checked by rendering and viewing it. The full axe scan passed on all tested routes in run 28. Real-browser manual keyboard and responsive checks remain outstanding.
- Legal pages have **not** been reviewed by a lawyer.
- Vercel deployment, `npm audit` and production-service smoke tests remain outstanding. The current integration harness includes route, workflow, accessibility and response-time checks.

## Known limitations

- Admin screens for reports, startup review, user management, verification, categories, featured picks, settings and audit logs exist; production-role testing and a manual moderation review are still required.
- A CSP header exists, but production `script-src` still permits `unsafe-inline`; nonce-based hardening remains a security task.
- The favicon PR remains incomplete and must be resolved before treating brand assets as final.
- The current integration suite previously failed because its test identities were not fully onboarded; the review branch updates fixtures to satisfy the new required onboarding gate. A new CI run is still needed to prove the fix.
- The favicon PR remains incomplete and must be resolved before treating brand assets as final.
- The current integration suite previously failed because its test identities were not fully onboarded; the review branch updates fixtures to satisfy the new required onboarding gate. A new CI run is still needed to prove the fix.
- Minimum age (16) and governing-law wording in the legal pages are assumptions to confirm.

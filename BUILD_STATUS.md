# Buna — build status

_Last updated: end of Phase 4._

| # | Phase | Status |
|---|---|---|
| 1 | Foundation, schema + RLS, auth, onboarding, profiles | **Done** |
| 2 | Startups: directory, profiles, owner workspace, uploads, slug redirects | **Done** |
| 3 | Launches, locked voting, comments, follows, notifications, moderation | **Done** |
| 4 | Opportunities, founder & investor directories, inquiries, teams, account tools, legal pages, brand assets | **Done** (see "Not verified") |
| 5 | Full admin & moderation, verification, security review, accessibility, performance, e2e specs, deployment | In progress |

## Phase 4 — what exists

- **Opportunities** (`/opportunities`, `/opportunities/[slug]`): Open / closing soon / rolling / closed tabs, search, type and country filters, deadline sorting, pagination; save/unsave; closed listings labelled and never offered an Apply button; `/dashboard/saved`; deadline reminders (in-app, email only if opted in); staff management in `/admin/opportunities` (create, edit, publish, expire, archive, "checked today"; stale-listing flag; source link required to publish).
- **Founders** (`/founders`, `/founders/[username]`): opt-in directory with search, country, city, industry, expertise and "open to" filters; "open to" preference added to profiles.
- **Investors** (`/investors`, `/investors/[slug]`): published listings with stage/sector/country filters, verified vs not-verified labelling, explicit non-endorsement and no-brokerage notices; admin management (only admins can verify).
- **Inquiries:** contact form on every published startup (honeypot, rate limits, de-duplication), in-app + email notification to the team, `/dashboard/inquiries` with statuses, mark-read-on-open, reply-by-email link, delivery status and retry.
- **Teams:** `/dashboard/startup/[id]/team` — hashed single-use invitations by email (`/invite/[token]`), role changes and removals with escalation protection, last-owner protection, public-team visibility, leave team. **Analytics** tab with real counts only (no page-view tracking).
- **Account:** `/dashboard/settings` — data export (JSON) and permanent account deletion with ownership safeguards; richer dashboard overview.
- **Information pages:** About, Help (FAQ), Contact (stored inbox, `/admin/messages`), Terms, Privacy, Community Guidelines; terms acceptance recorded at signup.
- **Brand & imagery:** logo set, hero and eight empty-state illustrations (single source in `src/lib/art.ts`, exported to SVG/PNG by `npm run assets`), favicon, app icons, web manifest, generated 1200×630 share cards for site, startups, launches and opportunities.
- **Database:** migration 0010 (inquiry/contact functions, team invitation/role/removal functions, last-owner guard, account-deletion preparation, opportunity listing and reminders, founder view, terms columns).

## Verification — what was actually run

| Check | Result |
|---|---|
| `tsc --noEmit` (strict), `next lint` (0 warnings) | Pass |
| 143 unit tests (adds opportunity/founder/investor params, deadline logic, network schemas, art output safety, **WCAG contrast over every colour pair**) | Pass |
| `next build` | Pass |
| 10 migrations on PostgreSQL 16 + 4 SQL suites (Phase 4: terms, founder visibility, opportunity listing/expiry/reminders, inquiries, team invitations and role rules, last-owner guard, contact inbox, account-deletion preparation) | Pass |
| Integration harness — **397 checks** (ran twice): public pages, filters and pagination for every list, real form submissions for every action, forged requests from non-members, unverified and suspended users, the account-deletion flow end to end (password re-check, blockers, cascade, audit), data export, generated PNG share cards, icons and manifest, sitemap contents | Pass |

## Not verified (be aware)

- **Live Supabase and Resend** (Auth emails, Storage uploads, real email delivery — the inquiry/invitation emails go through the same untested Resend call).
- **Real-browser behaviour** (JavaScript interactions, layout at 320–375 px, keyboard use). Contrast is verified by calculation, not by looking at rendered pages. The artwork was checked by rendering and viewing it.
- Legal pages have **not** been reviewed by a lawyer.
- Playwright tests, Vercel deployment, `npm audit`, performance measurement: Phase 5.

## Known limitations

- Reports, startup review, user management, verification, categories, featured picks, settings and the audit log have no admin screens yet (Phase 5).
- No CSP header yet (Phase 5).
- Minimum age (16) and governing-law wording in the legal pages are assumptions to confirm.

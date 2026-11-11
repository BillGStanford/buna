# Buna — V1 build and release status

_Last reviewed: 2026-11-10 against `main`._

## Product implementation

The following product areas are present in the current `main` branch:

- Public startup discovery, startup profiles, founder profiles and social links.
- Founder onboarding, startup drafts, products, links, media uploads, public publishing and team management.
- Product launches, daily launch competition, voting, comments, moderation and maker dashboards.
- Opportunities, saved opportunities and deadline reminders.
- Community discussion board, categories, replies, subscriptions and moderation.
- Personalized activity feed, follows, notifications and referral attribution/rewards.
- Investor directory and applications, individual and organization investor identities, investor deal flow, pipeline, saved searches, comparisons, data rooms, investor analytics and investor team membership.
- Admin/moderator workspaces, audit logs, account export/deletion, Terms, Privacy Policy, Guidelines, Help and Contact.
- Resend API delivery for app-generated transactional notifications and inquiries; Supabase Auth custom SMTP can deliver Auth emails through Resend.

## Automated validation on current main

Current main commit: `642450c9f75c2e755fa8ab6f2378c06f42edbff6`.

| Check | Latest main workflow |
|---|---|
| TypeScript typecheck | Pass |
| ESLint | Pass |
| Unit tests | Pass |
| Migration consistency | Pass |
| Production build | Pass |
| PostgreSQL migrations and RLS suite (including investor Phase 8) | Pass |
| Full integration suite | **Fail — release blocker** |

The latest CI run is [42916537408](https://github.com/BillGStanford/buna/actions/runs/42916537408). The integration log reports failures around the health endpoint, launch filters/search, voting, comments, analytics, admin settings and CSP nonce assertions. These cannot be dismissed as unrelated without investigation: some may be stale fixtures/assertions, but the launch and health paths must be verified against a running app. Re-run the suite after each correction and require a green integration job before release.

## Specific product gaps to close before V1

1. Resolve the integration-suite failures and verify the affected user journeys.
2. Investor membership currently stores one role per member (`investor_memberships.role`). If V1 requires a single person to hold multiple simultaneous roles, that is not yet implemented; the schema, permissions, application form and team UI need a multi-role model.
3. Complete and verify the branded Supabase Auth email template set and route Auth delivery through Resend custom SMTP.
4. Refresh operational documentation and run the ordered production checklist in `docs/V1_LAUNCH_CHECKLIST.md`.

## Production work not completed by repository code

These require the operator's accounts and actions:

- Purchase the final Buna domain and configure Vercel website DNS/HTTPS.
- Verify the sending domain in Resend; publish its SPF/DKIM/DMARC records.
- Configure Resend API and Supabase custom SMTP; install Auth and security notification templates; test real delivery and inbound support replies.
- Reconcile the production Supabase migration history and apply any outstanding migrations through `0025`. Never blindly replay SQL or manually mark migrations applied when the remote history/schema disagree.
- Configure Vercel production environment variables, canonical site URL and cron secret; deploy from `main`.
- Verify production health, storage access, authentication, notifications, investor and founder flows, scheduled jobs, security headers and rollback.
- Confirm operator identity, support contact, minimum age and governing-law language; obtain legal review.
- Create/verify admin and moderator accounts, establish moderation coverage, remove demo data and complete browser/mobile/keyboard testing.

## Release rule

Buna is **feature-implemented but not production-launch-approved** until the integration suite passes on the release commit and all production-service, email, domain, legal, security and manual acceptance checks are completed.

# Buna

> Discover African startups. Build connections. Grow together.

Buna is a home for African technology startups and founders — startup profiles, Product Hunt-style
launches, opportunities, a founder directory, structured community discussions and direct inquiries — starting in Ethiopia.

**Stack:** Next.js 15 (App Router) · TypeScript (strict) · Tailwind CSS · Supabase (Auth, Postgres, Storage) · Resend · Vercel · Zod · Vitest.

**Status:** Buna V1 product workflows are implemented in `main`, including startup discovery, launches, founder and investor networks, opportunities, community discussions, referrals, investor deal flow and investor teams. Production launch remains gated on the integration suite, live-service configuration, email delivery, domain/DNS, security/legal review and end-to-end smoke testing. See [`docs/V1_LAUNCH_CHECKLIST.md`](./docs/V1_LAUNCH_CHECKLIST.md) for the ordered launch process.

---

## 1. Prerequisites

- Node.js 22+ (`.nvmrc` pins 22) and npm
- A [Supabase](https://supabase.com) project
- The [Supabase CLI](https://supabase.com/docs/guides/cli) (recommended) — or use the SQL editor
- A [Resend](https://resend.com) account with a verified sending domain (needed for emails)
- A [Vercel](https://vercel.com) account for deployment

## 2. Set up Supabase

### 2.1 Apply the database

All schema, row-level-security policies, storage buckets and reference data live in `supabase/migrations/` (25 files, applied in numeric order).

```bash
supabase login
supabase link --project-ref YOUR-PROJECT-REF
supabase db push
```

No CLI? Open **SQL Editor** and run each file in `supabase/migrations/` in numeric order (`0001` → `0025`).

### 2.2 Configure authentication (Authentication → …)

| Setting | Value |
|---|---|
| Providers → Email | Enabled, **Confirm email = ON** for production so account ownership is verified |
| URL Configuration → Site URL | Your production URL (and `http://localhost:3000` for local dev) |
| URL Configuration → Redirect URLs | `http://localhost:3000/**` and `https://YOUR-DOMAIN/**` |
| Password → Minimum length | 10 |
| Password → Secure password change | ON (recommended) |
| Email Templates → Confirm signup | Paste `supabase/templates/confirm-signup.html` |
| Email Templates → Reset password | Paste `supabase/templates/reset-password.html` |

With Confirm email ON, signup creates a pending account and the member follows the verification link before entering the protected onboarding flow. The application handles the redirect and token verification at `/auth/confirm`. Keep confirmation enabled in production.

### 2.3 Send auth emails through Resend

Supabase Auth remains responsible for issuing secure, single-use authentication tokens and composing its Auth messages; **Resend delivers those messages** through custom SMTP. This avoids Supabase's built-in test mailer and gives Buna production delivery. In **Authentication → SMTP Settings** enable custom SMTP:

- Host `smtp.resend.com`, port `465`
- Username `resend`, password = your Resend API key
- Sender: an address on your verified Resend domain (for example, `accounts@YOUR-DOMAIN`)\n\nThe app's own transactional notifications and inquiry emails use the Resend API (`RESEND_API_KEY` + `EMAIL_FROM`). Supabase Auth emails use the same Resend account over SMTP. Do not try to send Auth verification/reset emails directly from the Next.js app: Supabase must create and validate those tokens.

### 2.4 Storage

Migration `0006` creates three buckets: `avatars` (public, 2 MB), `startup-media` (public, 5 MB) and `verification-docs` (private, 10 MB). Migration `0009` creates `launch-media` for launch logos and screenshots. The migrations create and secure these buckets; do not create them manually.

See [`docs/V1_LAUNCH_CHECKLIST.md`](./docs/V1_LAUNCH_CHECKLIST.md) for the exact template-to-dashboard mapping, DNS/domain setup, production environment variables and the ordered live smoke test.\n\n## 3. Run locally

```bash
cp .env.example .env.local     # fill in the values (see comments in the file)
npm ci
npm run dev                    # http://localhost:3000
```

Health check (configuration + database connectivity, no secrets): `GET /api/health`.

The site renders and fails gracefully with no environment variables set — pages load, and sign-in shows a clear "not connected" message.

## 4. Quality checks

```bash
npm run typecheck      # tsc --noEmit (strict)
npm run lint           # next lint
npm test               # unit tests (Vitest)
npm run db:check       # static migration checks
npm run db:test        # applies migrations to a local Postgres and runs the RLS test suite (needs psql + a superuser connection)
npm run assets         # regenerate static brand assets
npm run test:integration  # optional: real Postgres + PostgREST + the production server (see below)
npm run check          # typecheck + lint + test + db:check
npm run build          # production build
```

`db:test` uses `supabase/tests/local_stub.sql` to emulate Supabase's `auth`/`storage` schemas on plain Postgres. It never touches a real project. CI runs it against a Postgres service container (`.github/workflows/ci.yml`).

### Integration check (no Supabase account needed)

`npm run test:integration` starts a throwaway Postgres database with every migration and the demo data, puts a real
[PostgREST](https://postgrest.org) in front of it, runs the production Next.js server against that, and then:

- loads the public pages and asserts on search, filters, sorting, pagination, profiles, redirects, 404s and the sitemap;
- loads the signed-in workspace as an owner, moderator, voter and stranger (using locally signed session cookies);
- checks the public community discussion routes and fixed categories;
- **submits the real forms** (create, edit, products, links, publish, slug change, report, delete, vote, comment, reply, edit and delete comments, submit and moderate launches, follow, notifications, cron) the way a browser does and
  checks the database afterwards, including that forged requests from strangers, unverified and suspended users change nothing.

Requirements: `psql` with a superuser connection (`PGHOST/PGUSER/PGPASSWORD`), a PostgREST binary (`POSTGREST_BIN=/path/to/postgrest`) and a prior `npm run build`.
It does **not** cover Supabase Auth, Storage uploads or email — those need your real project (use the smoke checklist). CI runs it automatically.

### Referrals, community discussions, launches, notifications and scheduled jobs

- **Referrals** (`/dashboard/referrals`): every profile receives a permanent referral code and shareable `/signup?ref=CODE` link. A referral is counted only when a new account is successfully created; attribution is server-side, one-per-account, and self-referrals are rejected. Each successful signup earns 100 points. Milestones: 3 referrals = Founding Supporter badge; 5 = Founder Circle early-access/spotlight eligibility; 10 = Community Builder roundtable eligibility. Points are recognition credits, not cash. Apply migration `0018_referral_growth_loop.sql` after `0017`.

- **Investor deal flow** (`/dashboard/investor/discover`, `/pipeline`, `/searches`, `/compare`, `/data-rooms`): advanced startup discovery filters, investor-thesis saved searches with in-app match alerts, a five-stage private deal pipeline, side-by-side company comparisons, private document-room access requests and approvals, and incoming founder-interest analytics. Startup owners manage confidential files and post investor updates at `/dashboard/startup/[id]/fundraising`. Apply migration `0020_investor_dealflow_platform.sql` after `0019`.
- **Investment-ready startup profiles**: founders can publish problem, solution, customer segments, target geographies, market opportunity, business model and fundraising round/status/target. These structured fields power investor search and comparison.

- **Notifications** are configured in code for referral signups and referral milestones, using Buna’s existing in-app notification and email outbox pipeline. Set `RESEND_API_KEY`, `EMAIL_FROM`, and Supabase custom SMTP as described above to enable delivery.

### Community discussions, launches, notifications and scheduled jobs

- **Community board** (`/community`) is separate from the personalized activity feed and launch comments. It has five fixed categories (Founder Networking, Hiring & Talent, Investor Questions, Legal & Registration, Feedback), one-level replies, per-thread reply subscriptions, in-app notifications and queued email notifications when the member's reply-email preference allows. Staff can hide, restore or remove threads and individual replies at `/admin/community`.
- **Investor contact routes:** investor applications must include at least one direct contact route (email, phone, WhatsApp, Telegram, Facebook or another URL). These details remain private to the applicant, account owner and authorized staff; they are not exposed in the public investor directory.


- **Moderation.** New launches wait for a moderator (`platform_settings.launches_require_review = true`). Moderators work in **`/admin/launches`**: approve, send back with a note, feature, or remove. Every decision notifies the maker and is written to the audit log.
- **Trending** = the sum over a launch's votes of `0.5 ^ (hours since the vote / 24)`: a vote loses half its weight every 24 hours. Ties break on lifetime votes, then recency. The SQL is documented in `supabase/migrations/0009_launches.sql` (`list_launches`).
- **Votes are final** — there is no way to remove or change one (no UPDATE/DELETE path exists in the database).
- **Notifications** are rows in `public.notifications`. If the recipient's preference allows email, the row is also queued; queued emails are sent through **Resend** right after the action (Next.js `after()`) and retried by the daily job (up to 5 attempts). Without `RESEND_API_KEY` + `EMAIL_FROM` the in-app notification still appears and the email is recorded as `not_configured` — never as sent.
- **Daily job** — `GET /api/cron/daily` (configured in `vercel.json`, 06:00 UTC) publishes scheduled launches whose date has arrived, retries notification emails and prunes rate-limit rows. It requires `Authorization: Bearer $CRON_SECRET` (Vercel sends this automatically when `CRON_SECRET` is set; the route refuses all calls if it is not). Vercel's Hobby plan limits crons to once per day, which is what is configured.
- **Moderators:** promote an account the same way as the first administrator, with `'moderator'` instead of `'admin'`.

### Before you launch publicly (legal and operator details)

- Set `NEXT_PUBLIC_OPERATOR_NAME` (the person or company that runs the site) and, optionally, `SUPPORT_EMAIL`. They appear in the Terms, Privacy Policy and contact page.
- **Have a lawyer review `/terms`, `/privacy` and `/guidelines`.** They describe how Buna actually works today (data collected, processors, retention, deletion) but they are not legal advice and make no compliance claims. Two assumptions in them are yours to confirm: the **minimum age (16)** and the **governing-law wording**.
- Bump `TERMS_VERSION` in `src/config/site.ts` whenever you change them materially; each account records the version it accepted at signup.

### Brand assets

Artwork lives in one place, `src/lib/art.ts`: the logo, hero illustration and eight empty-state illustrations render as themeable inline SVG in the app. `npm run assets` regenerates the static files from it — `public/logo*.svg`, `public/illustrations/*.svg`, app icons (`public/icons/*.png`), `src/app/apple-icon.png`, `src/app/favicon.ico` and the previews in `docs/brand/`. Social-share cards (1200×630) for the site, startups, launches and opportunities are generated on demand by `src/lib/og.tsx`.

## 5. Demo data (local and preview only)

```bash
export DATABASE_URL="postgresql://postgres:…@db.YOUR-REF.supabase.co:5432/postgres"   # a NON-production database
npm run demo:seed     # 8 fictional "(Demo)" startups and 6 demo launches (zero votes, zero comments), flagged is_demo, labelled with a Demo badge, kept out of the sitemap
npm run demo:clear    # removes every demo row
```

The seed script refuses to run unless `-v allow_demo=1` is passed (the npm script passes it — so only run it against a database you chose on purpose) and never claims a verification status. Never run it against production.

## 6. Create the first administrator

Roles can only be changed server-side — a browser can never promote itself (the `role` column is not writable by clients). To create the first admin:

1. Sign up normally and confirm your email.
2. In the Supabase **SQL Editor** (runs as the privileged `postgres` role), run:

```sql
update public.profiles
   set role = 'admin'
 where id = (select id from auth.users where email = 'you@example.com');
```

Use `'moderator'` for moderators. Admin and moderator accounts see an **Admin** entry in their account menu.

## 7. Deploy to Vercel

1. Push the repo to GitHub and import it in Vercel (framework: Next.js; defaults are correct).
2. Add every variable from `.env.example` in **Settings → Environment Variables** (Production and Preview).
3. Set `NEXT_PUBLIC_SITE_URL` to the production origin, add the domain in **Settings → Domains** (HTTPS is automatic).
4. Add the production URL to Supabase **Redirect URLs** (step 2.2).
5. Deploy, then run the smoke checklist below.

**Rollback:** in Vercel, open Deployments and promote the previous deployment. Database changes are forward-only; write a new migration to revert one, and take a Supabase backup (Database → Backups) before applying risky migrations.

### Production smoke checklist

- [ ] `GET /api/health` → `200` with `database: "ok"` and `supabase_configured`, `service_role_configured` and `email_configured` true
- [ ] Sign up with a real inbox; receive the Buna-branded verification email through Resend; verify once; complete onboarding; confirm country, member type and Buna goal appear on the profile
- [ ] Sign out, sign in, then use *Forgot password* end to end
- [ ] Complete onboarding; upload an avatar; confirm it shows in the header menu
- [ ] Create a startup, upload a logo and a screenshot, add a product and a link, open the preview, then publish it
- [ ] The published page loads while signed out, appears in `/startups`, and is listed in `/sitemap.xml`
- [ ] Rename the startup's public address; the old address redirects (HTTP 308)
- [ ] Contact a startup from its public page; the team gets an in-app notification and an email (reply-to is the sender)
- [ ] Invite a second account to a startup's team, accept it from the email link, then remove them
- [ ] Save an opportunity; download your data from Settings; delete a throw-away account
- [ ] Paste a startup URL into a chat app or social card validator: the generated social image appears
- [ ] Promote a second test account to `moderator`; submit a launch with the first, approve it in `/admin/launches`, confirm the notification email arrives
- [ ] Vote and comment from a third account; confirm the maker gets a comment notification (in-app and by email)
- [ ] Submit an Investor Mode application with one contact route (email, phone, WhatsApp, Telegram, Facebook or another URL); approve it as staff and confirm the contact routes are saved privately to the investor account
- [ ] Create a community discussion in each category; reply from another account; subscribe a third account; confirm the author and subscriber receive in-app notifications and opted-in reply emails
- [ ] Hide a community reply and a whole discussion in `/admin/community`; confirm anonymous visitors cannot see either, then restore them
- [ ] `curl -H "Authorization: Bearer $CRON_SECRET" https://YOUR-DOMAIN/api/cron/daily` returns 200; without the header it returns 401
- [ ] Signed out, `/dashboard` redirects to `/login?next=/dashboard`
- [ ] A normal user opening `/admin` gets *403*
- [ ] `robots.txt` and `sitemap.xml` load; security headers present (`curl -I`)

## 8. Project layout

```
src/app/            routes (App Router) — (auth)/, startups/, launches/, opportunities/, community/, founders/, investors/, users/, invite/[token], about|help|contact|privacy|terms|guidelines, dashboard/ (startup/[id] incl. team + analytics, launches/[id], inquiries, saved, settings, notifications, following), onboarding/, admin/ (launches, opportunities, investors, messages), api/health, api/cron/daily, auth/confirm, admin/community
src/components/     ui/ (design system), layout/, forms/, auth/, dashboard/
src/lib/            env, permissions, validation (zod), supabase clients, rate-limit, audit, email, uploads, slug, geo, startups/, launches/ (queries, params, comment tree), notifications/ (dispatch, queries), social/
src/config/site.ts  site info + navigation map (a link appears only once its route exists)
supabase/migrations schema, RLS, storage, reference data
supabase/tests      local SQL harness + RLS test suite
supabase/demo       fictional demo data (seed / clear)
scripts/integration PostgREST-backed integration harness
supabase/templates  branded Supabase Auth and security notification templates (delivered through Resend SMTP)
docs/DECISIONS.md   product and architecture decisions, including ones that need your input
```

## 9. Security model in one paragraph

Authorization is enforced by Postgres: every table has row-level security, privileges are deny-by-default (even for tables added later), and column-level grants stop clients from writing privileged columns (`role`, `status`, `verification_status`, vote counts…). Publishing goes through a `SECURITY DEFINER` function that checks ownership, suspension and email verification. Votes are insert-only with a primary key of `(launch_id, user_id)`. The service-role key is server-only (`import "server-only"`) and used only after explicit authorization checks. Redirect targets are validated, uploads are verified by magic bytes, and auth endpoints are rate-limited.

## 10. Account data and deletion

Deleting an auth user cascades to their profile, votes, follows and notifications, but **not** to companies: `startups.created_by` is set to null and memberships remain, so shared company records survive a founder leaving. The full deletion flow (ownership transfer, retention rules, data export) is built in phase 4 — see `docs/DECISIONS.md`.

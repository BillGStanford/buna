# Decisions

## Decided by you
- **Name:** Buna is final.
- **Stack:** Next.js + Supabase + Vercel; Resend for email.
- **Voting:** locked once cast — no removal, no change. Implemented as insert-only (`launch_votes` has no UPDATE/DELETE grant).

## Needs your decision (defaults are in place and easy to change)
1. **Do new startups publish immediately or wait for review?**
   Default: *publish immediately* for owners with a verified email and a complete profile (`platform_settings.startups_require_review = false`). Flip to `true` to route every startup through moderation. Trade-off: speed and low founder friction vs. spam risk in a young directory.
2. **Do launches always need moderator approval?**
   Default: *yes* (`launches_require_review = true`) — matches your spec that submissions must not appear approved by default.
3. **Can owners edit a launch after it is approved?**
   Default: *yes, without re-review* (typo fixes). Risk: a bait-and-switch after approval. Alternative: re-queue on substantive edits (phase 3).
4. **Terms/community-guidelines acceptance at signup.** Not in phase 1 because the legal pages do not exist yet (phase 4). **They must exist before public launch.**
5. **Account deletion:** proposed rule — deleting an account never deletes a company; a sole owner must transfer ownership or the company is unpublished. Needs your confirmation before phase 4.
6. **Who may create startups?** Any verified user can create startups (no cap). Consider a per-user cap if abuse appears.

## Phase 2 additions
- **Startup workspace route shape.** The original route list had a single `/dashboard/startup/*`. Phase 2 uses `/dashboard/startup` (list) and `/dashboard/startup/[id]/…` so one person can run several startups and later phases (team, launches, analytics, inquiries) add tabs under `[id]`. Nothing the spec requires is lost.
- **Preview** is the public URL itself: team members see their draft at `/startups/<slug>` with a "Preview" banner and `noindex`; everyone else gets a real 404.
- **Directory search** = substring match on name OR full-text match (English) over name, tagline and description. Sorting offers recently added, featured first, and name; relevance ranking is not offered because PostgREST cannot order by `ts_rank` (revisit in phase 5 with an RPC if search quality matters).
- **Deleting a startup** is only possible while it has never been published (owner, draft). After that, unpublish instead. Full deletion with ownership rules comes with account deletion in phase 4.
- **Child limits** (12 products, 10 links, 6 screenshots) are enforced by database triggers, not just the UI.
- **No `loading.tsx` on `/startups/[slug]` or the workspace.** A loading boundary makes Next send HTTP 200 before `notFound()`/`redirect()` run, which would turn missing profiles into soft 404s and old-slug redirects into client-side redirects. Only the directory list keeps a skeleton (its out-of-range redirect is client-side and `noindex`).
- **Demo data** is flagged `is_demo`, labelled in the UI, `noindex`, and excluded from the sitemap.
- **Sitemap** is generated per request from published, non-demo startups.

## Phase 3 additions
- **Trending algorithm:** `score = Σ 0.5^(age_hours / 24)` over a launch's votes (half-life 24 h), ties on lifetime votes then recency. Chosen so a launch must keep earning votes to stay on top; a raw lifetime total cannot hold the top spot. The half-life is one constant in `list_launches` if you want faster or slower decay.
- **Votes are final** (your decision). Consequence: a mistaken vote can't be undone; the UI says "Votes are final" on success. Self-voting is currently allowed (makers may vote for their own launch). Say if you want that blocked.
- **Scheduling:** approval of a launch with a future launch date makes it *Upcoming* (public, no voting or comments); the daily job publishes it on its date. Approval without a date publishes immediately.
- **Moderation lives in the database** (`moderate_launch`): role check, state-machine check, maker notification and audit entry happen in one transaction. Moderators and admins can both approve, reject, feature and remove.
- **Comments:** one level of replies (a reply to a reply is rejected by a trigger); authors can edit and delete their own; deleting keeps a placeholder when replies exist so threads still read correctly. Comment *moderation* (hide/restore) and the reports queue UI arrive in phase 5 — until then reports are stored but staff have no screen for them.
- **Notifications are an outbox:** a row per event (de-duplicated by key), an email is queued only if the recipient's preference allows it, and delivery outcomes are recorded (`sent`, `failed` with retry, `not_configured`). Email delivery internals are not readable by users (column-level grants).
- **Notification email timing:** sent right after the action with Next.js `after()`, plus a daily retry. Vercel Hobby crons run at most daily; upgrade the plan or add an external pinger if you want faster retries.
- **Launch routes:** makers manage launches at `/dashboard/launches/[id]` (the original spec grouped them under `/dashboard/startup/launches`; a launch can exist without a startup, so it has its own area).
- **Reports** are one generalised action for startups, launches, comments and users; one report per person per target.
- **Private profiles:** `/users/[username]` shows only name, username and photo unless the member made the profile public; those pages are `noindex`.
- **Needs your decision:** (a) should makers be blocked from voting for their own launch? (b) should substantive edits to an approved launch send it back for review (currently they don't)? (c) should email notifications be on by default for new accounts (currently yes)?

## Phase 4 additions
- **Opportunities are never presented as open when they aren't.** "Open" is computed from the deadline at query time (`list_opportunities`), so a listing whose deadline has passed is shown as closed even before the nightly job flips its status. Every listing links to its source, shows when it was last checked, and carries a disclaimer. Publishing requires a source link.
- **Who manages opportunities and investors:** moderators and admins can create and edit; only admins can change an investor's verification status.
- **Founder directory is opt-in and layered:** public profile → "list me" → what I'm open to. Nothing contact-related is ever exposed; people are reached through their startup's contact form.
- **Inquiries:** visitors can write to a published startup. The server stores the message through a service-role function (no public write access), protected by a honeypot, per-IP/email/startup rate limits, a link cap and 24-hour de-duplication. The team gets an in-app notification and an email with the sender as reply-to; delivery status is recorded and retryable. Replies happen in the team's own mailbox — Buna does not host conversations.
- **Rate-limit keys are hashed** (IPs and emails never reach the database in clear text).
- **Teams:** invitations are single-use, expire after 7 days, store only a hash of the token, and can only be accepted by a signed-in, email-verified user whose address matches the invitation. Owners can invite admins/editors/viewers; admins can invite editors/viewers; nobody can invite an owner (an existing owner can promote). A startup always keeps at least one owner (database trigger). Members decide whether they appear on the public team.
- **Account deletion** (typed username + password re-check): blocked while you are the only owner of a startup with other members; otherwise memberships are removed, comments deleted, startup-less launches removed, inquiries anonymised, a startup you ran alone is unpublished and kept unowned, then the auth user is deleted (cascading votes, follows, saved items and notifications). **Decision for you:** whether an orphaned solo startup should instead be purged automatically after N days.
- **Data export** returns the signed-in person's own data as JSON; it is rate-limited and never includes anyone else's.
- **Terms acceptance** is required at signup and recorded server-side (version + time) from the signup metadata.
- **Legal pages are drafts that match the product** — they must be reviewed by a lawyer before launch. Assumptions to confirm: **minimum age 16**, governing-law wording, retention periods.
- **Contact inbox:** messages to the Buna team are stored and read in `/admin/messages`; `SUPPORT_EMAIL` optionally forwards them.
- **Visual system:** one art source (`src/lib/art.ts`) drives the in-app illustrations and the exported files; share cards are generated, text-only (no remote images), so they're fast and never depend on user uploads.
- **Contrast:** a unit test checks every text/background token pair against WCAG AA (4.5:1). It caught amber warning text at 3.6:1, so warnings now use a darker `warning-text` token.

## Architecture decisions
- **Authorization lives in the database** (RLS + column grants + definer functions), with app code mirroring it for UX. App checks are never the only gate.
- **Deny-by-default grants:** `alter default privileges … revoke all` means a table added later is inaccessible until explicitly granted.
- **Pages render per request** (`dynamic = "force-dynamic"` in the root layout): the header is user-aware and private pages must never be prerendered. Phase 5 can introduce targeted caching for public directory pages.
- **Rate limiting** is a Postgres fixed-window counter (`check_rate_limit`, service role only) — no extra infrastructure. Database errors fail open (logged); missing configuration fails closed in production.
- **Placeholder usernames** (`user-xxxxxxxxxx`) are generated at signup and reserved; users choose their own in onboarding.
- **Reference data** (sectors, default settings) ships as a migration, not seed data, because production needs it. Demo data (phase 2) will be a separate, clearly flagged script that is never run in production.
- **No generated DB types yet:** run `npm run db:types` after linking the Supabase CLI to replace the hand-written `Profile` and `Category` types.
- **Language/currency expansion:** countries are ISO codes in the database; UI strings are English-only for now. Localisation (Amharic) is outside the five phases and will need an i18n layer.

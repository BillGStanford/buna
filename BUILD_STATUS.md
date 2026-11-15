# Buna build status

Last reviewed: 2026-11-15
Repository: BillGStanford/buna
Current baseline: main, including PR #30 (progressive company intelligence) and PR #31 (investor admin form integration fix).

## Implemented product capabilities

Buna currently includes startup discovery and launches, founder and investor directories, Investor Mode deal flow, investor teams, saved searches, pipeline management, startup comparisons, data-room access requests, founder introductions, community discussions, referrals, opportunities, and Co-Founder Discovery.

The progressive company-intelligence foundation adds:

- Optional company operating metrics with reporting periods and visibility controls.
- Historical funding-round records.
- Founder-submitted company claims and evidence URLs.
- Provenance statuses that distinguish founder-reported, verified, publicly reported, estimated, disputed, and undisclosed information.
- Staff review queues and review notes for claims, operating metrics, and funding rounds.
- Optional founder career history with private, investor-visible, or public disclosure.
- Public company profile sections and investor-visible traction summaries.
- Investor discovery pagination.
- A public ecosystem overview with company counts and country/sector breakdowns.
- A staff source registry and manual source-record staging/review queue.
- Contextual, deduplicated in-app enrichment prompts at profile milestones.
- Removal of stale Buna Work payment webhook, notification preference, and admin navigation references.

**Publishing remains lightweight:** none of the new company metrics, funding history, claims, evidence, or founder history fields is required to create or publish a startup. The new information is encouraged progressively, not imposed as a gate.

## Automated validation

- PR #30 main-branch CI run: typecheck, ESLint, unit tests, migration checks, production build, SQL/RLS tests, and integration suite passed on the merged main baseline.
- PR #31 full CI run: typecheck, ESLint, unit tests, migration checks, production build, SQL/RLS tests, and integration suite all passed.
- Phase 10 SQL tests cover optional metric submission, founder self-verification prevention, reviewer-metadata protection, public/private visibility, and negative growth percentages.
- The migration checker explicitly allows only the reviewed historical Work-removal migration (0029) to contain DROP TABLE; other table drops remain blocked.

## Production verification still required

The GitHub changes do not prove that live services are configured or that production migrations have been applied.

Before production release:

1. Inspect the linked Supabase project's migration history and compare it with migrations 0033–0037.
2. Back up production and apply migrations only after resolving any existing schema drift.
3. Verify Supabase Auth, RLS, private Storage, and signed-document access in the live project.
4. Verify Vercel environment variables and production build.
5. Verify in-app notifications and email delivery with real accounts.
6. Run authenticated founder, investor, and staff smoke tests against production.
7. Monitor errors and query performance after deployment.

## Remaining intelligence-platform work

The current release establishes the company-intelligence data foundation and manual source-review workflow. It does **not** yet constitute a complete African business-data acquisition network. The next substantial engineering stages are:

- Automated, source-specific ingestion adapters and scheduled workers for approved public datasets, registries, and licensed providers. These require selected sources, lawful access, and any necessary credentials or licences.
- Explainable investor matching and advanced filtering directly on revenue, customer, growth, and historical funding metrics, including saved-search alerts when those metrics change.
- Per-document data-room grants, expiry, revocation, and document-level audit controls.
- Deeper ecosystem time-series analytics, funding-flow analysis, data coverage measures, and country/sector methodology.
- Broader founder-history editing and verification workflows.

Do not describe Buna's current company records as a complete census of African startups. Public analytics must state coverage, provenance, and freshness.

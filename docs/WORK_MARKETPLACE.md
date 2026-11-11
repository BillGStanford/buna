# Buna Work V1

Buna Work is a secondary freelance marketplace inside Buna. Members use their existing Buna account as both a professional identity and a marketplace account.

## V1 workflows

- Public marketplace: /work, /work/projects, /work/talent, project details and public freelancer profiles.
- Freelancer: publish a skills/portfolio profile, receive project invitations, submit proposals, submit private deliverables, message the client, configure a Chapa payout destination and receive verified settlement.
- Employer: publish a fixed-price project (optionally linked to a Buna startup), search talent, invite people, review/shortlist proposals, hire one freelancer and manage the contract.
- Contract: agreed scope and total, one V1 delivery milestone, private messages/files, revision requests, approval, payment record, dispute and mutual reviews.
- Staff: report queue, project pause/closure and dispute resolution at /admin/work.

## Deliberate V1 boundaries

- Fixed-price projects only. Hourly-rate profile data is indicative; hourly contracts, time sheets and automatic hourly billing are not implemented.
- ETB checkout and Ethiopian Chapa payout destinations only. Other currencies/countries must not be advertised as supported until separately tested and approved.
- The employer pays after approving a deliverable. Chapa split settlement sends the configured freelancer share to their Chapa subaccount and the remaining platform share to Buna. This is not escrow; Buna does not hold funds pending approval.
- The default Buna platform commission is 10%, configurable as a whole percentage with BUNA_WORK_PLATFORM_FEE_PERCENT (0–99). The Chapa split rule uses the platform commission as a fractional percentage (for example, 10% is sent as 0.10); the freelancer subaccount receives the remainder before provider fees. Confirm the commercial rate and Chapa's fee/settlement terms before live launch.
- No automatic refunds, escrow, cross-border tax withholding, hourly time tracking or dispute arbitration by a payment provider. Staff dispute resolution is an internal moderation record, not a legal or financial guarantee.

## Payment lifecycle

1. Freelancer connects an eligible bank or mobile-money destination. The browser sends the account number to the server over HTTPS; the server creates a Chapa subaccount and stores only its reference, bank name/slug and last four digits. Buna does not persist the full account number.
2. Employer hires a proposal. The database creates a contract and one delivery milestone.
3. Freelancer submits a private file to the work-deliverables Supabase Storage bucket or an external deliverable URL.
4. Employer approves the deliverable or requests a revision.
5. After approval, employer starts Chapa hosted checkout. The server records a unique pending payment attempt and initializes a split payment with a stable idempotency key.
6. Chapa redirects to the return route and sends a signed webhook. Neither signal alone marks the milestone paid.
7. Buna verifies the transaction with Chapa's V2 verification API, matching the merchant reference, amount and currency. A service-role-only database function atomically marks the payment successful, milestone paid and contract complete.
8. Duplicate webhook/return events are safe to retry. A failed or cancelled payment can be retried; only one pending checkout is allowed per milestone.

Official provider references:
- Hosted checkout and payment verification: https://docs.chapa.global/docs/v2/integrations/accept-payment
- Split payments and subaccounts: https://docs.chapa.global/docs/v2/integrations/split-payment
- Payout bank directory: https://docs.chapa.global/docs/v2/payouts/bank-list
- Webhook signature verification: https://docs.chapa.global/docs/v2/integrations/webhooks

## Required server environment

~~~dotenv
CHAPA_PRIVATE_KEY=
CHAPA_WEBHOOK_SECRET=
BUNA_WORK_PLATFORM_FEE_PERCENT=10
BUNA_WORK_CHAPA_SPLIT_ENABLED=false
~~~

Keep both Chapa secrets server-only. Never add a NEXT_PUBLIC_ prefix or expose either value in client code. Keep BUNA_WORK_CHAPA_SPLIT_ENABLED=false until Chapa confirms the V2 subaccount creation/split contract for Buna and the merchant account is approved. The app blocks payout-account setup and employer checkout unless this explicit server-side switch is true. Chapa's published subaccount guidance notes that API-created subaccounts may require live mode, so do not assume test keys can exercise this part of the flow.

Configure the Chapa V2 payment webhook to call:

https://YOUR-PRODUCTION-DOMAIN/api/webhooks/chapa

Use the matching webhook secret in CHAPA_WEBHOOK_SECRET. The endpoint verifies x-chapa-signature as HMAC-SHA256 over the exact raw request body, then independently verifies successful payments with Chapa.

## Database and access controls

Migrations 0027_work_marketplace.sql and 0028_work_visibility_and_reply_notifications.sql create the marketplace schema, policies, RPCs, private storage bucket and final profile-visibility/reply-notification fixes. Apply both in numeric order before deploying the Work routes. supabase/tests/rls_phase10_work.sql covers freelancer profiles, public project visibility, proposal/hiring, contract isolation, private file storage, milestones, Chapa payment finalization, reviews and invitations.

Work profile visibility requires the member's existing Buna public profile to be public. A freelancer can still use their Work dashboard when their public profile is private, but will not appear in the public talent directory until they enable public profile visibility.

## Before enabling live payments

Use Chapa test mode first. Confirm merchant eligibility for marketplace split settlement, subaccount creation and the actual payout destinations available to Buna's users. Verify that the agreed commission split, processing fees, refunds, chargebacks, payout timing and settlement currency are documented with Chapa. Only then use live credentials. A successful API initialization response is not proof of a completed payment.

# Buna V1 launch checklist

This is the operator runbook for taking the current Buna V1 codebase from GitHub to a verified public launch. Complete the steps in order. Do not skip production verification because a local build passes.

## 0. Code and release gate

- [ ] Work from the latest `main`; do not deploy an old feature branch.
- [ ] Confirm the GitHub Actions **app** and **sql** jobs pass.
- [ ] Resolve the failing **integration** job on the current main commit. Do not mark V1 ready while it fails. Record each failing assertion, fix the product or test fixture as appropriate, and rerun the complete workflow.
- [ ] Run locally: `npm ci`, `npm run check`, `npm run db:test`, `npm run build`, and `npm run test:integration` (the integration suite requires its documented Postgres and PostgREST setup).
- [ ] Run `npm audit` and review production and development dependencies separately. The current install reports 20 vulnerabilities (including 2 critical and 3 high); identify the affected packages, update safely, rerun the full suite, and do not use `npm audit fix --force` blindly.
- [ ] Review the final diff and migration list. Database changes must be additive, tested, and committed before deployment.

## 1. Purchase and configure the domain at Namecheap

1. Choose and purchase the final Buna domain in Namecheap. Check spelling, renewal price, renewal settings, and account recovery security before checkout.
2. Enable auto-renew and two-factor authentication on the registrar account.
3. Keep the registrar's DNS manageable. If using Namecheap BasicDNS, DNS records are edited under **Domain List → Manage → Advanced DNS**. If custom nameservers are active, make DNS changes at the provider that hosts those nameservers.
4. Decide the canonical hostname (for example, the apex domain or `www`). Use one canonical URL and redirect the other hostname to it in Vercel.
5. Do not invent DNS values. Vercel supplies the website A/ALIAS/CNAME values; Resend supplies its sending-domain TXT/CNAME records. Copy each value exactly from those dashboards.
6. Add the domain to the Vercel project under **Settings → Domains**, follow Vercel's DNS instructions in Namecheap, wait for verification, and confirm HTTPS is active.
7. Set `NEXT_PUBLIC_SITE_URL` to the final canonical origin (no trailing slash), then redeploy.

Namecheap DNS instructions: https://www.namecheap.com/support/knowledgebase/article.aspx/434/2237/how-do-i-set-up-host-records-for-a-domain/

## 2. Set up Resend and authenticate the sending domain

1. Create or access the Buna Resend account.
2. Add the sending domain in Resend. Prefer a dedicated sending subdomain (for example, `send.YOUR-DOMAIN`) so transactional email authentication is separated from the website hostname.
3. In Namecheap **Advanced DNS → Host Records**, add the exact DKIM, SPF and any verification records Resend provides. Do not guess values.
4. Ensure there is only one SPF TXT record for a given hostname. If another email service already has SPF, merge the authorized senders into one SPF record rather than creating a second SPF record.
5. Add a DMARC TXT record for the sending domain. Start with a monitoring policy such as `p=none` and a monitored reporting address; tighten policy after observing legitimate delivery.
6. Wait for Resend to show the domain as verified. Send test messages to more than one provider (for example Gmail and Outlook) and inspect inbox, spam, headers, and authentication results (SPF, DKIM, DMARC).
7. Disable click/open link tracking for authentication messages so Resend does not rewrite or consume Supabase confirmation URLs.8. Create a dedicated Resend API key for production. Store it only in Vercel environment variables and Supabase SMTP settings. Never commit it or paste it into chat.

Resend SMTP credentials for Supabase Auth:
- Host: `smtp.resend.com`
- Port: `465`
- Username: `resend`
- Password: the Resend API key
- From address: an address on the verified sending domain

Resend SMTP reference: https://resend.com/changelog/smtp-service

## 3. Configure Buna's email system

Buna uses two delivery paths, both delivered by Resend:

- **Supabase Auth messages** (verification, password reset, invitations, magic links, email change and reauthentication): Supabase Auth creates and validates the secure token; Resend delivers the message over custom SMTP. This is the correct architecture—do not bypass Supabase's token system.
- **Buna application messages** (startup inquiries, team invitations, launch/community notifications, investor and other notification emails): the Next.js server sends through the Resend API and records delivery status for retry/visibility.

### 3.1 Vercel environment variables

Set these for **Production** (and Preview only if Preview uses a separate test domain and Resend sender):

| Variable | Required value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only Supabase service-role key |
| `NEXT_PUBLIC_SITE_URL` | Canonical production origin |
| `RESEND_API_KEY` | Dedicated production Resend API key |
| `EMAIL_FROM` | Verified sender, e.g. `Buna <hello@YOUR-SENDING-DOMAIN>` |
| `CRON_SECRET` | Random secret of at least 16 characters |
| `NEXT_PUBLIC_OPERATOR_NAME` | Actual legal operator/person or company name |
| `SUPPORT_EMAIL` | Monitored support address |

Also configure any other variables shown in the current `.env.example`. Never expose the service-role key or Resend API key through a `NEXT_PUBLIC_` variable.

### 3.2 Supabase Auth delivery

In Supabase **Authentication → SMTP Settings**, enable custom SMTP and enter the Resend credentials above. Set the sender name to `Buna` and use the verified sender address. Save and send a real test email.

In **Authentication → Providers → Email**:
- Enable email/password sign-in.
- Enable **Confirm email** for production. This ensures a signup address is verified before protected workflows.
- Keep the minimum password length at 10 and secure password change enabled.
- Review Auth rate limits; increase only after observing real traffic and abuse patterns.

In **Authentication → URL Configuration**:
- Set Site URL to the canonical production origin.
- Add the exact production redirect URLs and local development URLs. Avoid broad wildcard production redirects.

### 3.3 Install the branded Auth templates

In **Authentication → Email Templates**, paste each file into its matching template and set the subject:

| Supabase template | Repository file | Subject |
|---|---|---|
| Confirm signup | `supabase/templates/confirm-signup.html` | Confirm your Buna account |
| Invite user | `supabase/templates/invite-user.html` | You are invited to Buna |
| Magic link | `supabase/templates/magic-link.html` | Your Buna sign-in link |
| Change email address | `supabase/templates/change-email.html` | Confirm your new email address |
| Reset password | `supabase/templates/reset-password.html` | Reset your Buna password |
| Reauthentication | `supabase/templates/reauthentication.html` | Verify it is you |

The templates use Supabase's supported Go-template variables, including `{{ .ConfirmationURL }}`, `{{ .Token }}`, and `{{ .NewEmail }}`. Do not replace these with hard-coded links or expose tokens in logs.

### 3.4 Install security notification templates

In **Authentication → Email Templates → Security Notifications**, paste the corresponding files from `supabase/templates/notifications/` and enable the notifications Buna wants to send:

- `password-changed.html` — password changed
- `email-changed.html` — email address changed
- `phone-changed.html` — phone number changed
- `identity-linked.html` — sign-in method linked
- `identity-unlinked.html` — sign-in method removed
- `verification-added.html` — verification method added
- `verification-removed.html` — verification method removed

Use the subject that matches each file's heading. Security notifications should be enabled at the project level; saving a template alone does not enable its event.

### 3.5 Decide how support mail is received

Resend is the sending provider; it does not automatically create a staffed inbox. Confirm that `SUPPORT_EMAIL` is a mailbox or forwarding destination someone checks. Test both directions:
- Buna sends a support or inquiry message with the correct From and Reply-To.
- A user can reply and the reply reaches the intended monitored inbox.

Do not buy a separate mailbox product unless you need a real inbox; a verified sending domain and a monitored inbound address are separate requirements.

## 4. Verify Supabase database and storage

1. Open the correct production Supabase project.
2. Check the migration history before pushing anything:
   ```powershell
   npx supabase login
   npx supabase link --project-ref YOUR_PROJECT_REF
   npx supabase migration list
   ```
3. Compare local migrations `0001` through `0026` with the remote migration history and inspect any mismatch. The project has previously had partial/manual schema changes; do not blindly rerun SQL, delete columns, or manually mark migrations as applied.
4. Once the history and actual schema are reconciled, apply outstanding migrations:
   ```powershell
   npx supabase db push
   ```
5. Confirm the required storage buckets exist with the expected public/private access and size limits. Do not make verification documents public.
6. Confirm RLS is enabled on every user-data table and that the latest Phase 8 investor-team policies are present.
7. Confirm the production admin account exists and is assigned the admin role through the documented trusted server-side process. Create a separate moderator account for routine moderation.

## 5. Deploy the current release to Vercel

1. Connect the GitHub repository `BillGStanford/buna` to the correct Vercel project.
2. Confirm production deploys from `main`, not from a feature branch.
3. Add and verify all environment variables in Step 3.
4. Add the purchased domain and set the canonical hostname/redirect.
5. Deploy only after the required database migrations are applied.
6. Open `https://YOUR-DOMAIN/api/health`. It must return HTTP 200 and show Supabase, service role, email and database checks as healthy.
7. Confirm the daily cron in `vercel.json` is enabled. The job runs at 06:00 UTC and requires `CRON_SECRET`; confirm the first scheduled run succeeds.
8. Record the deployment URL and the previous known-good deployment for rollback.

## 6. Production acceptance test

Use separate real test accounts and inboxes for a founder, another team member, an investor (individual), an investor organization member, a moderator and an administrator. Never use the admin account as the only test identity.

### Authentication and account
- [ ] Sign up with a real inbox; receive the branded verification message through Resend; click once and verify the redirect.
- [ ] Attempt sign-in before verification; confirm protected access is blocked.
- [ ] Sign in, sign out, request password reset, complete reset, and sign in with the new password.
- [ ] Test resend-verification rate limits and generic responses for unknown email addresses.
- [ ] Change email and confirm the new address; verify security notification delivery.
- [ ] Confirm no auth email lands in spam and links use the production domain.

### Founder and startup
- [ ] Complete onboarding and edit the public profile/social links.
- [ ] Create a startup draft, save, reload, edit, upload logo/screenshots, add products and external links, preview and publish.
- [ ] Confirm published profile is visible signed out, appears in discovery and sitemap, and draft/private content is not exposed.
- [ ] Rename a startup slug and verify the old URL permanently redirects.
- [ ] Invite an existing Buna account to a startup team; accept, change role, remove, and verify last-owner protection.
- [ ] Submit a startup inquiry; confirm in-app notification, email delivery, Reply-To, status tracking and retry behavior.

### Launches and community
- [ ] Submit a launch; confirm moderation queue, approval, featured state, comments, one-level replies, voting and report controls.
- [ ] Verify duplicate votes are rejected and a user cannot vote on behalf of another account.
- [ ] Create a community thread in each category, reply, subscribe, and confirm notification preferences are respected.
- [ ] Hide and restore a thread and reply as staff; verify hidden content is not public.
- [ ] Verify notification emails are delivered through Resend and failures remain visible/retryable.

### Investors and opportunities
- [ ] Submit an individual investor application and an organization application; staff-review both.
- [ ] Apply to join an existing investor organization with a selected role; approve it and verify the member's role.
- [ ] Test owner/partner team management, multi-role membership if enabled by the product, and observer read-only enforcement.
- [ ] Confirm public investor contact details expose only intentionally public channels; private owner data stays private.
- [ ] Test startup discovery filters, saved searches, match alerts, pipeline stages, comparisons, data-room access and document permissions.
- [ ] Save an opportunity, verify deadline reminders, and verify expired opportunities cannot be applied to.

### Admin, privacy and operations
- [ ] Verify ordinary members cannot access admin routes; moderators cannot access admin-only settings.
- [ ] Test startup/launch/investor review, reports, community moderation, user suspension, audit log and contact inbox.
- [ ] Export a test account's data and delete a disposable account; verify ownership safeguards and data deletion behavior.
- [ ] Run `GET /api/cron/daily` with the correct bearer secret; confirm 200 and inspect the returned counts. Without the secret it must reject the request.
- [ ] Verify `/robots.txt`, `/sitemap.xml`, canonical URLs, metadata, social share cards, favicon and HTTPS.
- [ ] Check the production response headers and CSP; run the accessibility scan and keyboard-only test.
- [ ] Test at 320px, 375px, tablet and desktop widths in Chrome and at least one other browser.
- [ ] Check Vercel logs, Supabase logs, Resend delivery logs and cron execution logs for errors.

## 7. Legal, trust and launch operations

- [ ] Confirm the legal operator name, support email, minimum age and governing-law wording in Terms and Privacy Policy.
- [ ] Have a qualified lawyer review Terms, Privacy Policy, Community Guidelines, investor disclaimers and the platform's data-retention/deletion language.
- [ ] Confirm privacy disclosures match actual analytics, email, storage, auth and third-party processors.
- [ ] Publish a clear contact/support route and a process for abuse reports, account deletion requests and security incidents.
- [ ] Establish a daily moderation owner and a response-time expectation for reports and investor/founder inquiries.
- [ ] Prepare a rollback procedure and take a Supabase backup before the final production migration/deployment.
- [ ] Seed the site with real, permissioned startup and opportunity listings; remove all demo data from production.
- [ ] Run a small controlled launch with invited founders/investors, fix blocking issues, then announce publicly.

## Launch is not approved until

- [ ] All CI jobs, including integration, pass on the exact release commit.
- [ ] Production database migrations are reconciled and applied.
- [ ] The custom domain, HTTPS, Resend sending domain and Supabase SMTP are verified.
- [ ] Signup verification, password recovery and core transactional emails work in real inboxes.
- [ ] The production acceptance tests pass.
- [ ] Legal/operator details, moderation coverage, backups and rollback are in place.

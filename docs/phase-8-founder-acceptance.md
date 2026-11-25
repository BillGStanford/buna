# Phase 8 — Founder experience acceptance plan

This checklist is the release gate for the eight-phase startup management implementation. It is intentionally split between automated checks and authenticated browser checks: unit tests cannot prove Supabase RLS, signed-in workflows, upload behavior, or responsive rendering.

## Automated checks

Run from the repository root:

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run db:check
npm run db:test
npm run build
npm run test:integration
```

All commands must pass on the exact release commit. Record failures and fix them before promotion.

## Browser acceptance matrix

Use separate test accounts with real owner, admin, editor, and viewer memberships. Use a disposable test startup and non-sensitive sample files.

| Journey | Owner | Admin | Editor | Viewer |
|---|---:|---:|---:|---:|
| Open company workspace | Yes | Yes | Yes | Read-only pages only |
| Edit company profile/products | Yes | Yes | Yes | No |
| Publish/unpublish | Yes | Yes | No | No |
| Invite/manage teammates | Yes | Yes | No | No |
| Change another member's role | Yes, within allowed roles | Editor/viewer only | No | No |
| Transfer ownership | Dedicated owner flow | No | No | No |
| View pending invitations | Yes | Yes | No | No |
| Manage investor data room | Yes | Yes | Yes | No |
| View verification requests | Yes | Yes | No | No |

Confirm denied actions are blocked on the server, not merely hidden in the UI.

## Founder journey

1. Sign up and select the founder path.
2. Open My startups and create a company from /dashboard/startup/new.
3. Enter a name, tagline, sector, country, city, and optional website.
4. Confirm the company is created as a private draft and the supplied website is saved.
5. Save profile changes, leave the page, return, and confirm values persist.
6. Add a logo and product screenshots; test invalid, oversized, and valid files.
7. Add an external-link product and a file-upload product; verify each renders and opens only as intended.
8. Preview the public profile while it remains unpublished; verify it is not publicly discoverable.
9. Complete the publication checklist, confirm email, publish, and open the public page in a signed-out browser.
10. Edit the company, unpublish, and confirm the public page is no longer available while the draft remains editable.
11. Invite a teammate, accept the invitation using the invited account, and verify the assigned role.
12. Exercise role changes, removal, and the dedicated ownership-transfer flow with disposable accounts.
13. Add a milestone, company update, changelog entry, and hiring status; verify each appears publicly only when intended.
14. Submit a verification request and inspect its status/history.
15. Upload a non-sensitive sample investor document, approve access for a test investor, verify access, revoke it, and verify the investor can no longer obtain the file.
16. Check company analytics, followers, and engagement where test data exists.

## Responsive and accessibility checks

- Test widths of 360px, 390px, 768px, 1024px, and desktop.
- Complete all key forms using keyboard only.
- Verify visible focus, field labels, error associations, and submit/loading feedback.
- Confirm headings are hierarchical and icon-only controls have accessible names.
- Check color contrast and zoom at 200%.
- Confirm no horizontal overflow, clipped dialogs, or sticky navigation covering form targets.

## Release evidence

Attach CI links and record the tester account role, startup ID, browser/device, pass/fail, and issue link for every failed journey. Do not use real investor documents or production customer data in testing.

## Known validation boundary

This plan does not claim that browser acceptance has already been performed. A passing unit test or CI run is not a substitute for the four-role Supabase-backed browser checks above.

# Deployment status — 21 October 2026

## Resources

- Supabase organisation: OrangeLabX (`mxnajzjyrizeqlnzscpl`).
- DYC Care Production project: `lkuzzzbxldetnzlpiben`, eu-west-1, created on the Free plan.
- Dashboard: https://supabase.com/dashboard/project/lkuzzzbxldetnzlpiben
- `smarttours` was paused with the owner's explicit permission to free an active Free project slot. `gamemeetsworld` was not modified.
- Existing Sites identity is preserved. Supabase URL and publishable key have been configured in its production runtime environment. This does not publish the app.
- Clinical records still use the application's D1 database; Supabase is the staff authentication provider. Local synthetic records have not been uploaded.

## Staff access

The requested sign-in flow is individual administrator-created accounts with passwords. No email verification link is sent during sign-in. There is no public registration endpoint in the app. Provider-side public signup must also be disabled before launch.

An authorised administrator must provision each identity through Supabase Auth Admin `createUser` with a strong password and `email_confirm: true`, then approve its matching email and role in the app. `createUser` does not send an email. Do not use SQL to insert identities or change verification flags. The first administrator must match `BOOTSTRAP_ADMIN_EMAIL`; the first visitor cannot claim ownership. Bootstrap is currently unconfigured, so access remains closed.

Do not share an account between staff. Hand over passwords directly using a protected channel. No staff passwords or privileged provider keys are stored in source. Staff account provisioning and password reset handover are not yet implemented in the app's administrator UI.

## Implemented, with remaining verification

Implemented: server-authorised roles and groups; account-bound encrypted offline storage; eight-hour offline leases; server-enforced eight-hour sessions with a fifteen-minute idle timeout; suspension and session revocation; same-origin write checks; request limits; CSV export auditing; input bounds; private response headers and HTML content security policy.

TypeScript checks, domain checks, offline encryption checks and the production build pass. Encryption tests verify account and record isolation, fresh IVs, wrong-key rejection and authenticated tamper detection. These tests do not establish that the whole application is ready for clinical use.

## Additional checks completed

- Upgraded Next.js to 16.4.2 and React / React DOM / React Server DOM to 19.2.9; pinned Supabase package versions. The production dependency audit reports zero advisories. The full audit still identifies development-tool advisories; no forced downgrade or untested tooling migration was applied.
- Isolated API checks passed for roles, assigned groups, idempotency conflicts, cross-origin rejection, input bounds, simultaneous check exceptions, stale regimens, analyst exports and suspended accounts.
- A local test passed with 300 synthetic warriors and 15 concurrent camp reads (129 ms total on this Mac). This is a basic concurrency rehearsal, not a hosted capacity guarantee.
- Production mode rejects anonymous requests and spoofed local-demo identity headers with 401; private cache and HTML security headers verified.
- Local snapshot integrity and restoration passed. Both access/session migrations were applied locally, and every existing warrior, entry, review, regimen and command row was verified unchanged.
- Static service-worker cache warming was added for assets loaded before first control. Tests confirm API/clinical-file/cross-origin exclusions and preservation of unrelated caches. Browser offline queue recovery still needs end-to-end verification.
- Rechecked clinical authority in write transactions; guarded administration against a concurrent regimen change and check exceptions against concurrent existing observations. Suspended staff cannot receive review handovers.

## Required before real use

- Configure the public HTTPS origin and first administrator identity, provision that password account, and disable provider public signup. Verify successful login, logout, suspension, idle expiry and permissions end to end.
- Apply the new D1 migrations when publishing the fresh hosted database. Local migrations are complete. The existing plaintext synthetic browser store is deliberately untouched; do not import it into the new production store automatically.
- Complete browser and offline storage/queue recovery testing and a hosted load test with realistic camp history and staff activity.
- Resolve correction/void history and complete clinical workflow testing; obtain clinical approval of schedules, rules and handover ownership. Automated clinical thresholds remain inactive.
- Verify encrypted backups and restoration, record access ownership, and operational responsibility before entering identifiable participant data.
- Publish and verify the deployment. There is no live production URL yet.

# Single Railway Backend — Final Release Handoff (Vercel Owner-Managed)

**Status:** source cutover prepared, code-level CI required, and a combined Railway canary was deployed successfully. Production migration is **not** yet verified or authorized. This public runbook contains no credentials or customer data.

## Existing live origin

The existing personal Corner service is \`https://corner-web-production-2600.up.railway.app\`. Do **not** repoint the Vercel API rewrite until that service is running the unified Docker release and all checks below have passed. The current service may still serve only Corner.

## Source and frontend

- The entire Vercel filesystem \`api/\` directory has been removed **in this release branch**. The same handler modules were relocated unchanged to \`railway-api/\` for use by the unified Node process. Public URLs such as \`/api/contact\`, \`/api/birthday\`, \`/api/track/auth/session\`, \`/api/track/enquiries/*\`, \`/api/ev-survey\` and \`/api/website/events\` remain the same in the browser.
- \`vercel.json\` retains the existing \`/corner\` proxy and adds one \`/api/:path*\` rewrite to the exact existing Railway origin. The old origin remains configured until an authorized release.
- The Vercel cron is retained **temporarily**. It must not be left running simultaneously with the new Railway maintenance worker unless duplicate operation has been safely verified.
- The static portfolio and current published Privacy/Terms text are not changed by the backend migration.

## Backend release candidate

- Root Docker build: \`Dockerfile.unified\`, service root \`/\`, Node 22, same Corner SQLite \`/data\` volume, same existing Corner session and backup configuration.
- Backend dispatcher: \`server/railway/dispatch.mjs\`, strict route allowlist and body/origin validation, default-off \`UNIFIED_PORTFOLIO_API\` switch.
- Scheduler: \`server/railway/maintenance.mjs\`, default-off \`UNIFIED_MAINTENANCE_ENABLED\`; 08:00 UTC daily, backed by persisted last-success marker.
- \`/api/unified/ready\` remains HTTP 503 until required portfolio service configuration, a manual cutover attestation and an actual Neon database SELECT 1 test succeed. This is not proof of email delivery or privacy compliance.

## Production acceptance

1. Preserve current Corner volume and independently verify recent offsite backup, restoration and a known working rollback image. Never delete or overwrite the live database.
2. Complete configuration of the **personal** portfolio Neon DB, Track owner auth secret, Resend sender and email verification, and cron secret on Railway. They must be product-authorized and delivered through secure provider settings, not source code. Vercel env read was forbidden (403) by the connector, so these values could not be copied.
3. Confirm Corner feed/posts/owner sign-in/media/publishing, private owner API checks and scheduled publishing under the new pinned root Docker build.
4. Verify real authorized owner OTP login, session expiry, enquiry storage, transactional email acceptance, EV rights/export/erasure, analytics consent/withdrawal, and retained privacy controls. Test with approved non-customer fixtures.
5. Enable \`UNIFIED_PORTFOLIO_API=1\` only after tests. Set \`UNIFIED_BACKEND_CUTOVER_VERIFIED=1\` only after independent verification; it is not a substitute for verification.
6. Run \`node scripts/verify-unified-railway-release.mjs https://corner-web-production-2600.up.railway.app\` from a permitted network. It checks Corner DB, unified gateway, live portfolio DB readiness, owner-route 401 and forbidden-origin 403. It deliberately sends no real customer messages.
7. Vamsi reviews and deploys the exact release commit to Vercel. Verify all public routes and rollback. After the Railway daily worker runs with verified persistence and reporting, remove the Vercel cron with a separate reviewed change.

## Still separate

The **personal central legal system** remains a distinct private service/code governance boundary even if runtime consolidation is later approved. Six-product statutory legal notices, qualified counsel review, owner passkey enrollment, encrypted document scanning, backup and data-rights workflows have not become production-complete by migrating portfolio HTTP routes.

**Do not call the complete 63-decision implementation finished on the strength of this routing release alone.**

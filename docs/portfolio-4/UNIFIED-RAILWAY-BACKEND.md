# Railway single-backend consolidation — phase 1

Status: implementation on isolated branch only. User-directed goal: **one publicly routed Railway web service** for the personal portfolio APIs, owner Tracker, EV survey, birthday links, and Corner. Existing storage isolation is preserved. Vercel remains static frontend/CDN only after a separately verified cutover.

## Audited real services and API endpoints

- Existing Railway project `vamsis-corner`, service `corner-web`, source `vamsimarripudi/vamsi-portfolio` / `master`, root `/corner`. The current single service has a persistent `/data` volume and uses Corner's SQLite, owner auth, media, scheduled publication and offsite backup.
- Portfolio currently uses Vercel serverless handlers `/api/contact`, `/api/birthday`, `/api/track/auth/*`, `/api/track/enquiries/*`, `/api/track/metrics`, `/api/track/analytics`, `/api/track/ev-surveys`, `/api/website/events`, `/api/ev-survey`, and `/api/track/cron/followups`.
- The existing Tracker/EV handlers use the **existing portfolio Neon database**, not Corner SQLite and not the dedicated legal development database. Never merge databases during HTTP consolidation.
- Personal legal API must remain isolated, with its own dedicated Neon project and service identity. Its secure HMAC, MFA, evidence vault and legal publication design are separate release gates; this first stage does **not** falsely expose legal-case endpoints.

## Unified process architecture

```text
Browser -> Vercel (static React + same-origin /api rewrite)
                          |
                          v
Railway: existing corner-web, ONE Node process and ONE HTTP listener
    /corner/**                    -> existing Corner code / SQLite /data
    /api/contact, /api/birthday   -> existing enquiry/birthday handlers
    /api/track/**                 -> existing Tracker handlers and Neon
    /api/ev-survey                -> existing EV survey handler and Neon
    /api/website/events          -> existing opt-in analytics handler
    /api/unified/health           -> gateway process health only
     [legal-case API disabled pending secure private integration]
```

The Node server runs the existing Corner scheduler, backups, session logic and media handlers unchanged. A guarded portfolio dispatcher is inserted **before** Corner's `CORNER_BASE_PATH` processing. `UNIFIED_PORTFOLIO_API` defaults to `0`: a production deploy of this branch does not silently activate new public APIs.

## Deployment contract

Build from repository root using `Dockerfile.unified` and `railway.unified.json`, instead of legacy `/corner` build root and `corner/Dockerfile`. Preserve `/data` volume and current Corner variable names, healthcheck `/corner/api/health`, public hostname, session secret, and offsite backups. Never switch build root on the live service without a canary test of equivalent Corner behavior.

New portfolio environment names: `DATABASE_URL` (existing tracker Neon only), `TRACK_SESSION_SECRET`, `RESEND_API_KEY`, `CRON_SECRET`, `WEBSITE_ANALYTICS_SECRET` (if used), `UNIFIED_PORTFOLIO_API=1` after verification. Do not reuse `SESSION_SECRET` as tracker secret or borrow company/private-product keys. Do not commit secret values.

## Cutover — blocked until verified

1. Run `npm ci`, `npm test`, `npm run build`, `npm --prefix corner run check` and new `tests/unified-railway-router.test.mjs` on exact SHA.
2. Build root Docker image in isolated CI and run full browser + HTTP tests with synthetic data; validate `/corner` routes and `/api/unified/health` without touching the live Corner volume.
3. Verify personal Railway ownership, budget, required env variables and actual dual-stack service reachability. Protect owner routes, cookie scope, CSRF and rate limits; verify Resend and Neon **on an isolated staging dataset**.
4. Switch the existing Railway Corner service to the root build only with backup/rollback proof. Do **not** replace `/data`, revoke live credentials or delete the old service.
5. After testing Railway /api endpoints, separately modify Vercel `vercel.json` to route paths to the *same* Railway web service. Keep the frontend origin the same and verify sessions, consent, support email, EV research and cron without sending real customer messages.
6. Disable Vercel cron when Railway's **single-process daily maintenance** is implemented, durably idempotent and separately verified. The Vercel cron remains active during this phase.
7. Remove original Vercel functions and redundant proxy routes **only after** one full regression cycle, backed-up data, tested rollback, and owner-approved cutover. Retain history in Git; never destroy customer records or backups as housekeeping.

**Do not call this complete before real HTTP, DB/RLS, backup and owner identity tests pass.** Unrelated personally operated products remain independent and company products are excluded.

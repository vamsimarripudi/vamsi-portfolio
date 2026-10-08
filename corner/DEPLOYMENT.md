# Vamsi's Corner — portfolio subpath integration

Canonical URL: https://vamsimarripudi.me/corner

Standalone Node.js service, proxied at /corner from Vercel to a Railway service with a persistent volume at /data.

## Runtime
- Node.js >=22.13 (uses node:sqlite, first-party HTTP)
- DATABASE: SQLite WAL on persistent /data; do **not** run multiple instances for writes.
- MEDIA: local /data/uploads, protected by media visibility checks
- SCHEDULER: single-process interval every 15 seconds; never enable Railway sleep or scale replicas >1.
- REALTIME: SSE at /corner/api/realtime/stream with DB polling for reconnect.
- ADMIN: owner email and strong scrypt password hash; sessions HttpOnly/Secure/SameSite=Strict under /corner.

## Environment

Set as Railway service variables:
```
NODE_ENV=production
HOST=0.0.0.0
SITE_URL=https://vamsimarripudi.me/corner
CORNER_BASE_PATH=/corner
DATA_DIR=/data
ADMIN_EMAIL=connect@vamsimarripudi.me
ADMIN_PASSWORD_HASH=<scrypt hash generated with src/auth.mjs>
SESSION_SECRET=<independent cryptographically random long secret>
DEMO_CONTENT=0
TRUST_PROXY=1
```

Do not commit plaintext passwords or SESSION_SECRET.

## Vercel routing
Add `/corner` -> `https://<railway-domain>/corner` and `/corner/:path*` -> `https://<railway-domain>/corner/:path*` before the catch-all portfolio Vite rewrite. Keep existing /api, /track and portfolio routes intact.

## Smoke checks
- GET /corner/ and /corner/api/health -> 200
- GET /corner/style.css and /corner/app.js -> 200
- GET /corner/admin -> login, GET /corner/api/admin/overview -> 401 without session
- Login with configured email/password, verify HttpOnly cookie path=/corner.
- Publish real note, verify reader, search, SSE, scheduling, reactions and moderated comments.
- Upload supported image, verify /corner/media/* including Range video response.
- Reboot service, verify post data, login session, media and scheduler persist.

## Verified private offsite backups

The Railway **corner-private-backups** bucket in Singapore is independent of the SQLite/media volume at `/data`.
`corner/src/offsite-backup.mjs` takes an online SQLite backup plus a copy of all uploads, sends every file to the bucket with AWS Signature V4, reads each copy back, validates SHA-256 and rehearses a restore in a *new temporary directory*. It writes the remote `manifest.json` **last**, only after the rehearsal passes. It never restores into the live database.

Configure these Railway service variables using **references**, not pasted secrets:

```env
CORNER_BACKUP_ENABLED=1
CORNER_BACKUP_S3_ENDPOINT=${{corner-private-backups.ENDPOINT}}
CORNER_BACKUP_S3_BUCKET=${{corner-private-backups.BUCKET}}
CORNER_BACKUP_S3_REGION=${{corner-private-backups.REGION}}
CORNER_BACKUP_S3_URL_STYLE=virtual-host
CORNER_BACKUP_S3_ACCESS_KEY_ID=${{corner-private-backups.ACCESS_KEY_ID}}
CORNER_BACKUP_S3_SECRET_ACCESS_KEY=${{corner-private-backups.SECRET_ACCESS_KEY}}
CORNER_BACKUP_UTC_HOUR=2
CORNER_BACKUP_UTC_MINUTE=30
CORNER_BACKUP_RETENTION_DAYS=30
```

Daily scheduled backup time: **02:30 UTC / 08:00 IST**, catch-up on service startup after the configured UTC time. Failures retry no more frequently than every 30 minutes. Retention expires completed copies after 30 days but always keeps the two most recent verified backups. Partial backups without a manifest are not considered complete and should be cleaned manually if necessary.

`/corner/api/admin/ops` (authenticated owner only) includes `backup.lastSuccess`, `backup.lastAttempt` and `backup.lastError`. Railway logs include `corner.backup.verified` and `corner.backup.failed`. The `backup:offsite` script supports a manual one-shot run inside the application container.

Recovery procedure: use an isolated deployment or maintenance window, download a verified offsite snapshot (manifest and referenced objects), verify every file's SHA-256, stop the primary app, and run `node scripts/restore.mjs /path/to/snapshot --confirm` with correctly scoped `DATA_DIR`. **Never restore over the live running database.** Every daily backup already performs an isolated restore rehearsal, not a destructive production restore.

Keep the current single-writer instance and persistent volume; keep S3 credentials private. At 05:00 UTC daily, GitHub Actions verifies the public non-sensitive `backupFresh` boolean returned by `/corner/api/v1/ready`. It turns false when backups are disabled, missing, invalid, dated in the future, or more than 26 hours old, which raises a visible failed CI check. This does not expose bucket names, credentials, snapshot timestamps or filenames. GitHub failure notifications depend on the repository owner's notification settings. The standard HTTP readiness status remains based on SQLite and filesystem availability, so a backup alert cannot itself restart the service.

Additional browser security and authenticated owner acceptance are separate from storage validation.

## Operational limitations
Cost depends on Railway plan. Single persistent instance, outage on service shutdown. On-volume backups do not cover volume deletion; configure offsite backup and alerting. Test browser accessibility and performance independently before declaring 100% production readiness.

## REST v1 and scale-out path

The versioned API is available at `/corner/api/v1`, with OpenAPI at `/corner/api/v1/openapi.json` and a storage readiness endpoint at `/corner/api/v1/ready`. Original `/corner/api/*` routes remain backwards compatible. See [`docs/REST_V1_AND_SCALING.md`](docs/REST_V1_AND_SCALING.md) for the request/response contract and the guarded migration to a horizontally load-balanced PostgreSQL/object-storage architecture. **Do not increase Railway replicas while the current SQLite/media volume is the source of truth.**

## Identity V2 (additive; registration gated)

The current owner account is preserved. Existing owner sessions remain valid unless the owner password is deliberately rotated. `src/identity-schema.sql` creates additive profiles, hashed one-time tokens, staff invitations, MFA records, private bookmarks and privacy requests; new users explicitly receive `member` roles. Staff registration is invitation-only. **Never allow public signup to choose a role.**

New routes include `/corner/login`, `/corner/register`, `/corner/profile`, `/corner/settings/security`, `/corner/admin/register` and `/corner/admin/mfa`. REST endpoints are under `/corner/api/v1/auth/*`, `/corner/api/v1/me/*` and `/corner/api/v1/admin/invitations`. Original owner `/corner/admin` login and publishing APIs continue to work with role-based permissions. Member cookies (`corner_member_session`) are never accepted for Studio actions. The owner can activate authenticator MFA voluntarily; all newly invited staff accounts require MFA before Studio access.

**Public registration stays disabled until email verification is genuinely configured and tested.** Configure Railway service variables in its Production environment using secrets, not repository files:

```env
CORNER_AUTH_REGISTRATION_ENABLED=0
CORNER_AUTH_RESEND_API_KEY=<your Resend API key>
CORNER_AUTH_FROM_EMAIL=Vamsi's Corner <connect@vamsimarripudi.me>
```

Create/verify an authorized sending domain and sender in Resend and perform a real verification-email and password-reset test. Only after the full flow succeeds change `CORNER_AUTH_REGISTRATION_ENABLED` to `1` and redeploy. Do not put quotation marks in a literal Railway environment variable value.

Verification links are one-use and expire after 30 minutes; reset links expire after 20 minutes; staff invitations expire after 48 hours. The default member session is seven days and the Studio session eight hours. MFA secrets are AES-256-GCM encrypted with a key derived from `SESSION_SECRET`; rotating `SESSION_SECRET` without migrating existing factors invalidates authenticator seeds (one-time recovery codes remain available). Never include credentials or authenticator seeds in logs.

Account profiles are private. Public members can bookmark posts, edit a short biography, inspect/revoke sessions, request JSON export and submit a deletion review. Export uses an authenticated download. The deletion-request queue requires manual review; account data is not auto-erased. Guest readership and reactions remain available without a login.

Performance: maintain server rendering and native routes. `public/nav.js` selectively prefetches up to four public routes on desktop hover, and CSS cross-document transitions respect reduced-motion. No SPA rewrite or third-party routing runtime.

Before launch, rehearse the migration against a verified snapshot and test role-escalation, CSRF, password recovery, MFA recovery, cookie isolation, multi-viewport forms and backup freshness. Keep single SQLite writer until a separately reviewed storage migration.

## Corner Identity V2 (rollout remains gated)

The existing owner account, posts, uploaded media, SQLite volume and historical
sessions are preserved. The additive `identity-schema.sql` migration creates
verification, invitation, profile, MFA, bookmark and privacy-request tables.
The SQL role default is `member` for new databases; legacy schema defaults are
fail-closed by the unique-owner guard, and every application insert supplies an
explicit role. All publishing/moderation APIs enforce server-side permissions.

Routes: `/corner/login`, `/corner/register`, `/corner/profile`,
`/corner/settings/security`, `/corner/verify-email`,
`/corner/resend-verification`, `/corner/forgot-password`,
`/corner/reset-password`, `/corner/confirm-email`,
`/corner/admin/register`, `/corner/admin/mfa`, `/corner/admin/invite`.
Versioned REST endpoints at `/corner/api/v1/auth/*`, `/corner/api/v1/me*` and
`/corner/api/v1/admin/invitations` are documented in OpenAPI.

**Public registrations default OFF.** To enable member accounts, configure
`CORNER_AUTH_RESEND_API_KEY` and `CORNER_AUTH_FROM_EMAIL` in Railway using an
actually verified Resend sender. Verify transactional delivery and recovery
end-to-end before setting `CORNER_AUTH_REGISTRATION_ENABLED=1`. Do not reuse a
frontend key, commit these secrets, or expose them in browser scripts. Admin
registration is ALWAYS owner-invitation-only and MFA is mandatory for newly
invited staff. The existing owner can enroll an authenticator through
`/corner/settings/security` without losing the initial bootstrap account.
Staff login supports authenticator TOTP and single-use recovery codes. A member
session cookie cannot authorize a Studio endpoint. Legacy `/api/admin/login`
uses the same identity provider and MFA checks; it cannot bypass the new auth.

Account pages have `Cache-Control: private, no-store` and account API responses
have `no-store`. Browser-native cross-document transitions and bounded public
link prefetching improve routing without compromising SEO, history or account
security. `CORNER_AUTH_TEST_OUTBOX` is permitted ONLY in isolated NODE_ENV=test
and must not be configured in production.

Password rotation via a changed Railway `ADMIN_PASSWORD_HASH` intentionally
revokes all owner sessions; an in-app password reset/change survives ordinary
restarts even while that configuration remains unchanged. Owner email updates
require an explicit controlled deployment migration to avoid a bootstrap
mismatch; member and invited staff email updates use verified, single-use
links that revoke old sessions.

## Branded, accessible Corner transactional emails

The shared `src/email-templates.mjs` renderer supplies rich HTML and plain text for account verification, password reset, staff invitations and email changes. It uses a black editorial masthead, white rounded letter content, warm background, personal quote, and black/white footer, without remote images, scripts or external font dependencies. Action-token links are the first URL in plain text, preserving existing verification and recovery clients. `welcomePreviewFor('Vamsi')` and `welcomePreviewFor('Jaya')` generate two individually written, signed preview letters without creating accounts or automatically sending. Production tests must use the configured Resend service without exposing credentials.

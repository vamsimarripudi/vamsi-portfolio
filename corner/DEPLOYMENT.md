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

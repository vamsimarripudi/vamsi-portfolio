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

## Backups
Run `node scripts/backup.mjs /data/backups/<timestamp>` for a checksummed snapshot of the SQLite database and all uploaded media. Backups stored on same volume are **not offsite disaster recovery**. Export snapshots offsite and rehearse restore with `node scripts/restore.mjs <folder> --confirm` only with the service stopped.

## Operational limitations
Cost depends on Railway plan. Single persistent instance, outage on service shutdown. On-volume backups do not cover volume deletion; configure offsite backup and alerting. Test browser accessibility and performance independently before declaring 100% production readiness.

## REST v1 and scale-out path

The versioned API is available at `/corner/api/v1`, with OpenAPI at `/corner/api/v1/openapi.json` and a storage readiness endpoint at `/corner/api/v1/ready`. Original `/corner/api/*` routes remain backwards compatible. See [`docs/REST_V1_AND_SCALING.md`](docs/REST_V1_AND_SCALING.md) for the request/response contract and the guarded migration to a horizontally load-balanced PostgreSQL/object-storage architecture. **Do not increase Railway replicas while the current SQLite/media volume is the source of truth.**

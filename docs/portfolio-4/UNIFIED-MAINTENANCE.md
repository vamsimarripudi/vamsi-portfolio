# Railway consolidation — scheduled maintenance and cutover verification

## Existing behavior

The portfolio's active Vercel cron calls \`/api/track/cron/followups\` at \`08:00 UTC\` each day. It performs enquiry reminders, first-party analytics cleanup and EV data retention cleanup. That work **must not stop** when the HTTP route is migrated.

## One-process replacement

The Corner HTTP process invokes \`createUnifiedMaintenance\` from the same process, with a 15-second lightweight check. The scheduler:

- requires **both** \`UNIFIED_PORTFOLIO_API=1\` and \`UNIFIED_MAINTENANCE_ENABLED=1\`; otherwise it does nothing;
- only attempts after 08:00 UTC, storing the last successful UTC date in persistent Corner SQLite settings, on the existing \`/data\` volume;
- sends a local loopback GET with a configured secret; never emails users or mutates data directly from the scheduler;
- is bounded to one in-flight execution, waits 15 minutes after failure, retries later and does **not** mark a date complete if analytics/EV cleanup reports failure;
- relies on the existing cron handler's explicit authorization and idempotent database update; it does not establish distributed scheduling guarantees across multiple replica processes.

The 08:00 UTC schedule is not 08:00 IST. The former Vercel cron's schedule is preserved.

## Cutover order — production mutations require real verification

1. Build exact-SHA image and start with \`UNIFIED_PORTFOLIO_API=0\` and maintenance disabled; run Corner health/owner auth/scheduler/media tests.
2. Verify separate database connections and transactional email provider credentials are available on the new Railway service without logging values.
3. Exercise synthetic cases, mail provider sandbox, login cookies, EV deletion and analytics consent/revocation through the same-origin Vercel rewrite path.
4. Activate portfolio API and verify external route status, cookie path/domain, secure headers and forbidden-origin requests.
5. Enable the maintenance flag only after the Vercel cron is switched off through the owner-controlled static deployment. Do not allow both to run unless a temporary overlap is explicitly verified.
6. Maintain old serverless handlers for rollback until a complete real HTTP regression cycle is recorded.
7. Only then remove the old Vercel functions, cron and redundant rewrites in a separately audited release.
8. Legal policies, separate Neon legal RLS, passkey owner approvals, qualified counsel and private evidence remain separately gated.

## Hard boundary

A single Railway process does **not** imply a single shared database, security identity, storage namespace, consent record, or legal operator. Do not merge Corner SQLite with enquiry Neon or the dedicated personal legal Neon database.

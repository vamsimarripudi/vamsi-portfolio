# Vercel front-end handoff for unified Railway backend

The owner handles **Vercel deployment**. Keep the current published config and existing backend unchanged until real Railway routes have been verified.

## What changes

Railway serves one Node listener. Corner stays at /corner on the same known Railway origin. Portfolio /api/* becomes a transparent Vercel same-origin rewrite to that service. Existing login cookies, noindex headers and frontend routing remain same-origin. This changes *where backend code executes*, not the browser origin or the underlying existing databases.

## Generate a controlled candidate (no deployment)

Run, in the portfolio root:

node scripts/render-unified-vercel-cutover.mjs https://corner-web-production-2600.up.railway.app > vercel.candidate.json

Review the diff; the script is intentionally pure and **does not modify vercel.json**. The old Vercel daily cron is kept by default to avoid silently stopping follow-ups and retention cleanup. After independent evidence that Railway maintenance is operational, the user can produce the final replacement:

node scripts/render-unified-vercel-cutover.mjs https://corner-web-production-2600.up.railway.app --confirm-maintenance-verified > vercel.cutover.json

The flag is a human attestation, not an automated proof. Do not set it until actual Railway daily job/DB/email checks pass, and do not run both daily jobs without explicit overlap analysis.

## Safe sequence

1. Exact-SHA GitHub CI + root Docker build and full Corner regression passes.
2. Railway canary root image starts with no real production credentials and reports missing storage as 503, not false healthy.
3. Required secrets are configured in a verified personal Railway service; never log or commit them.
4. Synthetic and real authorized parity evidence: contact, birthday, Track authentication/session, enquiry actions/replies, consented analytics, EV upload/delete/export, and cron.
5. Back up the existing Corner volume; preserve it unchanged and confirm offsite backup.
6. Deploy unified source to the existing Corner service in an approved maintenance window with rollback.
7. Owner deploys the reviewed Vercel candidate. Verify every endpoint from the real frontend domain and no duplicate cron.
8. Only in a later reversible cleanup release should Vercel serverless source and the duplicate cron be removed. No deletion before passed parity and protected customer data.

No policy publication, company product migration, shared customer database, new legal identity role or payment activation is implied.

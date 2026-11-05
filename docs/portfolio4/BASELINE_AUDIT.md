# Read-only repository and deployment audit — 2026-11-05

## Verified source baseline
- GitHub vamsimarripudi/vamsi-portfolio: public, default master, commit 251e884636eb533aaab9e92421a2376708c36855; existing React 19/Vite 7/React Router 7 application.
- src/App.jsx contains /now, /work/pakkafollow, /privacy, /terms, /contact, /track/*; no /legal route at baseline.
- src/LegalDocument.jsx and src/LegalDocument.css render portfolio Terms and Privacy; src/privacy.js supplies existing privacy text (version 1.4, dated 25 October 2026). Preserve originals; legal signoff **not verified**.
- Current source includes mobile quick dock, intent-first visitor links, animated portfolio components and a truthful PakkaFollow development label; these are not proof of current production rendering.
- vercel.json maps /corner to its separate Railway service; static build command is npm run build. Existing automation on master includes lint, tests and build. Review all deployment triggers before merges.
- Baseline GitHub Actions for 251e884636eb533aaab9e92421a2376708c36855 completed successfully; Vercel project still reports a READY production deployment with an older Git SHA. Production parity is **not verified**.
- Open PR #101 changes corner/public/command-chat.css, corner/public/command-chat.js, corner/tests/command-chat-browser.mjs and scripts/verify-platform-comfort.mjs. These paths are reserved for that work; this implementation will not touch them.
- **Discrepancy:** docs/privacy/data-inventory.md says no visitor analytics; src/privacy.js describes first-party optional website analytics. Reconcile runtime, data, docs and effective dates before legal review.
- Related accessible personal repos: private vamsimarripudi/pakkafollow and private vamsimarripudi/FileBloom. PakkaFollow README describes a pre-launch candidate with payment/AI/referral gates; FileBloom README focuses on an older brand preview despite newer test/evidence paths. Reconcile actual code against claims.
- Avenfolio Press and Living Calendar repositories not found in the currently accessible GitHub listing; do not infer they do not exist elsewhere.
- No independently secured personal legal API repository, dedicated Neon legal database, legal reviewer engagement, evidence storage/scanner or tested approval cryptography verified by this audit.

## Owner-confirmed lifecycle — not a deployment attestation
| Property | Approved lifecycle | Evidence required |
|---|---|---|
| Portfolio | Live website | Current production SHA, data, Terms/Privacy |
| Vamsi's Corner | Live public platform | Policy inventory and actual processing |
| PakkaFollow | Building, pre-launch | Feature flags, payment/email and legal gates |
| FileBloom | Building, not production-ready | Actual code and evidence vs stale README |
| Avenfolio Press | Planning | Repository/location, processing, licensing model |
| Living Calendar | Early Alpha | Repository/location, on-device storage, push |

## Blocking gaps
Actual personal address, grievance/role appointments, individual tax status, privacy processing evidence, qualified counsel and CA opinions, exact historic acceptance evidence, dedicated private legal repository, verified personal Neon/Railway ownership, back-up restore and key recovery, email delivery/aliases, evidence malware scanning, Vercel limit and prod-trigger checks.

## Evidence classification
OWNER_ATTESTED: product stage or policy decision; CODE_OBSERVED: source exists; TEST_VERIFIED: executed passing test for exact SHA; DEPLOYMENT_VERIFIED: observed target; UNKNOWN: source inaccessible; CONFLICT: observed mismatch. None implies another.

Read-only audit: no secret transfer, production mutation, automatic purchase or legal publication.
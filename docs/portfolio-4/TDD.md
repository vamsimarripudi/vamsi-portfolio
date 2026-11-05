# Portfolio 4.0 + Personal Legal System — Technical Design

Version: development draft 0.1. All new legal service details are proposed, **not deployed**.

## Verified baseline (2026-11-05)

- Public repository: vamsimarripudi/vamsi-portfolio; default branch master; baseline commit 251e884636eb533aaab9e92421a2376708c36855.
- React 19, Vite 7, React Router 7, existing CSS tokens and existing source route metadata.
- Existing /privacy and /terms are published portfolio documents; these are not newly counsel-approved central policies.
- Vercel custom domains include vamsimarripudi.me; last verified production deployment was on an older SHA. Prior daily deployment limit remains a release blocker until independently rechecked.
- Existing /corner is routed to its independent backend and must not be modified by this project.
- Open PR #101 changes Corner command-chat files and a visual test script; no overlap allowed.
- PakkaFollow is a private separate repository and pre-launch per project documentation. FileBloom has a private separate repository. Remaining personal project repositories have not been verified.

## Deployment and trust boundaries

A. Public portfolio: existing Vercel React/Vite site. No database or secret credentials in browser bundles.
B. Public legal reader: static **approved** immutable document artifacts, origin and version integrity verified before promotion; runtime reading must not depend on Railway or Neon.
C. Dynamic legal requests: separately authenticated Node API on individually verified Railway infrastructure, with no persistent public request bodies or cases in CDN caches.
D. Legal datastore: dedicated verified Neon PostgreSQL; product-scoped authorization, tested row-level security and least-privilege service roles; no legal tables added to the existing portfolio's enquiry database.
E. Evidence vault: private separately verified storage and scanning provider, gated off until reviewed, tested and explicitly authorized.
F. Owner control: independent phishing-resistant MFA and exact policy-hash authorization; neither Git push nor generic login confers legal publication permission.

## Proposed entities (schema to be implemented privately after provider verification)

- legal_products: product_id, operator_id, lifecycle, visibility, reviewed_at, provenance.
- legal_documents: document_id, product_id, kind, locale, lifecycle, effective_on, supersedes_id.
- legal_versions: version_id, document_id, SHA-256 digest, signed manifest id, reviewer evidence, owner approval evidence, publication record.
- legal_actors: scoped pseudonymous actor_id, product_id, verified channel reference.
- legal_events: event_id, product_id, actor_id, event_type, exact_version_id, occurred_at, previous_hash, event_hash, minimal audit details. No updates/deletes to accepted event history; manage lawful erasure separately.
- privacy_requests: case_id, product_id, category, pseudonymous actor_id, status, applicable deadline, created/updated timestamps and scope-limited evidence pointers.
- legal_holds: bounded subject scope, documented legal basis, reviewer, reassessment date and end condition.
- vendor_reviews / regulator_sources: product/jurisdiction scoped verified evidence and dates.
- notification_outbox: event and attempt IDs, minimal recipient reference, outcome, retry state and deduplication key.

## Security invariants

1. Product A's authenticated principal cannot read Product B's cases, documents awaiting review, or acceptance evidence; enforce both API authorization and PostgreSQL RLS.
2. A request reference alone is not an authorization credential. Email OTP requires expiry, one-time use and replay/rate-limit controls; sensitive exports require proportionate additional proof.
3. No public object-storage URLs, raw secrets, raw prompts or unredacted legal files in the public repository or logs.
4. Approved legal content is immutable by version; changes create new versions with independent review and owner approval. Historical acceptances never rewrite to later versions.
5. If mandatory policy delivery, signed manifest, acceptance recording or malware scanning is unavailable, block new affected actions; preserve existing rights, exit and statutory incident handling.
6. Personal legal identity/disclosure facts and third-party assertions cannot be published without source verification, qualified review and explicit owner acceptance.
7. Backup restores must reapply deletion tombstones and verify RLS, hashes and current policy manifests before resuming affected operations.

## Frontend motion and accessibility

Use the existing palette (#f7f6f2, #171816, #db4c2f, #bedb57), fluid moderate typography, meaningful 160–280ms interactions and optional low-complexity SVG animation. Prefer CSS transforms/opacity; no scroll hijacking. On coarse pointers, constrained or reduced-motion settings, use a static composition. No text or controls in decorative canvas.

## Release protocol

Audit -> exact commit baseline -> isolated change -> static/lint/unit tests -> privacy/security/reduced-motion/cross-device tests -> verified external dependencies -> exact-SHA CI -> owner go/no-go -> separate controlled production deployment -> independent legal version publication approval. A new development branch is not production authorization.

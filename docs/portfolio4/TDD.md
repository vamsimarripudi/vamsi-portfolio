# Technical Design Document — bounded services and trust architecture

## Runtime
Public: existing React/Vite/React Router on Vercel, route /legal, static published approved policy artifacts. Existing /privacy /terms /corner /track maintain compatibility.
Sensitive: **separate private legal backend repo** and verified personal Railway Node.js API; **dedicated personal Neon PostgreSQL project**. Owner legal dashboard independently authorized from public portfolio; private case evidence in separate owner-approved encrypted storage. Source, staging and production identities are isolated. Never reuse company infrastructure.
Legal publication: exact content SHA-256, reviewer hash-linked signed opinion, effective date, locale and version, signed manifest, owner cryptographic approval. Static immutable artifacts can be read despite API outage; dynamic requests fail clearly and safely.

## Product integration and authorization
Signed server-to-server contracts bind issuer, audience, product identifier, required policy version/hash, nonce, short expiry and action. Verify server-side; reject replay, wrong product, mismatched hash, revoked key or unavailable legal authority. Product registration/payment fails closed when mandatory agreements/acceptance unavailable, preserving existing rights.
Guest: rate-limited email OTP/one-time link stored as hash, session product-scoped, reference identifier not an authenticator. For sensitive export/deletion, verify requester-to-record match and lawful exceptions. Device/passkey enrollment, recovery and MFA must be genuinely tested.

## Database security
Dedicated Neon Postgres with scoped tables, least-privilege service identities, FORCE RLS and negative cross-product queries. Do not trust client-provided tenant context. Append-only per-product events with hash chaining AND protected signed external anchors; claim tamper-evident only after adversarial validation. Selective encryption plus verified keys/backups and restoration. No secrets or raw evidence in the public repository.

## Failure behavior
No approval, legal signoff, risk classification, scanning, mandatory contact role, signed manifest or secure request persistence ⇒ fail closed for the affected new operation. Public existing legal pages remain reachable where static host is working. Reference ID only after real commit. Explicitly preserve existing contracts, cancellation and mandatory incident response. Static availability is not a guarantee against Vercel/DNS outage.

## Secure publishing and operations
Read-only automation is default. Legal owner approval = fresh phishing-resistant MFA, document hash, product, scope, time window ≤10 min, immutable audit event and separate release action. No CI-based policy promotion; code change approvals do not authorize legal text publication.
Track 8:30 AM IST planned daily brief only after verified mailer/monitor. ₹5,000 new recurring budget is not a hard provider cap. Separate counsel/CA quote authorizations.
Draft additive backwards-compatible migrations and verify isolated restore before any production database change. Owner-controlled rollout with exact Git SHA, staging tests and rollback evidence.

## Nonfunctional
Existing colors #f7f6f2, #171816, #db4c2f, #bedb57. Hero moderate type and lightweight SVG/CSS, interaction 160–280ms, static low-power/mobile/reduced-motion mode. WCAG 2.2 AA test target, 320px–1920px responsive, keyboard/AT/zoom. Field Core Web Vitals targets: LCP ≤2.5s, INP ≤200ms, CLS ≤0.1 p75 when sufficient data exists. No scroll hijacking or unneeded WebGL libraries.

## Implementation gates
G0 audit & full specs; G1 public portfolio and approved-notice directory on non-prod branch; G2 separate private legal API+DB with synthetic tests; G3 owner case/auth/approval and evidence controls; G4 individual personal-product signed adapters; G5 exact-SHA staging verification, restore, accessibility, security; G6 independently owner-approved production and legal publication. Four completion statuses remain separate.
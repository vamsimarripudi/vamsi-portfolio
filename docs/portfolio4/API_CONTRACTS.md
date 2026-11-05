# Product-scoped legal API contract (future; no live endpoint)

This is a specification for the separately secured Node.js legal service, not an active API. Future /v1 paths require versioned contracts, actual service DNS, verified integration keys and owner authorization.

## Public read-only
- GET /v1/public/products: ONLY owner-authorized publicly discoverable products; excludes unannounced private registry entries.
- GET /v1/public/policies?product=slug&lang=locale: ONLY signed approved publication manifest entries, with canonical URI, status, version, content SHA-256, effective-at and updated-at.
- GET /v1/public/policies/:product/:kind/:version: exact immutable approved artifact; never generate provisional terms on request.
- These resources may be cached as public *approved text only*; not customer cases, unpublished docs or legal opinions.

## User / guest requests
- POST /v1/guest-challenges: uniform generic response; rate-limited; no account enumeration.
- POST /v1/guest-sessions: consume hashed one-time token; short session, replay prevention, product-scoped.
- POST /v1/cases: accept validated product/category/description with minimal data, secure anti-CSRF where relevant, durable DB write before generated opaque reference response. No unverified success.
- GET /v1/cases/:opaque_ref: authenticated account session or verified guest with requester-to-case match; reference alone returns no private case detail.
- POST /v1/cases/:opaque_ref/evidence/prepare: owner-approved storage/scanner availability, verified case identity, short-lived single-purpose upload credential. Fail closed otherwise.
- POST /v1/rights: authenticated and proportionate verification for access/correction/delete/withdrawal; operations may require legal hold and processor review before execution.

## Product backend integrations
- GET /v1/agreements/requirements?product&flow: signed product-service identity; response exact applicable approved version, purpose, locale and hashes.
- POST /v1/agreements/acceptances: affirmative contextual action + exact published version + actor mapping; idempotency, replay/expiry checks.
- POST /v1/consents: per-product purpose-specific grants/withdrawals; separate from contract acceptance or payment.
- Wrong signature/audience/product, stale document, offline evidence store, missing age/consent requirement => reject new protected operation, maintain existing customer rights.
- Token fields: issuer, audience, product_id, action, user_ref, issued_at, expiry, nonce, idempotency_id; verify on server, rotate secrets after approval.

## Owner restricted
- GET /v1/owner/cases, /versions, /alerts: read-only, session with strong MFA, explicit product scope.
- POST /v1/owner/versions/:id/approve: verified counsel findings, exact content hash, fresh phishing-resistant MFA challenge expiring ≤10 min, immutable event.
- POST /v1/owner/publications/:id/promote: separate signed owner release; no automatic promotion from commit or legal opinion.
- POST /v1/owner/publications/freeze: emergency stop on new publications, protecting existing accepted contracts and incident reporting.
- Sensitive actions never accepted via GET or unsigned browser/localStorage flags.

## Error states
400 invalid input; 401 no auth; 403 forbidden; 404 unknown or unauthorized case (avoid enumeration); 409 hash/version/conflict; 423 quarantined evidence; 429 abuse rate; 503 unverified mandatory dependency. All responses include safe correlation ID, no raw file path, token, private data or traceback.

## Contract tests
Valid/expired/wrong issuer/product/audience; replay; idempotency; cross-product attempt; consent withdrawal; stale version; scanner unavailable; email unavailable; content tamper; partial DB outage; legally mandated notification deadline.
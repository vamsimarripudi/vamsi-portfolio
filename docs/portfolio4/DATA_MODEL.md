# Dedicated legal database design and migration contract

**Status: PROPOSED PHYSICAL SCHEMA.** No Neon database or migration was created or modified by this branch. Physical migrations must live in a separately secured personal legal API repository and be validated in a disposable Postgres environment before approval.

## Primary normalized entities
| Table | Primary fields and constraints | Visibility |
|---|---|---|
| operators | id, identity_evidence_ref, verified_at, status | Private operator |
| products | id UUID, owner_id FK, slug UNIQUE, owner_stage, audited_stage, public_visibility | Private; filtered public projection |
| legal_documents | id, product_id FK, category, jurisdiction, language, state | Private until approved |
| document_versions | id, document_id FK, version UNIQUE per document, content_sha256 UNIQUE per version, effective_at, supersedes_id, source_commit_sha, review_ref, artifact_ref | Immutable after review |
| counsel_reviews | id, version_id, verified_professional_ref, jurisdiction, issues, review_hash, signed_at | Private |
| owner_approvals | id, version_id, exact_sha256, challenge_ref, not_after, signed_action, granted_at, revoked_at | Restricted |
| consent_events | id, product_id, purpose, actor_ref, version_id, granted_or_withdrawn, event_at, ledger_id | Product-scoped |
| agreement_events | id, product_id, policy_version_id, actor_ref, affirmative_action, accepted_at, ledger_id | Product-scoped |
| requests | id, product_id, random_public_ref UNIQUE, category, requester_ref, verification_level, deadline_at, state | Product-scoped |
| request_events | id, request_id FK, action, minimal_metadata, created_at, ledger_id | Product-scoped |
| evidence | id, request_id FK, encrypted_object_ref, content_sha256, scan_status, retention_date, legal_hold_id | Private |
| legal_holds | id, product_id, exact_scope, legal_basis, authorized_at, expires_at, reviewed_at | Private |
| data_flows | id, product_id, purpose, data_category, provider_id, retention_rule, source_evidence | Private |
| providers | id, product_id, location_reviewed_at, DPA_ref, rights_route, exit_plan, verified_status | Private |
| legal_sources | id, official_reference, issuer, issued_at, effective_at, ceased_at, source_hash | Private |
| applicability | id, product_id, source_id, legal_review_ref, conclusion, effective_from, retest_due | Private |
| security_incidents | id, product_id, noticed_at, severity, statutory_deadlines, state | Private |
| audit_events | id, product_id, sequence, event_kind, payload_digest, prev_digest, current_digest, anchor_ref, recorded_at | Append-only per product |
| owner_alerts | id, product_id nullable, severity, reference, delivery_state, event_time | Private |
| cost_controls | id, provider_ref, period, actual_amount, currency, approval_ref | Private |

All timestamps timezone-aware UTC, document effective dates represented independently from recording timestamps, and status enumerations constrained by workflow. Separate private customer identity mapping per product; do not store all-product customer profiles.

## Authorization and RLS
- PostgreSQL service role for product operations must not have superuser/BYPASSRLS and must use FORCE ROW LEVEL SECURITY where applicable.
- Identity-to-product scope derived from verified server credential, never arbitrary browser-supplied product_id or user JWT claim without validation.
- Use transaction-scoped setting or equivalent trusted credential mapping and fail closed when context absent; nested scopes cannot escape account authorization.
- Deny cross-product SELECT, INSERT, UPDATE, DELETE, inferred counts and file access. Verify with negative two-product fixtures and different roles.
- Immutable versioned docs and ledger events never overwritten; rectifications and withdrawals are appended with lawful retention/del controls.
- Tamper-evident claim requires cryptographic hash chains plus externally protected anchors, constrained writers and verified drills; hash chains in one mutable DB alone are insufficient.

## Migrations / encryption / recovery
- Use ordered, checksummed, reversible-where-feasible migrations; advisory lock for single migration runner; transactional DDL when supported.
- Enforce FK/UNIQUE/CHECK constraints, scoped indexes and RLS before enabling any access.
- Design selective field encryption for identifiable case data; envelope keys kept outside DB in approved verified key-management service. Separate signing and encryption keys.
- Sensitive bytes in verified private storage after scanner pass; Neon stores metadata/digests only.
- Off-provider encrypted backups, separately documented RPO/RTO after restoration evidence, no invented retention. Restore must reapply deletion tombstones and legal holds.
- Never connect initial dev/staging to production personal databases or use real customer records in tests.
- Static public legal artifacts can be served when backend is down; acceptance/cases must fail closed when durable verification fails.
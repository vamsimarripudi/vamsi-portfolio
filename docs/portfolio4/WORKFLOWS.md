# State machines — approved design, future implementation

## Product and policy stages are independent
Product: PLANNING → BUILDING → PRIVATE_BETA → PUBLIC_BETA → LIVE → RETIRED. Every transition needs owner-confirmed and independently evidenced status before public claim.
Policy: DRAFT → FACT_CHECKED → LEGAL_REVIEWED → ISSUES_CLOSED → OWNER_APPROVED → ARTIFACT_STAGED → PUBLICATION_AUTHORIZED → PUBLISHED → SUPERSEDED / WITHDRAWN. Revisions never mutate signed version/hash; rollback is a new approved version. No auto publish.

## User acceptance
DISCOVER_APPROVED_POLICY → PRESENT_EXACT_VERSION → INDEPENDENT_AFFIRMATIVE_ACTION → SERVER_VERIFY_CONTEXT → COMMIT_LEDGER_EVENT → GRANT_CONTEXTUAL_ENTITLEMENT (only if all unrelated requirements also pass).
Optional processing purpose and billing/mandate authorization are separately tracked; accepting product A never constitutes B acceptance. Unknown legal version or ledger outage denies new protected operations.

## Legal request / customer rights
SUBMITTED → VERIFY_IDENTITY_AS_NEEDED → TRIAGED → INVESTIGATING → [WAITING_FOR_USER / ACTION_PENDING / ESCALATED] → RESOLVED → CLOSED, with independently audited APPEALED / REOPENED transitions.
No forced account for basic complaint. Reference ID after durable write; never sufficient to access status. Account/guest verification + requester match before disclosure; stronger verification for exports/deletion. Eligibility/retention/holds/counsel review may block automatic fulfillment, not silent rejection. Statutory clocks do not stop due to dashboard outage.

## Evidence submission
CASE_AUTHORIZATION → ONE-TIME_SCOPED_UPLOAD → QUARANTINED → VALIDATE_SIZE_TYPE_BYTES → MALWARE_SCAN → APPROVED_PRIVATE_STORE → LEAST_PRIVILEGE_READ / REDACTION → RETENTION/HOLD_REVIEW → VERIFIED_REMOVAL.
Scanner, storage, ownership or access verification failure must block upload; no public file URL. Logs contain hashes/minimal metadata only. Backup restore triggers pending deletion replay.

## Legal policy change
CLASSIFY_EDITORIAL / MATERIAL_CONTRACTUAL / PRIVACY_PURPOSE → SOURCE_AND_FACT_CHECK → COUNSEL → EXACT_HASH_SIGNOFF → OWNER_PASSKEY_STEPUP → ARTIFACT_GENERATION → SIGNED_MANIFEST → INDEPENDENT_RELEASE.
Material impact means notice/reacceptance only as legally assessed; no universal forced accept/automatic change.

## Security incident
DETECT → VALIDATE_SEVERITY → SAFE_CONTAIN → FORENSIC_EVIDENCE → APPLY_VERIFIED_REPORTING_DEADLINES → NECESSARY_EXTERNAL_NOTICE → RECOVERY → POSTMORTEM.
Mandatory CERT-In/privacy/other applicable reporting cannot be delayed by missed email, owner absence, publication freeze or routine approval queue.

## Service outage
Public approved snapshots readable if static host available. Dynamic case requests never fabricate persistence. Verified email fallback offered as required. New transaction fails closed if mandatory policy/acceptance unavailable, without blocking existing cancellation, paid access or privacy rights.
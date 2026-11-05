# Verification matrix, implementation dependency plan and release contract

## Separate milestones (none achieved for new system)
1. ENGINEERING_COMPLETE: in-scope features implemented AND executed tests for full real behavior, no placeholders represented as working.
2. RELEASE_READY: exact-SHA CI, accessibility/security/performance, integration isolation, restore/drills, zero high/critical blockers.
3. PRODUCTION_VERIFIED: explicitly authorized deploy, actual live route/service observations and rollback readiness.
4. LEGAL_PUBLICATION_APPROVED: actual lawyer's reviewed exact document hash and disclosures plus fresh owner cryptographic approval, product by product. Software deploy ≠ legal publication.

## Tests & acceptance evidence
| ID | Required executed scenario | Must prove |
|---|---|---|
| BASE-01 | Git head, PR and Vercel trigger audit | No accidental production merge/deploy |
| UI-01 | Hero static/mobile/reduced motion, keyboard | No blocked CTA or overflow |
| UI-02 | Product and /legal route navigation | True labels, accessible links, no drafts |
| UI-03 | Form, dock, reading with 200% zoom | No obstructed inputs, focus or submit |
| SEO-01 | Static sitemap, canonicals, noindex and structured data | Private content not indexed |
| DB-01 | Two-product cross-access queries/updates | RLS fails closed even with missing/forged context |
| DB-02 | Hash chain tamper/independent anchor | Demonstrated tamper evidence |
| DB-03 | Backup restore + deletion replay | No restored erased data |
| AUTH-01 | Passkey step-up expired/wrong hash/replay | Approval denied |
| CASE-01 | Anonymous complaint, OTP, reference-only request | Durable receipt; no unauthorized access |
| FILE-01 | Unsupported file, malware, scanner down | Quarantine and no unscanned retrieval |
| LEG-01 | Unsigned/unreviewed/stale legal version | No publication or acceptance |
| LEG-02 | Counsel evidence + owner 10-min signature | Exact version authorized only |
| OPS-01 | Outage, statutory reporting and fallback | No fake receipt, protected rights |
| PAY-01 | Checkout legal service unavailable | Deny new protected charge; preserve existing rights |
| REL-01 | Exact release SHA, staging and rollback | Owner go/no-go evidence |

## Dependency-ordered slices
G0: read-only audit + locked decision trace + full specs (docs workstream).
G1: portfolio-only public UI: hero/nav/legal directory linking existing published notices (isolated UI branch).
G2: separate private legal API repository; verified dedicated personal Neon and Railway identities (needs separate explicit infra authorization).
G3: real owner authentication, document approval, legal evidence and cases in synthetic staging.
G4: product-specific signed adapters only after code and user-data facts verified.
G5: exact-SHA integrated CI, responsive, WCAG tests, security tests, backup and recovery, external reviews.
G6: distinct owner-approved production and legal release gates, controlled rollout and smoke verification.

## Known blockers
- Dedicated private legal backend repository, dedicated Neon project, approved storage/scanner and paid-provider allowance not provisioned/verified.
- Real personally controlled correspondence address, verified grievance roles, official email alias readiness and independent legal reviewer engagement unresolved.
- Existing portfolio policy and privacy data inventory inconsistencies need source/runtime reconciliation.
- Avenfolio Press / Living Calendar accessible source not identified.
- Vercel deployment limit/status must be rechecked; production SHA currently older.
- No test results currently prove new backend, encryption, RLS, passkeys, counsel review, recovery or legal publication.

## Handover contract
Each of 63 decisions gets module, test ID, exact SHA, observed result, owner acceptance and individual release/legal authorization where applicable. No critical/high release blockers, documented medium/low owner disposition, runbooks, dependency/license inventory, source custody, verified backup restore, actual cost reconciliation and closure acknowledgement. Proposed 30-day stabilization is not an automatic warranty or promise of background work.
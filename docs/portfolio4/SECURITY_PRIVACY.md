# Privacy and security threat model

These are required mitigations and tests, not existing certifications.

| Attack or failure | Mitigation / verification |
|---|---|
| Cross-product legal request access | Trusted product credential mapping, product-scoped authorization and FORCE RLS negative queries |
| Guessable case ID | High-entropy reference is never an authenticator; authenticated requester-to-case match |
| OTP replay / account probing | One-time hashed short-expiry tokens; uniform messaging, throttling and abuse controls |
| Forged service integration | Short-lived issuer/audience/product/action signatures and server-side nonce replay cache |
| Unauthorized legal publication | Verified lawyer review linked to SHA; fresh passkey step-up; separate release promotion; signed manifest |
| Audit history manipulation | Append-only permissions, per-product hash chain, independent protected anchors and adversarial tests |
| Malware / polyglot attachments | Quarantine, byte-level type checks, scanning fail closed, private downloads only |
| Key loss or stolen admin credentials | Passkey recovery drills, isolated signing/encryption keys, rotation, revocation, device/session logging |
| Deleted personal data reappears | Backup expiration and reapply deletion markers/holds on tested restore |
| Stale/incorrect legal document | Exact version/date/hash, static approved artifacts, change-specific review and owner activation |
| Sensitive PII in logs/analytics | Product-only minimal telemetry, no raw texts/attachments/identity documents, strict retention |
| Provider incident or legal drift | Contract verification, regulatory source authenticity, deadline-aware escalation, counsel determination |
| Cost explosion or unwanted purchase | ₹5,000 planning ceiling, ₹2,500/₹4,000 alerts, verified provider limits, owner approval |

## Data processing principles
Separate product-specific inventories, contractual bases, purposes, consent choices, processors and retention. No automatic cross-product identity, analytics or contact mixing. Avoid government ID uploads by default. Respect rights/holds/erasure. AI processing may draft but cannot autonomously contact customers or make consequential decisions; no unsupported AI model/training/accuracy claims.

## Legal and operational accountability
Qualified Indian counsel review for actual relevant law and document hashes. Professional specialist/CA engagement verified independently and paid only with approval. Grievance roles and legal address require true owner-specific evidence. Automated legal research is not legal advice; no compliance certificate without independent basis. Emergency statutory reporting remains operable even under a publication freeze.
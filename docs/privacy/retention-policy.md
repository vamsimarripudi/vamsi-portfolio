# Retention policy

## Rules used by the site

1. **Contact correspondence and tracker records:** Review for deletion, archival, or anonymization 24 months after the last meaningful interaction. Keep longer only where required for a genuine legal obligation, active security investigation, or dispute. Approved erasure requests redact the contact record, message body, and delivery recipient from the private tracker while retaining minimal non-identifying audit evidence.
2. **Spam records:** Review and delete or redact within 90 days unless they are needed for an active abuse or security investigation.
3. **Rate-limit entries:** Delete automatically through in-memory expiry after at most 15 minutes.
4. **Duplicate-submission fingerprints:** Delete automatically through in-memory expiry after at most 10 minutes.
5. **Local browser values:** Theme and optional game score remain on the visitor’s device until they clear browser data. The site does not receive these values.
6. **Provider logs:** Vercel, Neon, and Resend retention are controlled by the applicable account configuration and provider service. The owner must review those settings at least annually and after a provider change.

## Operational owner task

At least quarterly, review resolved tracker records and old contact threads in the enquiry mailbox. Delete, archive, or anonymize records outside the stated retention period, then record the review outcome in the tracker where appropriate. This repository cannot automatically delete mail held by third-party mailbox providers.
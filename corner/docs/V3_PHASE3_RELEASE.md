# Corner V3 Phase 3 — Wishes and communications

Implementation: owner-only Wishes Studio behind `CORNER_V3_WISHES=0` default. Reuses the pre-existing tested per-post scheduling/recurrence engine, with drafts, private previews, optimistic edit checks, manual publishing, duplication, and archival.

All owner mutations require an authenticated owner and same-origin checks. No email is sent from wish publication or a private preview. RSS/Atom publication feeds were completed earlier and remain unaffected. Real owner acceptance and email delivery remain separate gates.

## Consent-aware delivery outbox

- `CORNER_V3_WISH_DELIVERY=0` remains OFF by default. Only a second explicit owner action on a **published** wish queues messages, never draft save, preview or scheduling.
- Queue recipients are restricted to already verified `v3_follows` with `state=active`, `wishes` or `all` topics, and frequency `instant` or `weekly`. Email addresses stay encrypted in SQLite; list/history responses are aggregate-only. Delivery rechecks active consent and published post state immediately before send.
- A durable additive `v3-0004-wish-delivery` checksum-verified migration, unique post/subscriber pair, leased outbox, bounded batches, stable Resend idempotency references and exponential retry replace fire-and-forget email. A Monday 08:00 UTC weekly digest groups pending weekly wishes.
- Messages have an expiring per-recipient one-time unsubscribe token and clear opt-in disclosure. Disabling any of the three `WISHES`, `FOLLOW`, or `WISH_DELIVERY` flags stops dispatch.
- Actual Resend delivery and unsubscribe acceptance are **not yet externally verified**, and no subscriber is automatically enrolled. Do not enable paid/provider delivery until the opt-in sender, consent flow and production owner review are accepted.

## Subscriber eligibility and delivery capacity

- Campaign selection scans all active subscriptions for `all`/`wishes` JSON topics in SQLite before applying the 500-recipient cap, rather than discarding eligible recipients because the first 501 active subscriptions were unrelated.
- Malformed legacy topic JSON fails closed, and exceeding the campaign cap refuses the entire batch before inserting anything. Verified opt-in, explicit owner approval, encrypted addresses, idempotency and unsubscribe rules remain unchanged.
- Sending stays disabled in production until stable follow-key configuration and real provider/consent acceptance are verified.

## Resend provider reconciliation (Phase 3 hardening)

- Signed Resend webhooks use the raw body plus `svix-id`, `svix-timestamp` and `svix-signature` HMAC verification (five-minute timestamp tolerance), with replay-id deduplication. Only delivery state identifiers are persisted; no raw webhook bodies or subscriber emails are stored.
- The sender records Resend's returned `email_id`; provider statuses (`accepted`, `delayed`, `delivered`, `bounced`, `complained`) are tracked separately from outbox handoff. Permanent bounce or complaint suppresses the follower and blocks future campaigns. Out-of-order webhook delivery never revives a bounced address.
- Endpoint: POST `/corner/api/v1/webhooks/resend`. Production sending remains OFF until `CORNER_V3_RESEND_WEBHOOK_SECRET`, stable `CORNER_V3_FOLLOW_KEY`, verified sender, double opt-in and real provider callback acceptance have been completed. Configure only necessary Resend events; no open or click tracking is needed.

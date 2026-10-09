# Corner V3 — Phase 3 syndication release

Status: initial Phase 3 capability; approved Classic Minimal · Icon First UI unchanged.

## Published feeds

- GET and HEAD /corner/rss.xml and /corner/atom.xml (RSS 2.0 and Atom).
- The latest 40 already-published posts only, ordered newest first. Drafts, scheduled, archived and illustrative demo entries are never syndicated.
- No private account information, email addresses, analytics, or hidden notes are included.
- XML 1.0 filtering and escaping protect titles and summaries. Canonical item links are stable, while ETags require revalidation before cached content can be reused.
- Every Corner HTML page exposes RSS and Atom auto-discovery links.

## Verification and next gates

- Unit and real HTTP checks for XML injection, published-only visibility, immediate archive invalidation, content types, HEAD and ETag behavior.
- No mailing-list enrollment, Resend sends, or public notification delivery is part of this release.
- Remaining Phase 3: owner-reviewed Wishes Studio, typed email templates, consent and suppression controls, durable outbox/dispatch, opt-out, provider reconciliation and release acceptance. Do not enable them before security/email verification.

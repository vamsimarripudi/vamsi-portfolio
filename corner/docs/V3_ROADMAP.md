# Vamsi's Corner V3 — Sequential delivery plan

**Base:** GitHub master 67f16605ff159f69744bc9a78d980cc1ef2c87ce. Preserve existing owner identity, content, APIs, SSE, backups, and /corner routing. Never enable new outbound notifications without recipient opt-in.

## Phase 1 — Reader engagement
- Advanced search with category, year, tag and bounded pagination; preserve the old q-only API.
- Moderated guestbook with spam controls and explicit publication consent.
- Opt-in follow subscriptions with verified double opt-in and one-click unsubscribe.
- Reading progress and member bookmarks (reuse the existing identity/bookmark system).
- Tests: SQL query escaping, hidden draft isolation, CSRF, rate limits, consent, email retries and responsive browser behavior.

## Phase 2 — Personal publication
- Life Timeline and archive explorer using published content only; owner-managed milestones.
- Moments Gallery with image derivatives, privacy/alt text, and media quotas.
- Extend existing Now status with optional expiry and audit history.
- Curated reading collections with public/private drafts.
- Tests: draft leakage, upload validation, access permissions, image optimization, SEO, responsive layouts.

## Phase 3 — Wishes Studio and communication
- Extend existing yearly wish scheduler (do not create a second scheduler).
- Recipient consent, verified contacts, reusable multilingual email templates and provider idempotency.
- Transactional outbox, per-recipient opt-out, bounded retry/backoff, scheduling with timezone/DST safeguards.
- RSS/Atom feed from published posts only, cache validators, canonical links, safe XML escaping.
- Tests: double-send prevention, restart recovery, opt-out enforcement, DST, template injection, provider failures, RSS validity.

## Phase 4 — Owner intelligence and performance
- Privacy-conscious engagement summaries, content insights and retention controls.
- Optional multilingual content and accessible language switcher; no automatic unreviewed translation.
- Recommendations based on tags/categories without exposing private reading history.
- Profile/reader performance budget, monitoring and production acceptance.

## Release gates (each phase)
1. Feature branch, backward-compatible migrations and isolated tests.
2. Full existing Corner + portfolio CI, security regression and browser viewport matrix.
3. Production database backup/restore verified before migration.
4. Merge only when CI green; Railway deployment must report SUCCESS.
5. Live public smoke and authenticated owner acceptance before claiming complete.

**Status:** Phase 1 advanced search implementation in progress. Remaining V3 features not yet implemented.

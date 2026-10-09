# Corner V3 Phase 1 — Engineering release notes

Status: REVIEW. Existing Corner production remains the source of truth.

Implemented behind default-off flags:
- CORNER_V3_SEARCH: public /search and /archive with verified published-only filters; /api/v1/search/advanced preserves legacy /api/v1/search response.
- CORNER_V3_GUESTBOOK: public moderated note form; approved-only public list; owner/admin/moderator Studio approval queue and API.
- CORNER_V3_FOLLOW: explicit opt-in, encrypted email at rest, confirmation token, once-only unsubscribe link; messages never sent until verified. Existing Resend identity sender reused.
- CORNER_V3_READING: opt-in member reading progress, isolated by user ID; original private bookmarks unchanged.

Security:
- CSRF/Origin on all state-changing requests.
- Server-enforced role checks and MFA for non-owner moderators.
- One-time expiring verification and unsubscribe tokens, hashed in SQLite.
- No newsletter campaign sending in Phase 1; personal wish emails remain out of scope.
- A stable, dedicated `CORNER_V3_FOLLOW_ENCRYPTION_KEY` of at least 32 random characters is required if following is enabled. Store in Railway secrets; do not rotate without a re-encryption migration. Generic signup responses avoid revealing subscriber existence. Bounced recipients are suppressed.
- Additive SQLite migration on app startup; no existing table altered.
- User account export includes V3 contributions.
- Existing admin, public posts, realtime, scheduling, offsite backup behavior retained.

Production gate:
1. All baseline and new CI green.
2. Verified offsite backup and isolated restore before release.
3. Deploy code with V3 flags OFF, verify healthy revision and original routes.
4. Enable SEARCH only after public browser checks.
5. Enable GUESTBOOK and READING after owner permissions/UX acceptance.
6. Enable FOLLOW only after email opt-in/unsubscribe test in an approved inbox.
7. Roll back by disabling flags before code rollback; never drop migration tables.

Known future work: Phase 2 albums/timeline/collections; Phase 3 Wishes Studio + opt-in delivery queue + RSS/Atom; Phase 4 reviewed languages, insights and performance.

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
- FOLLOW requires a strong `SESSION_SECRET` and a separate, stable `CORNER_V3_FOLLOW_KEY` (minimum 32 characters). Keep the follow key unchanged across session-secret rotation, restarts and deploys; a key rotation needs an explicit consent-preserving migration.
- Versioned, checksummed SQLite migrations run transactionally at startup. The hardened release adds private `progress` and `progress_updated_at` columns to the existing `identity_bookmarks` table and backfills from `v3_reading_positions`; it drops no tables and deletes no existing content.
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

## Phase 0/1 hardening follow-up — October 9, 2026

- Migrations `v3-0001-engagement` and `v3-0002-bookmark-progress` are additive and checksum-verified; a changed historical migration fails closed. Rehearse the upgrade and isolated restore against a copy of the production SQLite database before enabling additional features.
- Existing member bookmarks are retained. Explicitly saved reading positions join the same private bookmark records; drafts remain inaccessible through public or member reading APIs.
- Advanced discovery now supports opaque cursor pagination; archive year lists can page beyond 40 stories. Guestbook names are optional and remain moderated. Bounced follower addresses remain suppressed.
- `CORNER_V3_SEARCH` is already reachable on the public domain as of October 9. `CORNER_V3_GUESTBOOK` and `CORNER_V3_FOLLOW` returned HTTP 404; leave them disabled until owner acceptance. `CORNER_V3_READING` requires separate authenticated verification.
- Public `/corner/api/ready` returned `backupFresh=true` and Railway reported the Phase 1 baseline deployment healthy. This freshness check is not, by itself, proof of a newly performed isolated restore on production data.
- Do not merge the hardening PR or claim final production completion until its exact HEAD CI passes, review and backup/restore gates are met, and the new deployment revision is verified. Vercel's recorded production artifact did not yet correspond to the latest GitHub master at the time of this checkpoint.

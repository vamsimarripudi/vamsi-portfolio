# Vamsi's Corner V3 — Real-user acceptance checklist

**Purpose:** Complete coding integration separately from real-user acceptance. The Classic Minimal · Icon First design, existing SQLite data and offsite backups remain locked.

## Entry gates
- GitHub master and live Railway deployment have the same SHA and all CI suites pass.
- Verify real offsite backup integrity, isolated restore/migration and one healthy production replica.
- Turn on only the flags required for a selected test cohort. **Leave live wish email delivery OFF** until sender, consent, opt-out and real provider retries have been accepted.
- Test with an owner, a verified member and a signed-out visitor. Use authorized test data rather than private conversations or arbitrary personal photos.

## Scenarios
| Phase | Scenario | Pass condition |
| --- | --- | --- |
| 0 | Owner login/logout; CSRF and session expiry; backup restore | Private routes remain protected; restore does not alter production; no data loss |
| 1 | Search/category/archive pagination | Correct stable filters, no duplicates, drafts hidden |
| 1 | Guestbook moderation, follow confirmation and unsubscribe | Submissions pending review; email only after explicit verification; opt-out blocks delivery |
| 1 | Member reading progress | Save/resume works and is private to the correct account |
| 2 | Timeline, Moments Gallery, Collections and Now | Publish/edit/revoke works, uploads strip private EXIF, WebP byte limits hold, archived originals/variants denied, Now history reflects actual public events |
| 3 | Wishes draft/preview, scheduling, timezone, recurrence, duplication | No preview sends emails, scheduling correct across timezones, no surprise publication |
| 3 | Opt-in outbox, real mail retries and weekly digest | Sender verified, recipient consent checked, idempotent delivery, one-use unsubscribe and auditable delivery results; do not enable without approval |
| 3 | RSS and Atom | Valid feeds include only published content and respond to revalidation |
| 4 | Owner Insights (7/30/90d) | No visitor identifiers, groups below threshold withheld, no third-party analytics |
| 4 | Telugu/Hindi drafts, previews, approve, revoke and stale version | Drafts never leak, stale approval gets 409, source changes hide translation, valid language/canonical/hreflang links |
| All | iPhone 320–430, tablet 768, desktop 1366+, keyboard, screen reader, reduced motion | No overflow or inaccessible buttons, owner UI matches locked design |
| Regression | `/track`, accounts, published pages, scheduler, API errors | Existing behavior preserved |

For each case record non-sensitive tester ID, build SHA, platform and viewport, steps, expected/observed result, PASS/FAIL, screenshot, defect severity and retest. No passwords, OTPs, private emails, follower lists or user content belong in public tickets.

**Release vocabulary:** code complete = merged + green CI + deployed with deliberate flags. User-accepted = genuine tester evidence and sign-off. Provider-verified = proven real consent/send/opt-out; these are separate gates.

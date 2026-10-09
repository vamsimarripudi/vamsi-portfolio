# Corner V3 — Phase 2

Status: code staged with CORNER_V3_MEMORIES disabled by default pending live acceptance.

## Implemented
- Life Timeline: published milestones, year/category filter, public story links.
- Moments Gallery: album and photo screens, lazy images, descriptive alt, native keyboard lightbox, published-only media.
- Curated Collections: owner-managed ordered reading series and published-only visibility.
- Now history: immutable snapshots of owner status edits; inactive and scheduled-private content never appears.
- Memories Studio: owner forms for milestones, albums and collections, existing Now status editor retained.
- Additive migration v3-0003-memories; original session/post/media tables and original migrations preserved.

## Image privacy
New JPEG APP1/APP13, PNG text/eXIf and WebP EXIF/XMP metadata are removed before storing photos.
Existing photos containing metadata or missing files are excluded from gallery publication. GIF photos remain ineligible.
Archived posts remove associated images from public albums automatically.

## Release gates
1. CI unit/API, role isolation, CSRF and keyboard/responsive checks green.
2. Verify new migration on an isolated production-backup restore, without modifying live data.
3. Merge, deploy code OFF to one Railway replica, confirm exact SHA, public routes and readiness.
4. Owner verifies production Studio/album UI; enable CORNER_V3_MEMORIES=1 only after approval.
5. Disable flag as rollback; never delete migration tables or change original media paths.

## Known limitation
Physical thumbnail generation/resizing is not yet included. Images are lazy-loaded but full-size, so final gallery performance/Core Web Vitals acceptance remains open.
## Privacy-safe gallery caching and Now history corrections

- Bounded 256-entry per-process media inspection cache keyed by image identity and disk fingerprint; invalidated on file changes.
- Album queries avoid duplicate media database lookups; published-post checks remain enforced even when an image was previously cached.
- Keep original image geometry on gallery cards to reduce layout shifts.
- Expired genuinely public Now updates remain historical; scheduled snapshots superseded before activation stay private.
- Three new regression tests. Full-size image bandwidth and physical thumbnail derivatives are still unoptimized; feature remains OFF pending isolated backup restore and acceptance.

## Timeline discovery at scale

- Published milestones are now keyset/cursor-paginated with a server-capped page size, stable ordering, and invalid-cursor rejection. Drafts and posts archived after linking remain private.
- Year and category remain selected across navigation and next-page links, with an accessible More milestones action. Public REST v1 accepts optional `year`, `kind`, `cursor`, `limit`.
- Acceptance regression covers 76 milestones, published-only filtering and pagination without duplicate records.

## Reproducible pre-deploy migration rehearsal

- CI now snapshots a disposable Phase 1 SQLite database with a published story and uploaded file, verifies manifest checksums, restores into an isolated directory, applies migration `v3-0003-memories`, validates SQLite integrity, and confirms existing content/media survive.
- This synthetic rehearsal **does not** demonstrate migration safety for a fresh copy of the private production snapshot. Keep real backup-restore acceptance and gallery derivative performance gates open.

## Server-side previews and production data-safety gate

- Photographs are served as metadata-free WebP derivatives in fixed widths: tile 440px (160 KiB max), card 720px (300 KB max), viewer 1600px (950 KB max). Sharp decodes and strips sensitive metadata, and over-budget conversions fail closed. Up to 32 MiB of generated previews are cached in process, not stored alongside original media or private backups.
- Media publication state is rechecked on each HTTP request. Originals and previews revalidate after 60 seconds, reducing stale caching when archived. New tests assert decoded images actually use the optimized endpoints.
- Production start-up while `CORNER_V3_MEMORIES=0` skips migration `v3-0003-memories`. The migration only runs when explicitly enabled, preserving the existing schema until a real backup rehearsal succeeds.
- An **owner-only, Origin-protected** POST `/corner/api/v1/admin/v3/memories/backup-audit` can rehearse the latest complete offsite Railway snapshot on an isolated temporary filesystem, verifying SHA256 file hashes, SQLite integrity/foreign keys and preserved record counts before and after Phase 2 migration. Results contain summary only, never PII or original snapshot bytes.
- CI tests this workflow with a synthetic offsite bucket; the actual private Railway snapshot must still be rehearsed from the deployed service before enabling public Memories. Flag remains OFF and draft PR remains unmerged until validation.

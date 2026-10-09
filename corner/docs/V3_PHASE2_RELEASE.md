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

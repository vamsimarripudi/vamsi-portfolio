# V3 Phase 4 — Privacy, Languages & Performance

Phase 4 is an additive implementation following the Phase 3 merge. Flags default OFF independently.

## Privacy-conscious insights

- Owner-only `CORNER_V3_INSIGHTS=0`, derived solely from existing first-party `analytics_events`; does not create visitor identifiers or send external tracking signals.
- 7/30/90 day windows, aggregate page views/story opens/shares, small groups suppressed under k=5, public-post-only ranked stories. Raw session IDs and visitor details are not returned.
- Existing 90-day raw retention and audit controls remain unchanged.

## Human-reviewed languages

- Translation variants for Telugu and Hindi are drafted by the owner, manually reviewed, and only published after explicit approval. Never auto-translate personal writing or serve draft translations publicly.

## Performance and accessibility

- Preserve the icon-first responsive typography and no-dependency frontend. Add CI asset budget checks, responsive layout and keyboard validation. No new third-party analytics.

## Staged data/privacy boundaries

- Flags `CORNER_V3_INSIGHTS=0` and `CORNER_V3_LANGUAGES=0` are default-OFF. Enabling Languages applies only an additive checksum-verified `v3-0005-languages` schema.
- Telugu and Hindi variants require an owner-created draft, explicit human review, and an independent publish action. Any source-article edit or archive immediately hides reviewed translations until reapproval. Article language and hreflang metadata update only on approved variants.
- Owner Insights use existing first-party events and suppress segments smaller than five. No external tracking, demographic guesses, or raw session identifiers are exposed.

## Explicit asset and media budgets

- CI enforces total first-party baseline CSS below **90 KB** and JS below **24 KB** (uncompressed) and optional Wishes below **18 KB**, Phase 4 below **13 KB**. Owner-only assets must not load on regular public pages; third-party analytics script tags are disallowed.
- Gallery continues enforcing server-side physical WebP dimensions/bytes and strict variant names. Synthetic responsive acceptance checks 320, 375, 768, 1366 and 1920 pixels, keyboard navigation, and reduced motion. These CI budgets are not a claim of real-device Core Web Vitals measurement.

## Optimistic review safety

Language publish and revoke operations require the translation revision visible when the owner initiated approval. An out-of-date browser tab receives HTTP 409, instead of approving or revoking a translation altered elsewhere. Every accepted review returns the new revision. Source-article version checks and explicit human approval remain unchanged.

## Owner Studio discoverability

The existing responsive Studio sidebar now lists Memories, Wishes, Insights and Languages when their feature flags are enabled, and only for an authenticated owner role. Standard editors, moderators and signed-out visitors never receive owner-only navigation links. The existing `admin-v3-link` class preserves the locked visual design; a dedicated regression test covers roles and OFF flags.

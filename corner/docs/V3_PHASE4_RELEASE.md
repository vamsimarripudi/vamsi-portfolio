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

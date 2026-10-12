# Vamsi's Corner: analytics, reading drop-off and GA4 implementation plan

## 1. Goal and product boundary
Replace the Studio's four basic counters with a decision-oriented reading analysis workspace. Answer: which content attracts attention, where measured reading journeys stop progressing, what device/content combinations need investigation, and what readers explicitly report about their experience. Preserve the existing compact design, fixed navigation, authentication/MFA, media, production data and deployment services.

This is a publishing/community product, not a shopping funnel. The primary outcome is useful reading followed by a voluntary reaction, share or comment. Account creation, subscription and enquiries have separate consent/security requirements and denominators. Do not invent revenue metrics, visitor identities, heatmaps or recordings.

The implementation base is master `9970ecc9ca6f3d8e13440b913cd99ee52e2c0683`. Release verification and the final deployment SHA are recorded in the implementation PR, not inferred from this plan.

## 2. Observed audit
- Studio Analytics previously showed 7-day page-view/story-open/share totals and the number of published posts. Top-story counts used a different historical window and raw IDs; those were not a journey funnel.
- The feature-gated V3 Insights page offered aggregate activity and minimum-sample story/source groups, not reading depth or journey abandonment.
- `/track/analytics` already contains a read-only GA4 Data API adapter, date ranges/comparisons and a separate enquiry-database source. A Data API adapter reads an existing property; it does not install a visitor collection tag.
- Existing GA4 credentials, property access and an owner-authenticated live GA4 report have not been verified. No measurement ID is assumed.
- Corner already collected basic pseudonymous first-party activity. The portfolio privacy notice explicitly says it does not use a visitor analytics product. This release does not add collection to the React portfolio, account pages or private workspaces.

## 3. What GA4 actually provides
GA4 is event-based measurement and reporting, not a replay of a visitor's screen or a way to know their motive. Its event model includes automatically collected, enhanced-measurement, recommended and custom events [1]. Important outcomes can be marked as key events rather than treating every page view as success [1].

| Capability | Practical question | Use in this product |
| --- | --- | --- |
| Acquisition | Where do useful visits come from? | Search/social/referral/campaign and landing-page quality after a valid GA4 connection |
| Engagement | What content and actions are observed? | Views, sessions, event counts, engagement and content-specific reading milestones |
| Key events | Which important outcomes occur? | A deliberately defined reading outcome or confirmed opt-in/enquiry, never a click mislabelled as completion |
| Funnel exploration | At which ordered step is progression not observed? | Feed → story → substantial reading → voluntary interaction, with documented entry rules [2] |
| Path exploration | Which pages/events are observed before or after a step? | Content discovery and navigation; not proof of why somebody stopped |
| Retention/cohorts | Does observed activity recur after acquisition? | Later GA4 configuration; current first-party tab identifiers do not identify returning people [3] |
| Audience/technology | Does observed behavior differ by device/language/browser/region? | Broad, privacy-respecting diagnostics, not a personal visitor directory |
| Realtime/DebugView | Is an event implementation working? | Verify actual collection and parameters before trusting reports [1] |
| Advertising/commerce | How do ads, purchases and attribution perform? | Available GA ecosystem capabilities, not relevant to enable by default here |
| Administration/data access | Are consent, access, event definitions, retention and integrations correct? | Viewer service account, safe tags, clear sources, correct timezone and export rules |

The Data API returns tables grouped by dimensions and metrics; date ranges, filters and pagination determine what the report means [4]. It does not backfill visits that were never collected. The standard enhanced-measurement scroll dimension reports 90% rather than providing a full 25/50/75/90 reading ladder automatically [5]. This product's 90% + 10 seconds rule is its own observable reading proxy, **not** the definition of a GA4 engaged session and not proof of comprehension.

## 4. Requirements and material components
| Item | Required behavior | Implementation material |
| --- | --- | --- |
| Report shell | Existing Analytics tab; fixed sidebar; compact responsive layout | Lazy `analysis-studio.js` and scoped `analysis.css` |
| Controls | Today, completed 7/28/90 days, custom up to 90 days, device and equal previous period | Server-validated date/filter contract, inclusive IST dates |
| Summary | Consented visits, recorded journeys, story visits, reading milestones, inactive visits, failures | Aggregate source-owned values, explicit low-sample states |
| Funnel | Ordered closed feed-entry cohort, not division of unrelated totals | HMAC-protected short-lived journey grouping; mature after 30 minutes of inactivity |
| Reading ladder | 25/50/75/90% of article plus at least 10 seconds of visible active time | One monotonic snapshot per page visit; no scroll-pixel history |
| Last observations | Depth buckets, page type and per-story inactive-before-50% | Explicitly labelled observations, not known exits |
| Reasons | Optional reader-selected finished/return-later/not-relevant/too-long/hard-to-read/slow-or-broken/other | Multiple choice only, no free-text capture |
| Friction | Visits with request or media failure | Allowlisted categories, no stack traces, URLs, messages or form contents |
| Quality | Earliest retained observation, retention warning, privacy threshold, source labels | No fabricated estimates or forced positive-looking numbers |
| Data export | Only the current aggregate report; suppressed values stay suppressed | CSV escaping and formula neutralization |
| Google context | Explain GA and link existing read-only GA4 screen | No new Google tag or external transmission in this release |
| Reader control | Off until explicit allow; clear refusal/revocation | Inline preferences, choice cookie, ephemeral tab storage |
| Safety | Owner-only report, strict payload, rate/body/storage limits, no cache, current-tab deletion | Existing auth/origin guards, additive observation and short-lived revocation tables |
| Verification | Unit/security/SQL, real isolated browser, responsive, production asset/auth checks | Dedicated CI workflow plus existing regression suites |

No extra database, paid chart library, analytics vendor or cloud project is needed for the first-party layer. Existing SQLite, server routes, CSS and test infrastructure are reused. A genuine Google connection later needs an actual GA4 property and web stream, numeric property ID, measurement ID for collection, service account, Google Cloud Data API access, Viewer permission and secure deployment configuration. These are different things; a `G-...` measurement ID is not the numeric Data API property ID.

## 5. Measurement contract
The implemented wire format is a bounded reading snapshot, not a stream of keystrokes or screenshots. `docs/reading-measurement-contract.json` records fields, enums, limits and planned GA mappings.

A visit has one random page token and a random tab-journey token. Both are HMAC-derived using the existing server secret before storage. A journey rotates after 30 minutes of inactivity or 24 hours maximum, and is not linked to email, account identity or other devices. The viewport device class is fixed within the journey. The server records its own timestamps, deduplicates by visit key and preserves monotonic depth/time.

Only visible time with recent interaction is counted, capped at 30 minutes per visit and bounded by server-observed elapsed time. A tab in the background does not accrue active time. This is an approximation: network loss, blocked requests and a short page can affect coverage. There is no physical attention or comprehension detector.

### Funnel denominator
Start with journeys whose first retained observation within the reporting window is a feed visit, excluding prior-window entries and still-active journeys. Count the ordered continuation to a story, then reaching 90% plus 10 seconds, then reaction/share/comment after reaching that milestone on the same story. Direct story arrivals remain visible in reading reports but are not counted as feed entrants.

Small stages and small step-to-step differences trigger whole-funnel suppression; do not infer a percentage from a withheld denominator. Other positive segments below five are hidden. This is basic minimum-sample protection, not a differential-privacy or anonymity guarantee. The UI labels tab journeys rather than unique people.

### Where and why are separate
`lastDepth` and `lastPages` mean the last recorded observation among visits/journeys inactive for at least 30 minutes. They do not establish the instant of exit. Closing a browser is not reliably observable. A reader may have found the answer, switched devices, lost their connection or returned later.

A large drop-off creates a testable hypothesis. For example, fewer mobile readers progressing beyond 25% suggests inspecting mobile layout, media load and text structure—not declaring the content uninteresting. Error signals show technical problems were observed. Optional feedback supplies a reader-stated reason but is a self-selected sample, not a cause assigned to everyone.

## 6. Consent, privacy, security and retention
Detailed reading measurement defaults off. The preferences control explains the scope before Allow. Decline and withdrawal are straightforward. Browser Do Not Track and Global Privacy Control are honored; staff accounts and recognizable bots are excluded server-side. Old basic counting remains separately labelled and now respects denial and browser privacy signals, validates event types/public paths and excludes staff.

No personal form values, comments, email, password, search strings, screen content, raw URL queries/referrers, precise location, fingerprint or screen recording is included in the new payload. Only enum values, bounded numbers and public post references are accepted. Unknown keys are rejected. Existing security infrastructure may still process IPs for rate limiting/logging; the analytics table does not store raw IPs.

Raw reading observations expire after 90 days through the existing cleanup lifecycle. The consent-choice cookie lasts 180 days; journey state is sessionStorage. Withdrawal stops collection and requests deletion of the current tab journey; earlier expired tab IDs cannot be reconstructed, so older data follows retention. A 25-hour HMAC-only revocation record prevents delayed requests from recreating a withdrawn journey. Backups have separate existing retention. No automatic public/third-party export is performed.

POST/DELETE require the existing exact-origin validation. Reports require owner authorization and `private, no-store`. Collection is bounded to 4KB/request, 90 requests/minute per existing source-IP limiter, 10,000 new page observations/day and 100,000 retained rows. Large reports reject more than 50,000 selected rows rather than silently sampling. `CORNER_READING_ANALYTICS=0` is an operational collection kill switch; no credential or database reset is needed.

GA's policy prohibits sending PII and explicitly warns that page URLs/titles and user-entered fields can contain it [6]. The first-party consent here does not authorize transmission to Google. If a collection tag is subsequently added, use a separate accurately described choice and basic consent behavior; Google's basic and advanced modes have materially different pre-consent transmission behavior [7].

## 7. Sequenced implementation and acceptance
**Phase A — audit and contract:** document existing counters, privacy/auth boundaries, primary-source GA research, event dictionary, exact denominators and testable definitions.

**Phase B — first-party source:** additive table and indexes; safe bounded upserts; payload validation; owner report; retention/current-tab deletion; old basic-event hardening. Existing posts/accounts remain unchanged.

**Phase C — reader and Studio interfaces:** opt-in preferences; lightweight snapshots; optional feedback; compact date/device/comparison controls; funnel/reading/last-observation/error/source/content panels; current CSV; accurate setup/empty/suppressed/error states and source caveats.

**Phase D — validate and release:** isolated synthetic 40→30→20→10 funnel tests; before-consent absence; DNT/GPC/withdrawal; no personal payload fields; no stale-error report; eight report viewport widths; existing Studio, media, identity, GA4 and typography regressions; CI and deployment on the same final SHA. Synthetic test observations never enter production.

**Phase E — external GA4 activation and expanded journeys:** verify actual property/stream/permissions, data source timezone, tagging/consent configuration and live report after legitimate owner sign-in. Create only approved custom dimensions/events. Verify DebugView and Realtime, then reconcile ordinary processed reports. A/B-test one suspected bottleneck at a time. Later add confirmed subscription/enquiry outcomes only with their own accurate success events and privacy review. Do not label a form start or click as successful registration, subscription, email delivery or enquiry submission.

Phases A–D are the current build. Phase E cannot be certified from repository code alone and no Google credentials are invented. Existing GA4 Data API integration remains available at `/track/analytics`; this release links it rather than duplicating it or merging its denominators into first-party counts.

## Primary research
[1] Google Analytics events, key events and validation: https://support.google.com/analytics/answer/9322688?hl=en
[2] Google Analytics funnel entry and sequence semantics: https://support.google.com/analytics/answer/9327974?hl=en
[3] Google Analytics retention overview: https://support.google.com/analytics/answer/11004084
[4] Google Analytics Data API reports: https://developers.google.com/analytics/devguides/reporting/data/v1/basics
[5] Google Analytics dimensions/metrics and percent scrolled: https://support.google.com/analytics/table/13948007?hl=en
[6] Google Analytics PII avoidance: https://support.google.com/analytics/answer/6366371?hl=en
[7] Google consent mode: https://developers.google.com/tag-platform/security/concepts/consent-mode

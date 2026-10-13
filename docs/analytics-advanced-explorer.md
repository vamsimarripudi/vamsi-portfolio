# Advanced analytics explorer — implementation and evidence contract

## Continuation, not a rebuild
Continue PR #43 / master `2aa17bd5bef5325b12713db250af4f91c9526903`. Add an Advanced Explorer to the existing Studio Analytics tab. Preserve the fixed/collapsible rail, compact typography, existing reader opt-in, database, data retention, authentication/MFA, media and live editing. No new database tables, collector fields, cookies, account identities or external analytics services are introduced.

## Delivered analytical capabilities
1. **Two explicit entry definitions:** feed-entry and story-entry funnels. Story entry includes direct arrivals; the denominators are not interchangeable. Each reports current/prior step counts, conversion and change in percentage points.
2. **Elapsed progression:** median observed seconds between qualifying stages, with at least five observations. Interaction timestamps represent the last retained qualifying action, not exact first-action latency.
3. **Device/source comparisons:** one trial per eligible story-entry journey; substantial reading is the outcome. Show counts, read rate, median active time and 95% Wilson score interval when eligible.
4. **Aggregate paths:** first four observed feed/story page types, bounded top sequences and per-journey deduplicated transition edges. No visitor trail, raw ID, content or arbitrary URL is exported.
5. **Daily reading quality:** first-story-day rate in Asia/Kolkata, with an accessible SVG and exact table. Suppressed/insufficient points are gaps, not zeroes.
6. **Quality diagnostics:** excluded invalid timestamps, prior-period entry, activity continuing outside the window, inconsistent device and recently active journeys.
7. **Investigation queue:** period changes of at least 10 percentage points with at least 30 current/prior entries, or device reading gaps of at least 15 points with at least 30 entries per compared device. These are exploratory prompts, not statistical hypothesis tests or causal findings.
8. **Usable analysis controls:** keyboard-operable tabs, switchable entry/source views, URL-backed entry/tab selection, browser-session-only view preferences and a separate aggregate CSV export. Preferences contain only mode/tab/group selection, never report data.

## Why these additions, based on primary research
Google's exploration documentation distinguishes standard monitoring reports from deeper segmented journey analysis, including funnels and paths. Its path explorer uses event streams; this product has bounded page snapshots, so the implementation explicitly presents coarse page-type paths instead of pretending to offer click-level replay. The independent binomial Wilson score formula is used for an uncertainty display, not as a substitute for representative collection.

References consulted 13 October 2026:
- Google Analytics Explorations: https://support.google.com/analytics/answer/7579450
- Google Analytics funnel entry/step semantics: https://support.google.com/analytics/answer/9327974
- Google Analytics path exploration: https://support.google.com/analytics/answer/9317498
- NIST Wilson score intervals: https://www.itl.nist.gov/div898/handbook/prc/section2/prc241.htm

This is a first-party exploration layer, not GA4 itself. The existing `/track/analytics?source=ga4` integration and its unverified provider-credential/owner-session boundary remain unchanged. No Google tag is installed and no consent scope is expanded.

## Correct cohort and privacy semantics
A same-window exploration includes journeys whose retained entry is inside the window and excludes prior-window entries. It excludes observations continuing beyond the window because the mutable snapshot table cannot reconstruct their earlier state. It also excludes journeys active during the 30 minutes before the effective period end. Current and comparison periods use the same rules. These intentionally narrower cohorts may differ from the existing created-visit totals; both are labelled.

An engagement on a later substantially read story qualifies; it must not be lost just because the first story was read without interaction. This defect is corrected in the legacy funnel as well. Malformed or impossible event times do not manufacture progression.

Positive counts and complementary counts below five are withheld. A rare stage/drop suppresses the whole funnel; a rare segment outcome/complement suppresses the complete displayed partition to reduce subtraction leakage. Rates and intervals require at least 20 trials. Minimum-count suppression is **not differential privacy**, and repeated arbitrary comparisons can still create disclosure risks. This owner-only workspace never exposes raw record browsing.

Wilson intervals assume independent Bernoulli trials; short-lived browser journeys may represent repeated people, and opt-in selection is not random sampling. Therefore the interval is a descriptive uncertainty aid under stated assumptions, not a population guarantee. No interval-overlap rule is used to claim significance, and investigation prompts are not A/B tests.

A blank, absent or withheld comparison is not evidence of historical zero traffic. The daily graph must break across unavailable points. A last page remains an observation, not proof of exit. No last-seen user list, cross-device retention, attribution model or real-time visitor identity is inferred from this dataset.

## Engineering boundaries
`reading-explorer.mjs` performs a bounded, in-memory aggregation over the same owner-authorized query result used by the existing report. It has no persistence side effects. The report adds an `explorer` object. A local ES module and small scoped stylesheet load only when the enhanced report is available. Import failure leaves ordinary reports usable. Superseded requests cannot mount a stale explorer or enable stale exports.

No dependencies are added. Existing 50,000-row report bounds still apply. New pure aggregation tests include a 5,000-journey case. Original retention/withdrawal and authentication/origin tests remain in the test suite.

## Verification and release gates
- Unit tests: reference Wilson values, minimum samples, privacy complements, feed/story denominators, exact progression timings, multi-story outcomes, period-boundary exclusion, null comparison, ordered page types, ID-free serialization and bounded large inputs.
- Existing real isolated reader flow: opt-in, withdrawal, DNT, origin/owner authorization, real report/CSV, plus all four advanced tabs at mobile/tablet/desktop widths, keyboard navigation, remembered-view contents and separate advanced CSV.
- Existing Studio/live-editor/media/reflow tests remain gates. CI uses temporary accounts and databases; no synthetic observations go to production.
- Lint, root/Corner tests, production build, CI and exact production deployment/asset checks are required before claiming released. The release PR records actual run IDs, counts, commit and deployment IDs.

The user-facing browser remembers view choices only when the owner presses Remember view. This is not a shared report or scheduled alert. There is no unattended external notification and no background monitoring promise.

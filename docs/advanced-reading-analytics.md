# Advanced reading intelligence

## Scope and release boundary
Upgrade the existing Studio Analytics workspace from master `2aa17bd5bef5325b12713db250af4f91c9526903`. The design tokens, fixed sidebar, authentication/MFA, session behavior, media/live editor and existing reader consent remain. This release analyzes the existing `reading_views` snapshots. It does not add any collector fields, tracking scope, account identity, third-party transmission, database tables or npm dependencies.

The existing GA4 provider report at `/track/analytics?source=ga4` remains separate and requires its existing legitimate owner session and verified property access. Google setup is not inferred from first-party data. This work does not enable Google collection or fabricate earlier activity.

## Product requirements and completed implementation
| Area | Behavior |
| --- | --- |
| Overview | Daily current/prior SVG trends, metric selector, accessible day scrubber and drill into a day; six compact summary cards; investigation prompts |
| Funnels | Closed feed-discovery funnel plus a reading-depth ladder that includes direct story arrivals; step losses; comparative device/source rates and directional intervals |
| Paths | Aggregate forward/reverse sequences of observed feed/story page types, up to five nodes; no individual replay; immediate reloads of the same content collapse |
| Content | Rank public stories by visits, reading rate or failure rate; open a detail dialog for depth, reader-stated reasons and timing; median/P75 active time |
| Time-of-day | Seven weekdays by four six-hour India-time blocks; reading-rate/visit cells with suppression; not a click heatmap |
| Quality | Collection switch, earliest retained observation, last-five-minute selected-cohort journey observations, caveats, prior-period coverage, failures and legacy counters |
| Workflow | Date, device, first source, entry and previous-period filters; URL state; five locally saved views; aggregate CSV; optional one-minute refresh |
| Reliability | Abort stale requests, remove listeners/timers on unmount, don't apply half-edited filters, no stale statistics on failure, pause polling for hidden pages, open dialogs, unsaved filters and repeated failures |

The native chart exposes a keyboard-controlled date inspector, not hover-only information. Tables and dialogs remain keyboard accessible. Data nulls break the chart instead of being interpolated as zero. Tabs support arrow/Home/End navigation; the selected tab and report filters are reflected in the URL. Local saved views store only filter strings, never report values, visitor records or credentials.

## Measurement semantics
### First-observation segments
Device, source and entry filters apply to a whole journey according to its first retained observation. A search arrival followed by an internally navigated story remains in the search cohort. Filtering out the internal story row would otherwise create a false drop-off. A 24-hour context window around the selected dates supports prior-entry detection; the existing client journey lifetime remains unchanged.

### Visit-start cohorts and timing
Daily charts and totals select visits by `started_at`. All milestone-based rates and ordered-funnel events require the milestone timestamp before the selected end boundary. Previously the first completed story could conceal a later qualifying interaction on another completed story; the advanced funnel accepts any same-story completion-plus-later-interaction pair in that journey.

Depth/active-time snapshots are the latest values stored for the selected visits. They are not a historical as-of reconstruction. Median/P75 **active seconds** describe stored visible, recently active time; median **elapsed seconds to 90%** is wall-clock elapsed and may include time away. Neither establishes attention or comprehension.

A completed journey is inactive for at least 30 minutes across the retrieved context, not simply missing another event. Direct story entrants remain outside the closed feed-entry denominator but are included in the reading ladder. Paths display observed page types, not all pages on the internet or known exit reasons. The last-five-minute indicator is a recent observation of a selected cohort, not a real-time count of distinct people.

### Missing data and comparisons
Unavailable pre-collection history, privacy-withheld positive samples, observed zero and operator-disabled collection are different states. No event backfill or traffic estimates are generated. Percentage changes are unavailable for partial today ranges or comparisons without sufficient retained coverage. Prior daily values align by position in an equal-length date interval, not by matching weekday. The dashboard timezone remains Asia/Kolkata.

### Rates, uncertainty and diagnostics
Use `p = successful eligible visits / eligible story visits`. Wilson score intervals use z=1.959963984540054 for nominal 95% coverage. Show them only at 30 or more observations and only when numerator, denominator, distinct-journey eligibility and complement suppression permit it. The threshold of 30 is a product display rule, not a guarantee of statistical validity.

The binomial calculation assumes independent trials. Repeat visits from a person or shared context can violate independence. Intervals therefore support directional diagnostics only: no p-values, causal claims, experiment winner, uplift promise or formal significance declaration is generated. Comparing many segments adds multiple-comparison concerns; no inference that a flag identifies the cause is made.

Simple findings require a minimum sample: a device reading-rate shift of at least 10 percentage points, or at least five reported failures and a 10% rate in at least 30 observations. Low samples get collection/reproduction guidance instead. No rule firing is not an all-clear.

### Privacy and security
Minimum-five reporting now checks distinct journeys as well as visit counts. Repeated visits from one tab cannot make its content/path metrics eligible. Small positive or complementary rate groups are suppressed, and small funnel stages/differences suppress the funnel. This is a minimum-sample protection, not differential privacy; repeatedly intersecting aggregates can still carry inference risks.

No journey/view keys, account details or individual rows are returned. Published-story joins exclude archived titles. Authorization, CSRF/origin handling, no-store responses, revocation and raw-retention lifecycle reuse existing implementation. Report processing is read-only; snapshots and consent code remain unchanged.

## Architecture and resource limits
`ReadingAnalytics.report` supports opt-in `advanced=1` with allowlisted `source` and `entry`. Existing callers without this option retain their original response. `reading-exploration.mjs` produces bounded aggregates; unknown filters return 400, and contexts over 50,000 rows return 413 rather than partial/sampled results. Existing indexes support the bounded time query. Daily and hour-block buckets are built once rather than repeatedly parsing every row per chart cell.

The Studio entry module is a small loader. `analysis-explore.js` and its scoped CSS load only when Analytics is opened. The read endpoint's existing rate limit remains. The optional auto-refresh runs once per minute while visible, pauses for an open story dialog or edited/unapplied filters, and disables itself after three repeated background failures. No outbound notification, email job, subscription or paid monitoring service is created.

CSV contains the current aggregated selection and definition caveats; nulls remain explicitly unavailable/withheld. Strings are quoted, embedded quotes escaped and formula prefixes neutralized, including leading whitespace/control characters. Saved views are filter-only, limited to five, in this browser's local storage.

## Verification requirements
- Preserve baseline tests for consent default-off, opt-in, withdrawal, DNT, origin/auth rejection, legacy API, CSV and error states.
- Exact synthetic 40→30→20→10 discovery calculation and second-completed-story interaction regression.
- First-source attribution, direct-entry inclusion/exclusion, active/prior entrants, range-end clipping, small complements and distinct-journey thresholds.
- Wilson interval numeric fixture and invalid counts; no raw IDs, no new report-side mutations, no archived titles, no oversized silently sampled response.
- All five tabs at eight widths (40 advanced layouts) plus existing eight report layouts. Actual primary-action contrast, keyboard tabs, both funnels, paths, content dialog, ranking, date drill, saved filters and CSV.
- SPA remount, late response, opt-in refresh and unapplied-filter protection.
- Existing Studio/media, identity, root build/SEO and 232-check comfort coverage.
- Final CI screenshots must be inspected and production asset/hash/auth/privacy checks performed on the same deployed SHA. Synthetic observations never enter production.

## Primary research used
- PostHog Trends: time-series comparison, property filtering and saved insight patterns. https://posthog.com/docs/product-analytics/trends/overview
- PostHog Funnels: ordered journeys and breakdown attribution. https://posthog.com/docs/product-analytics/funnels
- Google Analytics funnel API: configured steps and breakdowns; currently v1alpha, can change incompatibly, and can report sampling metadata. It is not quietly introduced as a production dependency here. https://developers.google.com/analytics/devguides/reporting/data/v1/funnels
- NIST confidence interval methods for proportions: Wilson score construction and limitations. https://www.itl.nist.gov/div898/handbook/prc/section2/prc241.htm

## Deliberately not claimed
There is no person-level retention across days/devices, click heatmap, rage-click capture, screen replay, automated causal explanation, real GA4 activation, external alert delivery, subscription/enquiry conversion instrumentation or A/B-test decision engine. Those require distinct data/consent contracts and valid provider or experimental evidence, not more labels on the present report.

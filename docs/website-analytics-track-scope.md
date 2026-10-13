# Website analytics belongs in /track

## Corrected scope
The owner requested analytics for **vamsimarripudi.me**, not only the Corner publishing module. The earlier Corner dashboards are retained as historical, separately scoped reports. This change makes `/track` the private website analytics home; `/track/analytics` also defaults to the same website source. The enquiry queue is retained at `/track/enquiries`, and existing enquiry detail URLs stay unchanged. Root queue-filter bookmarks redirect to the enquiry queue rather than being interpreted as analytics filters.

The compact icon toolbar and native audience/device/export/filter/options panels are implemented inside the React Track workspace. The Google reporting adapter stays available under More options → Other data sources, not the main header. No Corner iframe or owner-session bypass is used.

## What is measured
An explicit route allowlist covers the portfolio home, work/case-study pages, engineering, lab, writing/articles, about, resume, uses, contact, FAQ/changelog/legal pages and selected public Corner route groups. Corner post/category slugs are normalized to route groups before transmission. `/track`, admin/auth/profile/API paths, birthday share URLs, unknown routes, URL queries and fragments are not accepted as page identifiers.

After separate website opt-in, a short-lived tab journey and per-page identifier connect observed public page visits. Snapshots include an allowlisted page identifier, first broad source, viewport device class, coarse 0/25/50/75/90 depth, visible active milliseconds, an allowlisted section and selected outcome/failure flags. No form values, names, emails, message text, enquiry reference IDs, precise location, screen recordings, raw referrers or arbitrary URLs are collected.

Contact start fires when the contact form receives focus. Contact success fires only after the existing contact service returns a successful acceptance and reference; that reference is not transmitted to analytics. Failure comes from a failed submission response. Resume/profile metrics are explicitly link clicks, not proof of downloaded/opened documents. Existing enquiry records remain the authoritative contact history; consented browser outcomes are not added to those counts.

## Analysis views
- Overview: website page views, browser journeys, engaged visits (10 visible active seconds, not GA4's definition), median active time, daily trend, top pages and contact outcomes.
- Journeys: ordered Home → Work/case study → Contact → accepted enquiry; separate Contact → form started → accepted enquiry funnel includes direct arrivals. Last observed public page, section, depth and aggregate paths cover inactive journeys.
- Pages: actual public route groups, visits, engaged-visit rate and active time.
- Quality: exact scope, first retained observation, collection switch, retention, failures and interpretation limits.

Last observed is not proof of an exit or why a person stopped. Funnel completion is restricted to ordered timestamps and inactive journeys. Mutable depth/time snapshots are not a historical replay. Metrics with fewer than five distinct tab journeys, and small positive outcome complements, are withheld. These controls are not differential privacy or unique-person measurement.

Date ranges are inclusive in Asia/Kolkata. Website history is retained for 90 days; unavailable baseline/history is not labelled zero. Device/source filtering uses the first retained observation in each short-lived journey. New website history is never backfilled from the Corner reading database or from synthetic test fixtures.

## Storage, consent and security
Use the existing Track Neon PostgreSQL database and server-only TRACK_SESSION_SECRET. The additive `0002_site_analytics.sql` schema matches the idempotent initialization contract; all existing enquiry and Corner tables are preserved. HMAC-protected tokens, bounded schema, parameterized SQL and serialized writes protect deduplication and deletion races.

Detailed collection is off until the reader chooses Allow website analytics in the footer. Website consent is separate from Corner reading consent and does not authorize Google transmission. DNT/GPC, recognized bots, Track/Corner staff cookies and non-production Vercel deployments are excluded. Refusing storage or blocking the optional module cannot stop normal site browsing or contact submission.

All public writes require an accepted canonical Origin and JSON body under 2 KiB. The database-backed limiter caps 60 observations per source address/minute and 30,000 global requests/day. Only an HMAC of the provider-supplied source address enters that short-lived abuse table; raw addresses are not analytics columns. A 100,000-row cap is serialized by a transaction lock. Infrastructure/security logs are separately governed by existing providers.

A root preference cookie lasts 180 days. The random tab token rotates after 30 minutes inactivity or 24 hours. Withdrawal stops future collection and deletes the current tab's records when confirmed by the server; a 25-hour tombstone blocks late packets. Failed deletion is explicitly reported and the opaque token is retained for retry. Earlier expired tab journeys and backup copies follow their retention rather than being claimed instantly deleted.

A daily cleanup runs after the existing authenticated follow-up maintenance job. It deletes observations older than 90 days and expired limiter/revocation records. Failure is surfaced in maintenance results without breaking enquiry follow-ups. Reports also exclude out-of-retention observations. `WEBSITE_ANALYTICS=0` disables collection without disabling access to retained reports.

Private reports use the existing Track owner authorization, `private, no-store` and noindex. The public collector shares the existing metrics function slot behind an explicit rewrite and has independent validation; this does not open the private reporting branch.

## Compatibility and testing
The prior GA4 and enquiry-source report components are retained, and their API/authentication contracts are unchanged. The old enquiry queue responsive test targets `/track/enquiries`; the GA4 tests use their explicit source URL. Corner uploads, sessions, live editing and existing consented reading reports remain release gates.

The new tests use real isolated PostgreSQL (PGlite), actual React navigation and the production collector/report code with a test-only session fixture. They verify default-off behavior, SPA route changes, contact success without PII, private-route exclusion, current-journey withdrawal, ordered synthetic 40→30→20→10 cohorts, retained enquiry access and expired-session clearing. Responsive tests cover 32 tab/viewport combinations and 40 modal/viewport combinations. Test cookies/accounts/data are not production identities or traffic.

The implementation is not a live Google installation. Google property/credentials/provider reporting require their existing separate authorized verification. Release evidence must identify the final commit, CI status, Vercel/Railway deployment and whether the actual production collector/storage transaction and withdrawal were confirmed. Static code tests are not proof of production storage or owner-authenticated metrics.

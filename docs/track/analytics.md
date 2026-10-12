# Track analytics: requirements, audit and operation

## Scope and locked decisions
Continue `vamsimarripudi/vamsi-portfolio` from master `24acbf3da6e253e02deecf13f11ab4eab293d479`. `/track` remains the owner-only enquiry workspace. `/track/analytics` is an additional authenticated section, not a replacement. Keep the existing palette, sessions, OTP, contact workflow, Corner routes, databases, volumes, and security headers. No schema migration, personal-data export, visitor tracking tag, or production data mutation is required.

## Requirements implemented
- Today, yesterday, last 7/28/90 complete days, current/previous month, custom inclusive dates up to 366 days.
- Equal-length previous-period comparison, previous-year comparison with leap-day clamping, or no comparison. Today-containing ranges are marked incomplete.
- Real GA4 Data API reports: active/new users, sessions, views, engagement rate, key events; daily views; top channels, pages, devices, countries and events. Breakdowns show only the selected period and are bounded to ten rows. Range-level unique users come from the summary, never a sum of daily users. Engagement-rate changes use percentage points. A zero comparison baseline is labelled, never infinity.
- Independent read-only enquiry database reports: created-date cohort received/replied/completed/spam counts, daily totals, current status and intent. Counts reflect current recorded state, not an as-of historical status snapshot. Erased and erasure-pending records are excluded. No name, email, subject, message or note is queried or exported.
- GA4 presets resolve in the timezone returned by the property. Enquiry reports use Asia/Kolkata with timestamp boundaries converted in PostgreSQL. All dates and the report timezone appear in the UI and CSV.
- Compact, responsive cards, an accessible trend plus exact daily table, data-source controls, URL-backed filters, retries, session expiry handling, cancellation of superseded requests, CSV export of the displayed report, loading/empty/error/setup states without invented data.
- GA4 uses a fixed server-configured property and Google authentication library with the analytics.readonly scope. Requests are bounded, time out, coalesce, and use a bounded 60-second per-instance cache. An owner-only per-instance burst guard helps protect quota; it is not a distributed rate limiter.
- Analytics API accepts GET only, authenticates before accessing either source, validates query keys/types/lengths, rejects client property IDs, applies private/no-store, and returns sanitized failures. No provider body, token or credential is logged. CSV formulas are neutralized. Private path prefixes are excluded from the GA4 page table. The existing CSP and noindex policy are unchanged.

## Audit and sequence
1. Confirm repository/deployments, inspect existing tracker, authentication, schema and CI. Baseline: 35 tests, lint and production build passed. No analytics range API existed.
2. Add shared calendar/report utilities, independent source adapters, owner-only API and lazy-loaded UI inside the existing gate.
3. Test validation, authorization, GA4 payloads/failures/cache and SQL on an isolated PostgreSQL engine. Test the analytics screen at 12 widths and the unchanged queue at eight widths. Fix date-control accessible names found by browser tests.
4. Apply compatible lockfile fixes for the four transitive audit findings; audit returned zero findings after remediation.
5. Publish the exact tested tree, require green CI, deploy through the existing Git integration, and verify the production route and unauthorized API boundary. Do not equate deployment readiness or mocked provider tests with a verified live GA4 connection.

## GA4 connection (operator action when not already configured)
Enable the Google Analytics Data API in the Google Cloud project. Give the service account Viewer access to the existing GA4 property. Set these server-only environment variables for the Vercel project/environment being deployed:

- `GA4_PROPERTY_ID`: numeric property ID, not a `G-` measurement ID.
- `GA4_SERVICE_ACCOUNT_JSON`: the complete service-account JSON credential, kept in Vercel secret configuration only. Never commit it, expose it in a VITE_ variable, or paste it into the dashboard.

Redeploy, sign in through the existing owner OTP flow, open Analytics, select Google Analytics 4 and apply a range. Compare the same property, timezone, dates and metric definitions in Google Analytics. Test empty data, permissions and quota failures. Missing configuration is a connection-needed state, not zero traffic. Reports may be delayed, sampled, thresholded or rolled up; the UI surfaces provider caveats.

This feature reads an existing property. It does not add a measurement tag, alter consent, backfill uncollected visits, provide ecommerce reports, or claim realtime presence. Any new collection/consent implementation requires a separate validated collection brief.

## Reproducible verification
```sh
npm ci
npm run lint
npm test
npm run build
npm audit
npm install --no-save --no-package-lock playwright@1.64.0
npx playwright install chromium --with-deps
npm run dev -- --host 127.0.0.1 --port 4173
# In another terminal:
node scripts/verify-track-visual.mjs
node scripts/verify-track-analytics.mjs
```

SQL tests use disposable in-memory PGlite PostgreSQL, never the production database. Browser/provider fixtures exist only under tests/scripts and are never used by the application or deployed API. Browser fixture success does not establish live Google access. The `Verify Enquiry Tracker` workflow retains screenshots and runs both browser suites. The explicit Vercel rewrite allows direct refresh of `/track/analytics` using the existing private SPA shell.

## Release evidence boundaries
During initial implementation, configuration metadata access through the Vercel connector returned 403, so credentials could not be confirmed. Runtime source status after legitimate owner sign-in is authoritative. Do not weaken authentication or forge sessions to verify a report. Record actual commit, CI, deployment and live verification separately in the release report.

## Primary references
- https://developers.google.com/analytics/devguides/reporting/data/v1/basics
- https://developers.google.com/analytics/devguides/reporting/data/v1/api-schema
- https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/ResponseMetaData
- https://developers.google.com/identity/protocols/oauth2/service-account

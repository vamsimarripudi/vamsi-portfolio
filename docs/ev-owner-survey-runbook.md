# EV owner field research: implementation and runbook

This addition belongs to the existing personal portfolio at **vamsimarripudi.me**. It is not a KRAVIA product. It reuses the portfolio's authenticated Track workspace, Neon PostgreSQL, Vercel project and existing Vercel Cron; it requires no form-builder, analytics SaaS, map, OEM or AI provider.

## Routes

| Route | Access | Purpose |
| --- | --- | --- |
| `/ev-survey` | Interviewer holding the direct link | Mobile-first, 25-question guided interview |
| `POST /api/ev-survey` | Public, JSON with same-origin controls | Validates and saves a consented interview |
| `/track/ev-surveys` | Owner session only | Summaries, charts, owner-only interview detail |
| `GET /api/track/ev-surveys` | Owner session only | Paginated data and aggregate metrics |
| `GET /api/track/ev-surveys?format=csv` | Owner session only | UTF-8 CSV of up to 5,000 latest records |
| `DELETE /api/track/ev-surveys` | Owner session + explicit confirmation | Permanent erasure by reference |

### Field procedure

1. Explain the purpose: identifying genuine EV ownership challenges and evaluating potential software concepts. Obtain voluntary consent.
2. Start at `/ev-survey` on the interviewer's phone. Ask the exact question presented. Let the participant answer in their own words.
3. Do not coach a preferred product, exaggerate guaranteed benefits, or interpret a hypothetical price choice as an actual sale.
4. Choose response options based only on the owner's stated experience. Leave optional fields blank when appropriate.
5. Review all answers with the owner before final submission. Confirm the generated `EV-YYYY-XXXXXXXXXX` reference.
6. Open `/track/ev-surveys` by signing into the existing owner-only tracker. View single responses, problem distributions, willingness to pay and CSV.
7. Interview across car brands, cities, ownership durations, home/public charging patterns and satisfactory as well as unsatisfactory experiences.

Do **not** type Aadhaar, registration plates, addresses, medical information or other identity documents. An optional first name or nickname may be entered in its dedicated field; a phone number is permitted only in its dedicated field after the owner explicitly agrees to one research follow-up. The optional city question is city-level only. If the participant declines, stop and discard the draft.

### Questionnaire

Questions are defined once, in `shared/ev-survey.mjs`, with immutable answer keys and a version. There are 25 questions organized into six stages: Basic details, Your EV, Real experiences, Service & expense, Current solutions, Product validation. Basic details cover optional first name or nickname, consent to one research follow-up, and an optional mobile number collected only with explicit consent. The question order intentionally asks about real incidents before presenting the proposed independent repair review.

Survey answers are validated both in the browser and server. The public endpoint stores only whitelisted fields and returns a reference ID. A client-generated submission UUID makes retries idempotent, without double recording.

### Data and permissions

`db/migrations/0003_ev_owner_survey.sql` documents the database schema. The storage module ensures the same tables exist at runtime, avoiding an additional migration provider for a small research tool. If the deployed database account lacks permission to create the tables, apply the migration using the existing database deployment process before accepting submissions.

- `ev_survey_responses`: submitted answers, questionnaire version, submission UUID, consent and creation timestamps.
- `ev_survey_throttle`: pseudonymous HMAC-based rate limiting (8 submissions per connection per hour), purged after 48 hours.
- Owner access reuses `requireOwner` from `api/lib/track.js`. All dashboard, export and deletion requests enforce it server-side; client-side hiding is not a security boundary.
- The Vercel daily tracker cron removes optional names and phone numbers after 90 days and purges interviews older than 12 months; no new cron or external service is introduced.
- Drafts persist in the interviewer's browser for at most seven days and are removed after a confirmed successful submission or manual discard.
- CSV formula-like cells are prefixed to prevent execution in spreadsheet applications.

Questionnaire wording and any analytics interpretations must not suggest nationally representative findings from convenience-sample interviews. In particular, a response of "Yes" to considering a report does not establish actual willingness to pay.

### Operational checks and release gates

1. `npm ci`, `npm run lint`, `npm test`, `npm run build` all pass.
2. Check public route on mobile + dark theme; keyboard-only completion; required validation; Back/Next; answer editing; draft restore/discard.
3. Check POST `/api/ev-survey` returns 405 to GET, 415 for invalid content types, 422 for incomplete surveys and 201 with a reference for a valid sample.
4. Submit the same `submissionId` twice and verify only one database record exists.
5. Confirm anonymous GET to `/api/track/ev-surveys`, CSV and DELETE receives 401; authenticate using existing owner sign-in and verify results.
6. Test pagination, search, charts, data export, CSV injection handling, and permanent erasure.
7. Trigger approved authenticated cron in a non-production environment and verify cleanup does not interfere with enquiry follow-ups.
8. Deploy to preview, verify required existing `DATABASE_URL`, `TRACK_SESSION_SECRET` and `CRON_SECRET` privately without printing secret values, and test persistence end to end.
9. Promote only the reviewed, green release to the custom domain. Do not deploy based solely on a successful frontend build.

Privacy notice: `/privacy`, v1.3, 25 October 2026. For participant corrections or erasure, ask for the reference and email `connect@vamsimarripudi.me`.

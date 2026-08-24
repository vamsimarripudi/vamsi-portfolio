# Vamsi Personal Site

A Vite + React personal engineering profile for [vamsimarripudi.tech](https://vamsimarripudi.tech).

## Local development

```bash
npm install
npm run dev
```

The local server uses `http://localhost:5173` by default.

## Validation

```bash
npm run lint
npm run build
```

## Architecture

The site intentionally uses the existing compact structure:

- `src/App.jsx` — routes, canonical profile/project/content data, accessible interactions, route metadata, schema, and page components.
- `src/App.css` — visual tokens, responsive rules, reduced-motion alternatives, and the shared motion system.
- `src/Resilience.jsx` + `src/Resilience.css` — global toast feedback, network state, error normalization, recovery pages, and the application error boundary.
- `src/SignalRunner.jsx` — an optional local Canvas mini-game, loaded only from a recovery page.
- `public/` — CV, favicon/mark, sitemap, robots, manifest, and social preview asset.
- `vercel.json` — SPA rewrite plus proportional security headers.

No CMS or external live API is required for core portfolio content. The optional private Enquiry Tracker uses Neon PostgreSQL only for contact operations; public browsing stays functional if tracker storage is unavailable.

## Content editing

Update the central data in `src/App.jsx`:

- `profile` for public contact links.
- `projects` for verified project records only.
- `nowSnapshot` for the current focus and honest update date.
- `engineeringStages`, `engineeringDomains`, and `engineeringPrinciples` for the Phase 3 interaction content.
- `posts`, `journey`, and `changelog` for writing, progression, and verified site updates.

Do not add claims, results, technologies, screenshots, or outcomes that cannot be verified. Add real project media to `public/` only after ensuring it is optimized and has meaningful alt text where displayed.

## Routes

`/`, `/now`, `/work`, `/work/:slug`, `/engineering`, `/lab`, `/writing`, `/writing/:slug`, `/journey`, `/resume`, `/uses`, `/contact`, and `/changelog`.

The Vercel rewrite supports direct visits to client-side routes. Update `public/sitemap.xml` when creating a new public route.

## Interaction and accessibility

The engineering path, system map, principles, case-study architecture view, Lab transform, and command palette all work with buttons and keyboard focus. They use native browser features and degrade to visible static content with `prefers-reduced-motion: reduce`.

The command palette is available through Ctrl/Cmd + K. It supports partial search, arrow-key selection, Enter, Escape, focus trapping, and focus restoration. The Lab transform works only on local JSON and never evaluates code or calls external APIs.

## Resilience and recovery

The site uses one native React toast system for loading, success, warning, error, offline, and connection-restored feedback. It limits the visible stack to three and replaces repeated messages by ID. Dedicated noindex utility routes are available at `/not-found`, `/offline`, `/error`, `/maintenance`, and `/rate-limited`; unknown production paths use the generated branded `404.html` rather than the old catch-all SPA rewrite.

`NetworkWatcher` preserves readable pages when a connection drops and offers offline mode instead of forcing a redirect. `/offline` can check the lightweight local `robots.txt` resource before returning home. There is no service worker, so first-load offline availability remains browser-cache dependent. Signal Runner is local and lazy-loaded only after a visitor explicitly chooses it.

## Contact and privacy

The contact form posts to the Vercel function at `/api/contact`. Every accepted enquiry is routed to `enquiry.portfolio@vamsimarripudi.tech`, then the visitor receives a transactional acknowledgement with the same public reference ID. The owner notification uses the visitor as `Reply-To`; the visitor acknowledgement uses the enquiry mailbox as `Reply-To`.

The endpoint validates input, escapes visitor content before it enters HTML email, limits request size, keeps the existing honeypot, rate-limits requests in memory, and suppresses accidental duplicate submissions for a short period. When configured, it also creates a private Enquiry Tracker record in Neon PostgreSQL. The tracker is not public and remains available only to the authorized mailbox owner through a six-digit, one-time email verification code. If owner delivery cannot be accepted by Resend, the UI shows a direct-email fallback. If the acknowledgement fails after owner delivery, the enquiry remains accepted and the server logs the safe event.

Configure these server-side Vercel environment variables; never expose the API key in frontend code:

- `RESEND_API_KEY` — Resend server credential.
- `CONTACT_FROM_EMAIL` — verified transactional sender, for example `Vamsi Marripudi <contact@vamsimarripudi.tech>`.
- `DATABASE_URL` — Neon PostgreSQL connection string for the private tracker.
- `TRACK_OWNER_EMAIL` — must remain `enquiry.portfolio@vamsimarripudi.tech`; no other owner is supported.
- `TRACK_SESSION_SECRET` — server-side secret used to sign short-lived tracker session cookies.
- `CRON_SECRET` — server-side secret authorizing the hourly follow-up job.

## Deployment

Vercel builds `dist`, uses an SPA rewrite, and sends `X-Content-Type-Options`, `Referrer-Policy`, and a restrictive `Permissions-Policy`. Public SEO files are `robots.txt`, `sitemap.xml`, `site.webmanifest`, and `og-image.svg`.
## Private Enquiry Tracker

`/track` is a private, `noindex` owner workspace for records generated by the public contact form. It is not linked from public navigation. The only authorized owner is `enquiry.portfolio@vamsimarripudi.tech`; sign-in uses an owner-email check, a six-digit one-time code stored only as a hashed challenge, and an eight-hour signed `HttpOnly`, `Secure`, `SameSite=Strict` session cookie.

The tracker supports verified enquiry records, status and priority transitions, private notes, email-reply events, follow-up scheduling, an hourly Vercel Cron review, privacy-request records, and deliberate irreversible redaction. It does not require or expose any visitor login.

### Provision the tracker

1. Create a Neon PostgreSQL database and run `db/migrations/0001_track_crm.sql` once with your secure database tooling.
2. In Vercel, configure `DATABASE_URL`, `TRACK_SESSION_SECRET`, and `CRON_SECRET` as encrypted server-side environment variables. Set `TRACK_OWNER_EMAIL` to exactly `enquiry.portfolio@vamsimarripudi.tech`.
3. Keep `RESEND_API_KEY` and `CONTACT_FROM_EMAIL` configured as before. The contact endpoint always delivers accepted owner notifications to `enquiry.portfolio@vamsimarripudi.tech`.
4. Deploy. The Vercel Cron configuration calls `/api/track/cron/followups` hourly with the platform `CRON_SECRET` authorization header.

Never place any of these secret values in client code, Git, or chat. If the tracker database is unavailable, owner-email delivery remains the contact endpoint’s primary path and the server records a safe configuration event without logging visitor message content.
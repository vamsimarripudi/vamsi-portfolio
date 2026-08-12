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
- `public/` — CV, favicon/mark, sitemap, robots, manifest, and social preview asset.
- `vercel.json` — SPA rewrite plus proportional security headers.

No CMS, database, or external live API is required for core content. This keeps the site functional if a third party is unavailable.

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

## Contact and privacy

The contact flow uses `mailto:` and a honeypot field; it does not use a hosted backend or store submissions. A production server-side form requires a separately configured email/API endpoint, rate limiting, and environment secrets—none are included in this static app.

## Deployment

Vercel builds `dist`, uses an SPA rewrite, and sends `X-Content-Type-Options`, `Referrer-Policy`, and a restrictive `Permissions-Policy`. Public SEO files are `robots.txt`, `sitemap.xml`, `site.webmanifest`, and `og-image.svg`.
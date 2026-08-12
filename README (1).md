# Vamsi Personal Site

A Vite + React engineering profile for [vamsimarripudi.tech](https://vamsimarripudi.tech).

## Local development

```bash
npm install
npm run dev
```

The local Vite server runs at `http://localhost:5173` by default.

## Validation

```bash
npm run lint
npm run build
```

## Architecture and content

The site intentionally keeps route content, profile details, project records, capabilities, writing, and journey data in `src/App.jsx`. This makes the personal site simple to maintain without introducing a CMS or duplicate component layer. Shared visual tokens, responsive layout, motion, themes, focus states, and reduced-motion behavior live in `src/App.css`.

Projects are deliberately split into one **Featured work** record and **Earlier work**. Add real links, screenshots, architecture notes, decisions, technologies, and outcomes only when they can be verified. Do not add invented results or metrics.

## Routes

`/`, `/now`, `/work`, `/work/:slug`, `/engineering`, `/lab`, `/writing`, `/writing/:slug`, `/journey` (About), `/resume`, `/uses`, and `/contact`.

The Vercel rewrite supports direct visits to client-side routes. Public discoverability files are `public/robots.txt`, `public/sitemap.xml`, `public/site.webmanifest`, and `public/og-image.svg`.

## Media and deployment

Use real project screenshots, diagrams, or short product loops only. Keep media lightweight, provide descriptive alt text, and provide a poster/static fallback for future video. The Vercel configuration builds `dist`, serves the SPA rewrite, and adds proportionate security headers.

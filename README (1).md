# Vamsi Personal Site

A Vite + React personal engineering site for [vamsimarripudi.tech](https://vamsimarripudi.tech).

## Local development

```bash
npm install
npm run dev
```

## Validation

```bash
npm run lint
npm run build
```

## Content maintenance

The site's content model and every route are intentionally centralized in `src/App.jsx` to keep the portfolio easy to maintain. Update the `projects`, `capabilities`, `posts`, `journey`, and `profile` data near the top of that file. Global motion, theme, responsive layout, and reduced-motion rules live in `src/App.css`.

## Routes

`/`, `/now`, `/work`, `/work/:slug`, `/engineering`, `/lab`, `/writing`, `/writing/:slug`, `/journey`, `/resume`, `/uses`, `/contact`.

The Vercel rewrite supports direct visits to client-side routes. Public SEO files are `public/robots.txt` and `public/sitemap.xml`.

## Media

Use real project screenshots, diagrams, or short product loops only. Keep media lightweight, include descriptive alt text, and provide a poster/static alternative for any future video.

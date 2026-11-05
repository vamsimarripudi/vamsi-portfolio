# Portfolio 4.0 UI and interaction design

Existing identity must remain exact: warm white #f7f6f2, charcoal #171816, burnt orange #db4c2f, lime #bedb57. Dark mode existing token system retained. No oversized typography, false premium blur or decorative obstructions.

## Public screen inventory
- Home: responsive moderate headline, Living Engineering Canvas decorative layer, visible Work / Resume / Contact actions, actual PakkaFollow pre-launch status, visitor intent shortcuts.
- Work and case studies: evidence-first PakkaFollow, unnamed planning teaser, verifiable past projects, architecture and implementation reasoning, direct actions. Do not reveal unpublished product brands.
- Now, Engineering, Writing, About: factual content tied to source revisions/verified freshness.
- Contact: four or five concise adaptive enquiry categories, minimized fields, validated submission, honest status, legal complaints directed to separate real route only when available.
- /legal public directory: currently published portfolio notices only for initial slice, accessible published-only text search, exact route links, version labels sourced from existing actual documents, no new operative legal text or invented legal-review badge.
- Future version reader: only approved immutable artifacts, language/version selection, legally operative text clearly separate from explanations.
- Future private owner app: separately authenticated legal and content lanes, case queue, review diffs, counsel evidence, exact-hash approval, emergency freeze, alerts and logs.

## All state contracts
Each control has normal/hover/focus/pressed/loading/disabled/error/success states as applicable. Forms retain values on failure, announce errors in accessible text, prevent double submits, never fake success. Private access uses deny states, no data glimpses. Documents expose keyboard TOC and semantic headings; no animation in actual legal paragraphs.

## Viewport and accessibility
Test widths 320, 360, 375, 390, 430, 768, 1024, 1280, 1440, 1920. Responsive container queries, keyboard visible focus, touch target ~44px, 200% zoom, safe-area + virtual keyboard, no horizontal overflow. Mobile dock limited to content; no overlay of forms or legal reading. Preserve back/scroll/focus behavior and screen reader landmarks.

## Motion
Hero lightweight SVG/CSS nodes/edges with simple pointer response only on capable desktop, performance-gated and static/mobile fallback. Micro feedback 160–280ms, animate opacity/transform, avoid layout shift and scroll hijacking. CSS prefers-reduced-motion disables decorative motion and presents stable content immediately. No third-party WebGL/physics dependence.

## Performance acceptance
Core Web Vitals target LCP ≤2.5s, INP ≤200ms, CLS ≤0.1 measured p75 with sufficient actual data; code splitting/asset budgets empirically set. Browser-based axe/keyboard/screen reader and mobile real-device checks must be observed before completion claims.
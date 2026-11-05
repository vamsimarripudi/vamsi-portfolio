# Portfolio 4.0 — Visual and Accessibility Contract

Slice 01: implementation-specific contract, based on Q30–Q38. This document is not a claim of WCAG or Core Web Vitals certification.

## Identity and layout

- Preserve existing CSS source tokens: background #f7f6f2, ink #171816, orange #db4c2f and lime #bedb57 (plus existing dark theme).
- Hero text uses the current compact founder-engineer identity, moderate type scale, semantic headings and visible Work, Résumé and Contact actions.
- PakkaFollow is marked in development/pre-launch; unnamed future product remains planning-stage only.
- No fake product screenshots, logos, customers, code metrics or inferred capabilities.

## Living Engineering Canvas

- Passive decorative SVG only: semantic text remains readable without SVG, JavaScript or animation.
- Pointer parallax is at most ~13px and is enabled only for hover/fine pointer and non-reduced-motion settings, unless device data saver requests static behavior.
- SVG reacts via requestAnimationFrame and custom CSS properties without React rerender loops; removes listeners on unmount.
- Mobile/coarse-pointer and reduced-motion settings show a static scene; no WebGL, remote images, tracking or animation dependencies.
- Existing static hero cards and actions remain interactive and visually ahead of the background.

## Public legal index

- New /legal is deliberately noindex until owner-approved release and qualified review of its actual publication behavior.
- Initial list contains the two *existing* portfolio notices only; it does not claim that they have received new external legal approval.
- Search is local and filters only observable existing document metadata; no legal-case data or unpublished product records are downloaded.
- Legal customer request service, records and evidence uploads are not implemented and must not appear functional until verified.

## Quality acceptance

- Keyboard navigation, focus visibility, responsive 320px+ screens and Zoom 200–400%; screen reader and motion settings must be tested.
- Targets: LCP ≤2.5s, INP ≤200ms, CLS ≤0.1 at p75 where data exists. Do not report as achieved without recorded measurements.
- Existing /corner, /track, /privacy, /terms and contact endpoints remain unchanged.

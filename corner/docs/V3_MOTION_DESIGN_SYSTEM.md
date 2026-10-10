# Vamsi's Corner V3 — Motion & Design System

Scope: visual system only, covering phases 0 to 4. Approved design is Classic Minimal / Icon First: ivory canvas, monochrome icon tiles, editorial serif typography, restrained taupe and terracotta. No Bootstrap, Tailwind, GSAP, React animation packages, proprietary font downloads or new analytics.

## Shared motion primitives

- Entrance: opacity and CSS translate, 440 ms, staggered 0 / 35 / 70 / 105 ms. IntersectionObserver reveals each item once. Content stays visible without JS or when reduced motion / Save-Data is enabled.
- Press: quick 150 ms scale and subtle shadow for enabled buttons, with hover lift on mouse/fine-pointer devices only.
- Focus: clearly visible outlines and consistent contrast; no mouse-only affordances for key actions.
- Modal: existing native dialog with 280 ms entrance and backdrop. Icon-only next/previous buttons, left/right keys, horizontal swipe, photo counter, focus return and accessible captions.
- Read: passive scroll and requestAnimationFrame drive a noninteractive 3 px progress line on article pages.
- Preview: Wishes and language review display a short confirmation animation after successful user-initiated preview; no state changes beyond presentation.
- Insights: chart pillars reveal with transform only when private panel enters view. Numbers are not fabricated or artificially counted.

## Coverage by phase

Phase 0: original sign-in, layout and nav preserved, enhanced accessible controls and reduced-motion fallbacks.
Phase 1: archive/search cards and filters follow common reveal and interaction rhythm.
Phase 2: timeline, albums, collections, Now and Memories Studio. Photo lightbox supports browser keyboard and mobile gestures.
Phase 3: Wishes Studio draft, preview and scheduling forms receive consistent focus, press and status feedback.
Phase 4: private Insights panels and human-reviewed Languages editor receive consistent reveal and preview feedback.

## Quality and performance gates

Run cd corner && npm run check. Browser acceptance at 320, 375, 768, 1366 and 1920 px includes zero horizontal overflow, keyboard arrows/Escape, photo count and focus return. Test normal and reduced-motion modes. Verify both new files return HTTP 200 at /corner/motion.css and /corner/motion.js. Keep total core CSS <90 KB and core JS <24 KB uncompressed. All animations use browser primitives and are nonessential to function.

Design-only scope: no edits to auth, API contracts, database content, scheduling, subscriber delivery flags, or domain routing. This testing does not represent authenticated real-owner or Resend provider acceptance.

# Studio live editing, fixed navigation and motion

## Scope and audit
Continue the existing repository from `01bbc411fe3a80dee4addd33eaf5dab241e3bb7a`; preserve the compact typography, palette, database, sessions, MFA and provider configuration. No schema migration or new deployment service is needed.

The reported vertical void came from `.admin-main { margin:auto }` centering a short view within the tall sidebar grid row. It was not solved by smaller headings alone. The private Wishes/Memories/Insights/Languages pages also used the public header rather than the Studio shell. Wish preview used a click-triggered API request and did not automatically refresh when selecting a saved wish.

## Delivered behavior
The desktop sidebar is fixed to the viewport, with an independently scrollable navigation list when necessary. The main content starts at the top and scrolls normally. The mobile navigation is pinned as a compact horizontal bar; full labels remain available. Desktop collapse is optional and retains accessible names, active states, motion control and sign-out. All four private V3 sections reuse this shell without changing their existing server authorization.

Wish title, body, summary and symbol update immediately through safe plain-text rendering. There is no Preview button or per-keystroke network request. Selecting an existing wish and resetting the editor update the preview immediately. Saving does not reload the page; it refreshes the library and counts. Newer typing during a slow save is retained and labelled unsaved. Conflict responses preserve typed content. Publishing and email notification remain separate explicit actions. Existing post draft autosave is retained, and its preview now includes full body and symbol as well as title/summary/media.

Fields have clearer borders and focus states. Supporting controls use labelled icons without hiding primary Save/Publish meaning. GSAP 3.15.0 supplies short icon, heading, panel, number and successful-reaction feedback. It loads locally only when motion is allowed. Failed loading never prevents editing. Reduced-motion settings and a session motion toggle stop animation. Numerical animations use an aria-hidden visual copy while preserving the real accessible value; API/CSV data never comes from animated text. Reactions animate after successful server updates, not fabricated optimistic counts.

React surfaces use a source-adapted React Bits AnimatedContent component and an independent numeric animation helper. The adaptation keeps initial content visible, lazy-loads GSAP, scopes cleanup and respects reduced motion. React Bits attribution and its license are included under `src/components/react-bits/`. Corner remains server-rendered JavaScript; it was not rewritten into React solely for animation.

## Research references
Mobbin references were inspected for layout patterns, not copied assets: Linear's persistent labelled icon rail and compact header, and Kit/Skillshare split editing/preview surfaces.
- https://mobbin.com/screens/2679ae03-f852-47c3-a880-480c493c1369
- https://mobbin.com/screens/4d6501ca-c0b7-409a-8baf-6f8e65e33c5a
- https://mobbin.com/screens/ac441a17-0f94-4b07-b818-a881300d10b1
- https://gsap.com/docs/v3/GSAP/gsap.matchMedia()/
- https://gsap.com/docs/v3/GSAP/Tween/revert()/
- https://reactbits.dev/
- https://github.com/DavidHDev/react-bits/blob/main/src/content/Animations/AnimatedContent/AnimatedContent.jsx

No continuous marquees, flashing headings, mandatory animation, third-party tracking or new paid design dependencies were introduced.

## Verification
`node scripts/verify-studio-live.mjs` uses an OS-assigned local port, temporary database and real isolated owner sign-in. It covers eight viewport widths and 48 geometry checks, all primary Studio sections, fixed/collapsed navigation during document scroll, direct live typing, saved-wish selection, safe plain text, no preview requests, slow-save preservation, conflict handling, explicit publication, genuine post reaction updates, GSAP loading, reduced motion and animation-library failure.

Existing 232-check platform reflow/text-resize coverage, Track/analytics browser tests, Wishes viewports, media upload/caption/publish/gallery tests and Corner identity/feature-gate tests remain release gates. The new CI workflow retains screenshots and structured evidence. A separate release record must name the final commit, CI conclusions and actual Railway/Vercel deployment states. Local authenticated fixtures are not proof of authenticated production behavior; no production login bypass is used.

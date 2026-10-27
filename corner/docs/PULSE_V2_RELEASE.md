# Pulse v2 — review branch, no production release

Request: implement the blurred welcome overlay and a cute articulated rabbit companion; commit and push. Do not merge or deploy without later authorization.

## Included

- Native welcome dialog with 32% warm backdrop and 8px blur. The letter stays opaque. Header/close and footer actions remain visible; only the body scrolls. Escape and backdrop dismissal restore focus.
- Existing once-per-browser welcome dismissal retained. Footer control reopens it. Secondary action follows the existing authenticated profile-menu state: Create profile or My profile.
- Original layered SVG rabbit: ears, arms, feet, face, blink, breathing, upright desktop walk, mobile hops/run, seated reactions, wave, curious expression and brief happy-eye highlights. No raster downloads, third-party motion/runtime package, audio or AI inference.
- DOM-safe pathfinding bounded to viewport-safe pockets. Uses VisualViewport and respects keyboard/zoom, navigation, paragraphs, controls and dialogs. A small inline perch reserves real space on crowded layouts. Where no safe route exists, the character stays seated or exposes menu controls instead of covering content.
- Calm / Playful / Pause / Hide controls and restore action. Modes are deliberately held only for the current page, with no new browser-storage keys or analytics. Reduced-motion preference overrides animation. Private account and Studio pages remain excluded.
- One shared public live stream owned by the optional companion layer. Core app retains normal UI updates and successful action signals. Dedupe and freshness/cursor rules prevent stale/replayed events from reanimating Pulse. A like removal cannot produce a success reaction. Submitted comments are acknowledged as sent for review; public comment-created events remain moderation-gated.
- Existing profile, policies, story records, consent, API authentication and provider settings are unchanged.

## Verification

Local source syntax and six Node contracts passed. Isolated Chromium fixture passed 320, 390, 430, 768, 1366 and 1920px modal controls/layout, focus, reduced motion, input hiding, one-stream and preference checks. Clock-based movement checks verified actual changing positions and desktop walk/mobile run poses; Pause stops movement. These are not live production tests. GitHub CI additionally runs existing repository regressions and the new dedicated browser suite.

Core JS remains below the existing 24 KB uncompressed budget; optional companion has explicit size assertions. Browser screenshots are isolated fixture content, never personal production account data.

## Known behavior boundaries

This is an event-driven website character, not a conscious agent or private-message reader. No remote sentiment or typed-content analysis. Movement avoids protected controls and does not promise to cross dense content. Native browser bars and OS controls are outside the page and cannot be drawn over. Long-tab inactivity disconnects live events and stops animation. Real device Safari behavior needs owner visual acceptance in addition to automated Chromium coverage.

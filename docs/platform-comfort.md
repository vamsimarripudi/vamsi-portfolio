# Platform typography and viewport comfort

## Request and boundaries
On 12 October 2026 the owner reported oversized text and a Studio login card extending below a laptop viewport. This change applies to the existing portfolio, Corner reader, account/recovery/invitation pages, Studio/editor, V3 pages, birthday/utilities/legal surfaces, and private Track workspace. It preserves the visual identity, black icon tiles, white Corner cards, existing palette, routes, authentication, MFA, media data, feature gates and analytics behavior.

"Fit the screen" means the ordinary sign-in form, authenticator field, submit action and return link fit a normal phone/tablet/laptop viewport. It does **not** mean a fixed-height document with hidden overflow. Short landscape views, an open keyboard, text enlargement and longer validation errors must remain scrollable. Article, settings and work-queue pages remain content-driven.

## Evidence-led design decisions
W3C reflow guidance requires vertically scrolling content to work at 320 CSS pixels without unnecessary two-dimensional scrolling; local data tables may need their own horizontal scroller. Its text-resize guidance covers enlargement to 200% without losing content or functionality. Text-spacing guidance concerns the ability to tolerate user changes to line height, paragraph spacing, letter spacing and word spacing—not a requirement to author every page with those exact defaults. The Home Office typography guidance also distinguishes denser professional interfaces from public reading pages and advises retaining legible body text.

These sources informed the constraints, not the exact visual scale. The 32px title cap is this product's requested design decision, **not** a WCAG requirement or a medical claim about eye strain.

Primary references, consulted 12 October 2026:
- W3C Reflow: https://www.w3.org/WAI/WCAG22/Understanding/reflow.html
- W3C Resize Text: https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html
- W3C Text Spacing: https://www.w3.org/WAI/WCAG22/Understanding/text-spacing.html
- Home Office Typography: https://design.homeoffice.gov.uk/design-system/styles/typography

## Shared type scale
Sizes below assume the ordinary 16px browser root. Every token remains rem-based so user enlargement is preserved.

| Role | Default range |
| --- | --- |
| Page title | 24–32px |
| Studio sign-in title | 24px on phones; 28px on larger screens |
| Section title | 20–24px |
| Subheading | 18–20px |
| Reading text and form inputs | 16px |
| Supporting labels | Generally 14px; small metadata 13px |
| Key metric values | 28px |

Reading blocks use approximately 1.6–1.7 line height and a bounded measure where appropriate. Normal titles use 1.25 line height rather than compressed display typography. The shared input contract keeps fields at 16px with 44px minimum height. Important action targets are not shrunk to make the card fit.

## Audited baseline and implementation
On a 1366 × 625 CSS-pixel viewport, the old Studio sign-in title was 68.8px, its card was about 819px tall, and its submit action ended below the visible viewport. The portfolio home title was about 73px; several titles reached 88–89px on a 1920px-wide screen. After the change the Studio title is 28px and its card is approximately 510px at the same laptop viewport.

`corner/public/comfort.css` is the single shared typography contract. The portfolio imports it after its legacy styles; Corner's common page renderer links it after every conditional stylesheet. `src/Comfort.css` contains only portfolio-specific geometry so Corner does not download unrelated adapters. The Corner static allowlist explicitly serves the local stylesheet through its existing base-path routing.

The change also reduces giant hero/section padding, account decoration, card padding and redundant minimum heights. The login uses a content-sized card with automatic vertical margins: it centers when space exists and grows into ordinary document scrolling when space is constrained. The native file picker now shrinks with the editor at 320px. Password reveal controls use flex layout instead of overlapping input text. Short-screen Studio navigation remains reachable.

Obsolete heading/spacing declarations superseded in every viewport were removed from legacy styles rather than endlessly stacking competing values. The existing 90KB baseline CSS budget is retained and now explicitly includes `comfort.css`. Legacy palette, interaction, reduced-motion and visual checks remain in place.

## Verification contract
Run:

```sh
npm ci
npm run lint
npm test
npm run build
npm --prefix corner install --omit=dev --no-audit --no-fund --package-lock=false
npm --prefix corner run check
npm install --no-save --no-package-lock playwright@1.64.0
npx playwright install chromium --with-deps
node scripts/verify-platform-comfort.mjs
```

The new browser suite starts its own Vite instance and an isolated Corner database/server on OS-assigned ports. It uses randomly generated fixture credentials and the real local owner sign-in flow. It checks 14 phone, tablet, laptop, desktop and landscape viewports; sweeps public/account/private routes; checks the editor, title limits, input sizes, login fit and document overflow; and exercises 200% root text enlargement, 320px reflow, user text-spacing overrides and a shortened keyboard-like viewport.

For the controlled user-style tests only, the Playwright context permits style injection. Production CSP and application authorization are not changed. A 320px viewport is a reflow-equivalent check, not a claim that a physical browser was manually zoomed to 400%. The shortened viewport simulates available space; it is not a physical iOS/Android keyboard test.

The existing Track/GA4 responsive tests and Corner density/media-upload browser tests are regression gates. Synthetic accounts, posts and images belong only to temporary local test data. Screenshots and a structured coverage report are retained by the `Verify platform typography and viewport comfort` workflow. Live production verification, commit and deployment identifiers are recorded separately in the release PR.

This focused audit is not a certification of complete WCAG conformance and does not claim authenticated production workflows were exercised without an authorized owner session.

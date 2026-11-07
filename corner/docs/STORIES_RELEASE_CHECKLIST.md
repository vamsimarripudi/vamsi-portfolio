# Stories — QA and approval checklist

## Automated local checks (completed)

- [x] Published fiction/novel Story/Journal tags recognized, normal Journal posts excluded.
- [x] Private draft, scheduled and archived chapters omitted from public bookshelf and chapter API.
- [x] Fiction series grouped and ordered via existing JournalSeries; singleton stories remain independent.
- [x] Book/reader HTML escapes untrusted text and embedded JSON script delimiters.
- [x] Book details render chapter contents and copyright notice; absent slugs return not found.
- [x] HTTP chapter JSON returns real published text; invalid chapter returns HTTP 404.
- [x] Original paper MP3 endpoint returns audio/mpeg.
- [x] Physically accurate inverse-cosine sheet projection tested mathematically.
- [x] Touch-drag release threshold and reverse/cancel policy tested as pure logic.
- [x] Installer successfully patches disposable mock project and refuses second install.
- [x] JavaScript syntax valid.
- [x] Offline Chromium desktop/mobile DOM-injection runs: book library/detail, gesture completion/cancellation, chapter navigation, themes and accessible text with no page errors.

## Actual application and device checks (REQUIRED before deployment)

- [ ] Integrate into the latest local `master` checkout **without any commit/push/deploy**.
- [ ] `node --check src/server.mjs`, `node --check src/ui.mjs`, existing `npm test` suite all pass.
- [ ] Run app locally under both `/` and configured `/corner` base path if relevant.
- [ ] Verify published/unpublished content with a real Studio database, including a three-chapter series and external cover image.
- [ ] Verify desktop 2-page and mobile single-page layout across Safari, Chrome and Firefox, normal and large text size.
- [ ] iOS Safari real-device: drag corner slowly, reverse, release early, fast flick, multi-touch interruption and browser back gesture.
- [ ] Check the paper corner actually follows the finger position during partial turns, including on 120 Hz displays.
- [ ] Check recorded MP3 starts only after explicit sound enable and remains quiet during reading; check cancellation, landing and repeated turns.
- [ ] Verify portrait/landscape changes preserve chapter and text anchor (including device rotation during a drag).
- [ ] Verify chapter requests, resume after reload, table-of-contents, keyboard navigation and reduced-motion preferences.
- [ ] Verify screen reader continuous-text mode, keyboard focus, headings, page controls and contrast in night/sepia modes.
- [ ] Confirm no sensitive draft content in HTML, public JSON, search indexing, or inline data.
- [ ] Confirm short-lived cache behavior and no performance regressions for a large library.
- [ ] Confirm media audio permissions/licensing before publishing.
- [ ] Review and approve exact code diff, then separately authorize any commit, push, preview or production release.

## Design boundaries

This implementation does not write story text, automatically create a book in production, introduce subscription payments, remove existing journal posts, or enforce DRM against determined users. Select/copy deterrence is best-effort and accessible text reading takes priority.

## Studio integration checks (new)

### Local isolated (completed)

- [x] Owner/editor-facing Stories sidebar link and private `/admin/stories` route added to guarded installer.
- [x] Authenticated Story Studio API stays under existing `/api/admin/posts` permission policy.
- [x] Standalone and serial books created using current `posts` and `journal_series_parts` tables, without a second publication state.
- [x] Book-level title/description and chapter-level title/manuscript are separately editable.
- [x] Published-only public projection: a serial with one released and one draft chapter displays the released chapter only.
- [x] Draft saves and publish actions refuse stale versions; book metadata updates are protected from immediate same-millisecond conflicts.
- [x] Timezone-aware schedule and unschedule reuse the existing post scheduler.
- [x] Archive hides public chapter; restore recovers the previous publication state.
- [x] Studio API rejects non-fiction posts and refuses unsupported methods; errors use the existing API status scheme.
- [x] Studio cover artwork integrates with existing media uploading and media sort ordering.
- [x] Studio interface checked in desktop/mobile Chromium simulation: create novel, edit manuscript, proof preview, save; no JavaScript page errors or horizontal overflow.
- [x] Individual editorial covers use deterministic stable color palettes across both Studio and the public bookshelf.

### Must verify in actual app before release

- [ ] Real `owner`, `admin`, `editor` account access and `moderator` denial, including MFA and session expiry.
- [ ] All Story API writes with valid `Origin`; invalid Origin/CSRF protections continue to work.
- [ ] Existing Studio navigation, theme, mobile back navigation and logout controls still work on live DOM.
- [ ] Real database post creation, cover reordering, 3-chapter serial, published edit propagation and scheduling worker.
- [ ] Full app regression suite (`npm test`) and real browser HTTP integration under `/corner`.
- [ ] Concurrency after two-tab editing and interrupted file uploads; operational backups and recovery.
- [ ] Review story and cover rights and deliberate user consent to publication; publish no sample content automatically.

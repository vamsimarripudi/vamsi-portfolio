# Corner V6 — Design and motion constitution

This contract is for the V6 implementation. It is not a claim of hardware acceptance.

## Identity
Keep the VM mark, warm ivory editorial surfaces, charcoal ink, subtle copper accents, and readable serif headlines. Controls use system sans. Use the established 4/8/12/16/24/32px spacing scale. Avoid one-off inline styles and unrelated palettes.

## Motion budgets
- Feedback: 140ms
- Controls: 200ms
- Conversation sheets: 270ms
- Public document transition: 145ms exit and 195ms entry
- Gravity: 1–2.5s, one object only, opt-in
Use transforms and opacity instead of layout changes. No repeated decorative animations while reading. User's Reduced Motion and Save Data take precedence.

## Invariants
1. The article text remains in document flow and is not cloned or remounted.
2. Public multi-page transitions never intercept anchor links, browser Back/Forward, authentication or Studio.
3. A discussion sheet enhances an ordinary canonical comment link; no-JS still works.
4. A pending comment is visible only to its submitting actor, never in public counts.
5. Gravity changes only a decorative ornament and is disabled by default.
6. All forms, buttons and dialogs have keyboard focus/return, error, loading and reduced-motion states.
7. A rollout requires green GitHub CI, browser geometry and interaction tests, fresh backup, zero 5xx and matching Railway/Vercel commit SHAs.

## Motion acceptance
Home → Category → Story → Back; click article deep link, loading/slow navigation; reduced-motion; both iPhone-sized (320–430px) and desktop viewports; Escape closes dialogue; focus returns; no accidental double-submit. Physical iPhone Safari/HEVC/HDR acceptance remains a separate external gate.

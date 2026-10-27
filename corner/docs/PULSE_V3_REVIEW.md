# Pulse v3 — Doraemon interaction review

Implementation branch only. Do not merge or deploy without release approval.

## Delivered
- Newly drawn layered SVG of the requested Doraemon character: blue body, white face/belly, red nose/collar, bell, pocket, hands, feet and whiskers. No rabbit anatomy or remote asset download.
- Distance-driven stride, acceleration, anticipation and arrival; repeatable return paths; bounded exit to the viewport edge, hidden pause, smiling lean/peek and return. Crowded pages use a safe perch or remain still rather than crossing controls.
- Hover and keyboard-focus greeting, hoverable tooltip, Escape dismissal and compact non-modal menu. Touch opens the same menu without requiring hover.
- Latest/Surprise reading cards use public API posts, optional three-step tour, clear exit controls. No invented stories, fake metrics or forced navigation.
- Existing successful actions and public SSE events drive reactions. Duplicate/stale/private events and like removal do not produce false celebrations. Account and Studio remain excluded.
- Original locally synthesized bell/chime and gentle footstep sounds, off until an explicit Enable sound click. Volume cap 40%, mute, inactive-tab suspension, cleaned audio nodes. No autoplay, microphone, TTS imitation, soundtrack or network audio.
- Welcome modal and dismissal retained. Calm/Playful/Pause/Hide and restore remain current-page controls. No new browser storage, tracking, provider credentials or backend changes.

## Engineering and QA
Only optional companion JS/CSS and tests are changed. Existing core JS stays within its unchanged 24 KB budget. V3 optional JS has an explicit 50 KB raw / 16 KB gzip ceiling; CSS remains below 19 KB raw / 5 KB gzip. These budgets include the character artwork and audio synthesis; no animation library is needed.

Local Chromium verifies six viewports from 320 to 1920px, reachable modal controls, non-modal interaction cards, title/URL data, pause/hide/restore, keyboard/input safety and reduced motion. Controlled-clock tests verify actual coordinate changes and completed edge hide/peek routines, rather than merely the presence of CSS classes. Browser tests use isolated fixture data and never send fake engagement to production. Hardware iPhone Safari and subjective speaker-volume review are not claimed.

## Release boundaries
Doraemon is an established third-party character. This requested newly drawn implementation is not a representation of ownership, endorsement or a licensing agreement. Confirm appropriate public-use rights before production release. The sound design is original code-generated effects, not the character's official voice, show music or sampled audio.

Automatic GitHub preview builds may run on push. Master and production must remain unchanged until separately approved. Do not deploy this branch merely because tests are green.

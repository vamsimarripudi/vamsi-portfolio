# Approved analytics layout: icon controls and on-demand details

## Request and scope
Implement the owner-approved design from 13 October 2026 on the existing Studio Analytics workspace, starting from master `9d872f1723e5bcc69c468db9cf6111831a29340e`. Remove the prominent Google Analytics header link, replace full-text utility controls with familiar icons, move audience/device information into popups, and give charts and useful content more room. Preserve the five analytical views, fixed/collapsible navigation, filters, saved filter views, CSV, existing refresh safeguards and all authentication/privacy behavior.

The design is a presentation change, not a new tracker or a new analytics service. No schema, dependency, collection field, consent setting, provider credential or production record changes.

## Applied visual structure
- A compact date/filter trigger and five icon controls: audience, devices, export, refresh and more options. Every icon has an accessible name, title and desktop focus/hover tooltip; touch controls remain at least 44px.
- Four concise summary cards: consented page views, substantial-reading rate, median active story time and story visits. Metric names reflect actual definitions. There is no fabricated engagement total or fake sparkline.
- A primary trend and top-story list, followed by reading progression and first-source composition. Other investigation notes remain available through disclosure rather than occupying the initial viewport.
- White cards, restrained colour accents and a dark navigation rail scoped to Analytics only. The shared rail remains fixed; leaving Analytics restores other Studio surfaces' original styling.
- Native modal popups anchored near their controls on desktop and bottom-sheet layouts on mobile. Each has a close control, Escape dismissal, contained keyboard focus and focus return. Clicking interior padding does not dismiss; an actual backdrop click does.

## Popup functions
**Audience:** existing aggregate browser-journey/visit counts and source groups. The mockup's named people and initials were illustrative, not real data. The implementation does not invent a named-visitor leaderboard, link tab identifiers to accounts or imply unique-person measurement.

**Devices:** the current report's device counts, exact table and composition ring when all required values are available. Segment buttons retain the existing device-filter behavior. Withheld values do not turn into inferred percentages, residual categories or a falsely complete donut.

**Export:** the real current-report CSV action. The mockup's PDF/scheduled-report entries are not shown as working features because those workflows are not implemented. There are no placeholder controls.

**More options:** save view, saved filter presets and the existing optional one-minute foreground refresh. Google Analytics is retained only under a subordinate Data sources disclosure, using the separate authenticated report. This change does not activate or verify a Google connection.

**Date and filters:** existing inclusive date, device, source, entry and comparison controls, relocated without duplicating their state or request logic.

## Security and lifecycle
The UI consumes only the existing owner-authorized aggregate report. No extra reporting requests are issued by simply opening the audience/device popup. Automatic refresh pauses while any utility popup or story-detail dialog is open, as well as for unapplied filter changes. Manual reload and API/session failure invalidate displayed/cached aggregate panels and disable data-dependent controls. Unmount closes the dialog, releases listeners and removes scoped styling; remount leaves only one utility popup.

The CSV still uses the existing applied-filter report and formula escaping. Existing minimum-sample suppression remains authoritative. Saved views still contain only filters. A hidden or unavailable count is never presented as an estimated zero.

## Verification
New unit coverage tests donut completeness/suppression, HTML escaping, actual summary values, icon semantics, modal cleanup and bounded lazy assets. Browser coverage uses real isolated accounts and temporary data: all five advanced views at eight widths; all five utility panels at seven widths (35 popup cases); containment, Escape, return focus, outside-click behavior, foreground refresh pauses, scoped sidebar teardown and session-error cleanup. Existing consent, collection/withdrawal, media/live editing and platform reflow suites remain release gates.

Native-dialog interaction was checked against W3C's dialog pattern and example:
- https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/
- https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/examples/dialog/

This is targeted interaction verification, not a full accessibility certification. Final CI/deployment IDs and public production checks are recorded in the release PR. Authenticated production values are not claimed based on synthetic CI screenshots.

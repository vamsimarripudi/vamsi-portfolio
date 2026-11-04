# Command Chat V2 â€” implementation blueprint

Status: approved design; implementation branch started 2026-11-04.
Target: `/corner/admin#command`. Centered chat max-width 840px; retain Studio sidebar. Minimal header (search/history/new chat), workspace selector, persistent bottom composer, contextual queue and proposal cards. No metric tiles in default view.

## Motion
120â€“180ms entrance and message fade, 180â€“220ms drawer, subtle focus transition, reduced-motion support. Never animate each streamed token or force-scroll a reader. Image generation only when explicitly requested, with provider/cost/destination review and separate approval before publishing.

## Verified existing architecture
- `corner/src/owner-command.mjs`: SQLite owner_command_items, personal/kravia workspaces, versions, approval flags.
- `corner/src/command-agent.mjs`: Responses API, `store:false`, read-only bounded queue context.
- `corner/public/admin.js`: Studio views and Command dashboard.
- `corner/public/command-center.css`: existing Command styling.
- `corner/src/schema.sql`: SQLite sessions, audit events and core schema.

## Data and API
Add SQLite conversation, message, proposal, tool-event and attachment tables, with owner/workspace isolation, foreign keys, sequence and idempotency uniqueness, retention rules, and indexes. Do not duplicate the authoritative Command queue.
Proposed endpoints: `GET/POST /api/admin/command/conversations`, `GET/PATCH /api/admin/command/conversations/:id`, `GET/POS¶»§q«^
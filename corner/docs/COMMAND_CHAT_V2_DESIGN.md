# Command Chat V2 — implementation blueprint

Status: approved design; implementation branch started 2026-11-04.
Target: `/corner/admin#command`. Centered chat max-width 840px; retain Studio sidebar. Minimal header (search/history/new chat), workspace selector, persistent bottom composer, contextual queue and proposal cards. No metric tiles in default view.

## Motion
120–180ms entrance and message fade, 180–220ms drawer, subtle focus transition, reduced-motion support. Never animate each streamed token or force-scroll a reader. Image generation only when explicitly requested, with provider/cost/destination review and separate approval before publishing.

## Verified existing architecture
- `corner/src/owner-command.mjs`: SQLite owner_command_items, personal/kravia workspaces, versions, approval flags.
- `corner/src/command-agent.mjs`: Responses API, `store:false`, read-only bounded queue context.
- `corner/public/admin.js`: Studio views and Command dashboard.
- `corner/public/command-center.css`: existing Command styling.
- `corner/src/schema.sql`: SQLite sessions, audit events and core schema.

## Data and API
Add SQLite conversation, message, proposal, tool-event and attachment tables, with owner/workspace isolation, foreign keys, sequence and idempotency uniqueness, retention rules, and indexes. Do not duplicate the authoritative Command queue.
Proposed endpoints: `GET/POST /api/admin/command/conversations`, `GET/PATCH /api/admin/command/conversations/:id`, `GET/POST /api/admin/command/conversations/:id/messages`, `GET /api/admin/command/search`, `POST /api/admin/command/actions/:id/approve|reject`.
Reuse existing auth, CSRF, audit, rate limits. Read-only tools may run; all mutations produce versioned proposals requiring explicit approval, revalidation and idempotent execution.

## Implementation gates
1. Audit route wiring and store/migration behavior.
2. Add additive schema with migration and isolation tests.
3. Add conversation CRUD, durable message flow and history search.
4. Integrate existing AI agent and queue read tools; keep failures honest.
5. Replace Command markup with centered chat and contextual proposal cards.
6. Verify 1366x900, 1366x530, 390x844 and 320x844; keyboard, reduced motion, concurrency, retries and no data leakage.
7. Feature flag, CI, screenshot review, migration recovery, staged deployment and production verification.

Do not claim chat or image generation is live until end-to-end checks pass.

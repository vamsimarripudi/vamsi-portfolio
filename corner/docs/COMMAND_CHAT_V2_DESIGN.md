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

## Delivered implementation contract — 4 November 2026

The implementation lives in `command-chat-store.mjs`, `command-chat-agent.mjs`, `command-chat-service.mjs`, `command-chat-routes.mjs`, `command-chat.js`, and `command-chat.css`. The existing sidebar, queue records, authentication, Studio publisher and public Corner are retained.

### UI and persistence
The centered column is capped at 840px. The quiet header contains the selected Personal/KRAVIA workspace, history, new conversation, and conversation options. The initial view contains four compact starter prompts, not dashboard metrics. The composer is above the keyboard/safe area. Replies use plain readable text and safe, limited Markdown; actions and evidence use compact inline cards. Local unsent drafts use owner/workspace/conversation-scoped session storage; accepted messages, attachments, proposals and history are authoritative SQLite data.

Conversation history supports literal title/message search, cursor pagination, rename, archive, restore, JSON export and explicit permanent deletion. Deleting a conversation removes its private attachments but never removes independent queue records. Archive is not deletion. Retention is until explicit deletion; existing backup retention still applies to snapshots. No private prompt content is written to operational logs. Provider abuse-monitoring retention can apply even with `store:false`.

### Response delivery and motion
Responses use durable asynchronous turns with truthful stage updates and bounded polling, not token streaming. A reply is shown only when stored. The request key is retained until server acceptance is observed, including ambiguous network failures. Cancellation and retry reuse the same turn; stale attempts cannot overwrite a retry. Multi-tab conversations accept one pending turn; stale versions require reload. Pending work interrupted by restart becomes an explicit failed state, never invented success.

Entry and message reveals use 120–180ms fades, dialogs 180ms, with a restrained thinking pulse. Image generation displays an indeterminate animated surface only after explicit approval. There are no fabricated percentages. Reduced-motion preferences disable animation; readers who scroll upward are not pulled to the bottom.

### Actions and image generation
Queue reads and real recorded signals are available without an AI call. The model can propose queue creation or status changes, never execute them. The server rechecks owner, workspace, proposal version, record version and expiry at confirmation. Duplicate confirmations are idempotent. A due date creates no notification or scheduled reminder.

Image mode generates one new image from an owner-reviewed text prompt through the configured OpenAI account: `gpt-image-1.5`, 1024 × 1024, medium quality, PNG. Reference-image editing is not included and attachments are rejected for image-mode requests rather than silently ignored. A separate approval card shows provider, model, private destination and a $0.10 reserved allowance; this is not a billing quote. The initial guardrail is five generation attempts and $0.50 reserved allowance per owner per UTC day. Ambiguous provider failures are not automatically retried or treated as refunded. Generated images remain private and downloadable; they are never automatically published.

Private message attachments accept PNG/JPEG/WebP (decoded/re-encoded) and UTF-8 TXT/Markdown. Maximum three per message, 8MB image input, 100KB text, 24MP decode bound, 30 files per conversation and 256MB private-storage cap. They are stored outside public media at `DATA_DIR/command-private`, protected by owner/workspace authorization and `private,no-store` responses. Existing backup and restore scripts now preserve this separate directory and verify it through the checksum manifest.

### API and runtime controls
All routes are under `/api/admin/command`. Every conversation request carries the exact workspace. Mutations preserve the existing same-origin/CSRF boundary and session authentication. Conversation messages, turns, proposals, private files and exports are not public endpoints.

- `CORNER_COMMAND_CHAT=0`: immediate UI/API fallback to legacy Command; additive history is retained.
- `CORNER_COMMAND_AI=1` and the existing `OPENAI_API_KEY`: enable provider calls only after owner consent.
- `CORNER_COMMAND_MODEL`: preserves the existing configured model; the current default is GPT-6.1 Sol.
- `CORNER_COMMAND_IMAGES=0`: disables new image generation without disabling chat/history.
- `CORNER_COMMAND_DAILY_REQUESTS`: defaults to 100. Token reservation and rate limits fail closed.

The schema migration is additive and transactional. Back up SQLite and private files before release. A failed migration must fail startup rather than serve partially migrated state. For rollback, set the chat flag to 0 or deploy the preceding application commit; do not drop the new tables or restore an older production DB over newer writes. The migration test covers the original PR foundation schema and repeated application.

### Verification and release
`command-chat.test.mjs` tests migration, ownership, workspace isolation, idempotency, versions, failure recovery, consent, tool authority, image approval, private uploads, budgets, HTTP protections, and private-file backup/restore. `command-chat-browser.mjs` exercises 25 real HTTP/SQLite/browser checks with isolated accounts at 1366×900, 1366×530, 390×844 and 320×844. Only the external provider is a test double: no CI image charges, user mail, production mutations, or fabricated production-evidence claims.

The isolated provider preload is never imported by production and refuses to run outside `NODE_ENV=test`. The Studio CI workflow includes the new browser test and retains its screenshots. Deployment verification must separately confirm the merged commit, successful service health, and live assets. Provider contract tests do not prove account-specific quota or billing availability.

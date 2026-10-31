# Vamsi Command

Private founder control layer for Vamsi's Corner.

## Purpose

Vamsi Command reduces owner cognitive load without becoming another source of truth. It keeps only the minimum founder-level metadata needed to decide what moves next.

The underlying systems remain authoritative:
- KRAVIA corporate records stay in KRAVIA-controlled systems.
- Personal venture records stay in their own repositories/providers.
- Vamsi's Corner remains the personal publishing system.

## Workspace boundary

The Command queue supports two founder lanes:
- `personal`: personal ventures and Vamsi's Corner.
- `kravia`: founder-level routing metadata only.

Never place KRAVIA credentials, customer records, provider secrets, bank/account details, contracts, regulated records, or company operational datasets into the personal Command queue.

## Evidence states

- `verified`: directly confirmed from a current source.
- `reported`: supplied by a person or prior run but not independently confirmed now.
- `unverified`: plausible but not checked.
- `blocked`: required evidence/permission is unavailable.

The UI intentionally shows evidence state beside every command item.

## Authority classes

- `read`: research/inspection.
- `draft`: prepare content or changes without external publication.
- `write`: reversible data/code change.
- `money`: live charging, payment or money movement.
- `legal`: contracts, filings, legal/compliance commitments.
- `security`: credentials, access, auth or security-control changes.

Money, legal and security actions are never delegated solely because an AI recommendation exists.

## Owner AI

The AI advisor is disabled by default.

Required environment variables:

```
CORNER_COMMAND_AI=1
CORNER_COMMAND_MODEL=gpt-6.1-sol
OPENAI_API_KEY=<dedicated project key>
```

The API key is server-side only. It is never returned to the browser and is never written to SQLite.

The AI receives a bounded projection of the Command queue and strict instructions to use only those records as evidence. It is advisory: the endpoint returns text and does not execute external actions.

## Release safety

Vamsi Command does not replace release gates. Code changes still require exact-head tests, preview/build success, merge of the tested head, exact-SHA production deployment, runtime health and a smoke test.

## Future integrations

External-source ingestion should be added only through scoped adapters that preserve source identity, freshness, and workspace boundaries. The first release does not scrape or silently duplicate Gmail, Drive, GitHub, Railway, Vercel, banking, legal or provider data into the Command database.

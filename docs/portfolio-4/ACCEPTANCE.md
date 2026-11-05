# Slice 01 — Acceptance and Known Blocks

## Implemented in development branch (subject to CI)

- Standalone SVG/CSS engineering background, progressive desktop pointer response and reduced-motion/static behavior.
- Public legal directory only for already published portfolio Privacy and Terms; client-side title/noindex and statically prerendered noindex metadata.
- In-memory accessible document search, no network requests, no customer data reads, no new provider dependencies.
- Existing public routes retained; only new /legal route and footer link are introduced.
- No changes to Corner code, protected APIs, payments, database schemas, consent acceptance or legal policy text.

## Verification sequence

1. npm ci, npm run lint, npm test, npm run build on exact development SHA.
2. Inspect generated dist/legal/index.html robots noindex, canonical metadata and document links.
3. Manual keyboard/mobile/high zoom/reduced motion review on isolated preview.
4. Security review that /legal is static, case submissions are not implied, and existing legal content remains unchanged.
5. Review existing open PR #101 conflicts before any eventual master merge.

## Current release blockers

- No verified dedicated legal Railway service or Neon DB; no signed publication, actual legal counsel, identity verification, legal contact delivery or risk-approved evidence vault.
- Vercel deploy quota and automated release trigger must be reassessed, and owner must explicitly approve any production deployment.
- No newly effective legal policies are drafted or approved in this slice.

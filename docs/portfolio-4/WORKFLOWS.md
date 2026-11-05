# Operational Workflows and Release Gates

Version 0.1. State diagrams represent intended behavior until tests prove actual implementations.

## Portfolio publication lane

Draft -> source evidence attached -> fact verification -> preview/diff -> owner approval -> versioned Git commit -> exact-SHA CI -> separately authorized deployment -> live check. Failure returns to review without changing published facts.

## Legal document lane

Inventory existing document -> preserve exact bytes and source -> hash -> applicable legal review -> reconcile product facts -> versioned candidate -> qualified reviewer signoff -> fresh MFA approval bound to exact hash and locale -> signed publication manifest -> controlled static promotion -> live integrity check. Any changed byte invalidates the previous approval. Never publish legal drafts or backdate acceptance.

## Customer request lane

Received -> durable case record -> verified acknowledgment -> category/urgency -> verified authority when necessary -> assigned lawful response deadline -> evidence review -> human decision -> communicated outcome -> documented closure / external appeal. Anonymous general questions can be submitted without an account; sensitive case details remain authorization-protected.

## Consent and acceptance

Display actual approved product/version -> affirmative unbundled action -> durable event -> entitlement/feature proceeds. If evidence storage fails, no new entitlement. Withdrawal is a new event, not an update to the original acceptance. No automatic consent across products.

## Security incident and recovery

Detection -> contained with authorized safe actions -> evidence preservation -> assess reportable obligations -> appropriate notification on time -> isolation/restore verification -> post-incident review. Owner unavailability must not block mandatory legal reporting.

## Outage behavior

Static approved policies continue to read when legal API/database is unavailable, subject to host availability. New regulated registrations/payments fail closed if the exact policy/version/acceptance cannot be established. Customer cancellation/export and statutory response obligations must have verified alternative paths.

## Acceptance matrix

- Browser: keyboard/focus, 320px and larger, dark/light, high zoom, reduced motion, low-power fallback, route navigation.
- Integrity: unchanged published document versions, hashes, unauthorized access blocked, event append-only, fail-closed unavailable provider.
- Reliability: staged upgrades/rollbacks, recovery drills and backups verified with real evidence, scoped product isolation.
- Truthfulness: no newly effective legal documents without written review and owner-bound authorization; unverified products/claims remain unpublished.

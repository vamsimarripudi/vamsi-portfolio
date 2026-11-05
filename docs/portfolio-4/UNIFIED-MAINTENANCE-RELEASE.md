# One-process Railway maintenance reliability

The original Vercel daily cron remains in place during development. When the owner verifies the unified Railway API in production, it can be replaced by the Corner process's maintenance runner with the feature switches \`UNIFIED_PORTFOLIO_API=1\` and either \`PORTFOLIO_DAILY_MAINTENANCE=1\` or \`UNIFIED_MAINTENANCE_ENABLED=1\`.

Reliability improvements:
- Completion date is recorded in Corner's existing persistent SQLite settings and read on startup; it is not an in-memory-only flag.
- An HTTP 200 alone cannot mark a day complete. The original cron response must explicitly report \`ok=true\`, \`analyticsCleanup=complete\` and \`surveyCleanup=complete\`.
- On failed cleanup or failed persistence, the scheduler retries with bounded delay.
- No emails, retention deletes, or customer actions execute until production flags and credentials are expressly configured.

This design assumes exactly one Railway replica, as the existing persistent Corner volume requires. Do not scale to multiple writers without external lock/lease and a fresh recovery plan.

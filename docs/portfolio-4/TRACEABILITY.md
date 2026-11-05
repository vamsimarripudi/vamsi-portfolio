# Implementation Traceability — Initial Baseline

This is a candid checkpoint, not an assertion of completion.

| Slice / requirement | State | Evidence or gap |
|---|---|---|
| Q1–Q63 approved decision set | approved specification | See DECISIONS.md; individual requirements require implementation/test proof |
| Portfolio React/Vite, existing routes | observed code | Public master 251e884636eb533aaab9e92421a2376708c36855 |
| Existing /privacy and /terms | existing content | Must preserve bytes and verify historical effective versions before migration |
| Portfolio 4.0 animated canvas | not yet implemented at baseline | Initial isolated branch slice planned |
| Central /legal directory | not implemented at baseline | New public UI must not imply unreviewed policies are operative |
| Neon legal DB and RLS | not verified / not provisioned | Separate owner-approved personal database required |
| Secure legal API / owner command | not implemented in portfolio | Separate private backend repository and approved hosting required |
| Real counsel and CA signoff | not verified | Qualified counsel review, actual engagement and signoff required |
| Encrypted evidence storage / scanner | blocked | No reviewed/activated service; uploads disabled |
| Legal external email and grievance contact | not verified | Existing personal mailbox delivery and actual roles to verify |
| Vercel release | blocked pending quota and owner approval | Production deployment SHA is behind master |
| Source conflicts | constrained | Corner PR #101 open; do not modify files it owns |

## Evidence classification

Observed code != passed tests != production verified != legally reviewed != owner authorized. Defects or unavailable evidence block corresponding completion states.

## Workstream ownership

Public UI: src/App.jsx, src/components/LivingEngineeringCanvas.*, src/LegalCenter.*, src/seo.js, tests/portfolio4-*. The Corner subtree and existing legal policy bodies are unchanged. Private case evidence, secrets, signing keys and security-sensitive governance records belong only in a separately authorized private backend.

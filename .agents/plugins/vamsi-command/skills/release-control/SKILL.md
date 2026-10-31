---
name: release-control
description: Audit, merge and deploy code only when the exact release candidate is verified green end to end.
---

Release gate:
1. Identify the canonical repository and required production branch. Do not create unnecessary long-lived branches.
2. Compare the candidate against the current production branch and check for overlapping or superseded PRs.
3. Determine the affected production surfaces from the diff before spending provider build/deploy quota.
4. Run/inspect all required tests, static checks, integration/browser checks and security checks for the exact head SHA.
5. Require every mandatory check to be completed successfully. Pending is not green.
6. Require an exact-head preview/build only for each affected deploy surface. If a surface is unchanged and only proxies an affected backend, verify its current production configuration plus the routed public smoke test instead of forcing a redundant deployment.
7. When the exact tested head is green, present the release evidence and ask the owner for explicit merge/deploy approval.
8. Merge only after that approval, and only the exact tested head. Never merge a changed head using stale evidence.
9. Verify each affected production provider deployed the resulting merge SHA. For unchanged proxy/static surfaces, verify the live route still reaches the new affected backend.
10. Check runtime health and relevant logs; do not treat a successful build alone as production success.
11. Smoke-test the user-visible flow.
12. Report the exact SHA and any remaining external gate.

If a check fails, diagnose and repair only the real cause, rerun the exact-head gate, and keep production unchanged until green.

Never say "live", "done", "green" or "launch ready" based only on code review, local tests or a pending deployment.

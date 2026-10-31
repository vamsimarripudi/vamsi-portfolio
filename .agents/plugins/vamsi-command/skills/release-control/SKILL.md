---
name: release-control
description: Audit, merge and deploy code only when the exact release candidate is verified green end to end.
---

Release gate:
1. Identify the canonical repository and required production branch. Do not create unnecessary long-lived branches.
2. Compare the candidate against the current production branch and check for overlapping or superseded PRs.
3. Run/inspect all required tests, static checks, integration/browser checks and security checks for the exact head SHA.
4. Require every mandatory check to be completed successfully. Pending is not green.
5. Require the preview/build target to succeed for that exact SHA.
6. Merge only the exact tested head. Never merge a changed head using stale evidence.
7. Verify the production provider deployed the resulting merge SHA.
8. Check runtime health and relevant logs; do not treat a successful build alone as production success.
9. Smoke-test the user-visible flow.
10. Report the exact SHA and any remaining external gate.

If a check fails, diagnose and repair only the real cause, rerun the exact-head gate, and keep production unchanged until green.

Never say "live", "done", "green" or "launch ready" based only on code review, local tests or a pending deployment.

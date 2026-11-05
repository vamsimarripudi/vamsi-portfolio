# External Dependencies and Blocker Register

Status as checked 2026-11-05. This file contains **no credentials**. All configuration changes require separate authorization.

| Dependency | Evidence | Required next check | Authorization gate |
|---|---|---|---|
| GitHub portfolio | Public repo master SHA 251e884636eb533aaab9e92421a2376708c36855; open Corner PR #101 | exact head, CI, merge conflicts, preview hooks | branch work only; no automatic master merge |
| Vercel portfolio | Project vamsi-portfolio has production deployment on older SHA | quota, deployment triggers, DNS and TLS, rollback | owner-approved production promotion |
| Railway legal API | New personal legal-service allocation not confirmed | individual ownership, service isolation, quotas | owner approval before provisioning/charging |
| Neon legal DB | Dedicated personal legal instance not yet verified | exact project, connection permissions, RLS, backup/PITR limits | owner approval before DB creation or migration |
| Personal email | connect@vamsimarripudi.me referenced in current portfolio | receive and send mail, SPF/DKIM/DMARC, bounce/alert path | no unverified alias publication |
| Evidence storage and malware scanning | No approved provider established | processing terms, pricing, scanning fail-closed, deletion | uploads remain disabled |
| Legal counsel / CA | No personal-project appointment verified | credentials, conflicts, written scope, quotes, exact-version signoff | no professional signoff claim without evidence |
| Additional personal products | PakkaFollow and FileBloom repositories observed; other repo locations unconfirmed | verify operational ownership and actual active features | no policy publication or unapproved product changes |

Planning ceiling for **new recurring** expenses: ₹5,000/month (₹2,500 and ₹4,000 alerts). This is not spending authority; provider billing caps are not assumed to be hard stops.

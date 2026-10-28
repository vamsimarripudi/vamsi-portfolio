# Vamsi’s Corner — Integrated Release (28 October 2026)

The owner-approved release integrates:
- Mobile public header, compact accessible profile menu, understated icon animation and mobile Studio navigation.
- Owner-only Languages workbench with published source loading, revisions and human review.
- Owner-only Communications Studio at `/corner/admin/communications`, with real first-party member/comment/analytics data, provider status, and an opt-in category email queue.
- Domain-aligned V2 email renderers for all six categories, new/updated story variants, digest, transactional security and editorial messages.

## Routes
- `/corner/admin/communications` — owner-only dashboard.
- `/corner/api/v1/admin/communications/status` — owner data, not named anonymous viewers.
- `/corner/api/v1/admin/communications/templates` — reusable template catalog.
- `/corner/api/v1/admin/communications/preview` — read-only owner preview.
- `/corner/api/v1/admin/communications/campaigns` — explicit owner-confirmed queue.
- `/corner/api/v1/admin/v3/languages/workbench` — published stories, private translation records.
- `/corner/api/v1/admin/v3/languages/sources/:postId` — published original content.

## Communication consent gates
Marketing mail remains disabled by default: `CORNER_COMMUNICATIONS_ENABLED=0`.
Before enabling, verify signed Resend webhook, verified first-party sender, stable follower encryption key, `CORNER_V3_FOLLOW=1`, recently verified offsite restore and real opt-in audience. No registered member is silently subscribed; no story publish/edit automatically queues mail. The existing Wishes queue is protected against duplicate communications.

Emails must include working unsubscribe links, plain-text versions, no external tracking pixels, and no false one-click unsubscribe headers. Verify actual Gmail/Apple Mail/Outlook and real subscriber consent before activation.

Privacy: reader analytics are aggregate; commenter names are self-declared and member emails only appear within the owner-only dashboard.

## Release gates
Exact-head Github Actions API/identity/Studio/responsive/reading/typography tests, local unit/browser tests, successful Vercel preview, healthy production Vercel and Railway deployments on the same commit. Verify the public logo asset URL `/corner/email-vm-mark.png`.

Old unrelated draft PRs remain untouched.

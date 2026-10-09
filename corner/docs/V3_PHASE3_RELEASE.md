# Corner V3 Phase 3 — Wishes and communications

Implementation: owner-only Wishes Studio behind `CORNER_V3_WISHES=0` default. Reuses the pre-existing tested per-post scheduling/recurrence engine, with drafts, private previews, optimistic edit checks, manual publishing, duplication, and archival.

All owner mutations require an authenticated owner and same-origin checks. No email is sent from wish publication or a private preview. RSS/Atom publication feeds were completed earlier and remain unaffected. Real owner acceptance and email delivery remain separate gates.

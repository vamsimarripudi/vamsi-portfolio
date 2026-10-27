# Vamsi's Corner — Legal release review

**Prepared:** 27 October 2026 (Asia/Kolkata)  
**Scope:** Only `vamsimarripudi.me/corner`, its public publication, member account and authorized Studio.  
**Ownership:** Personal publication — **not** represented as a service of KRAVIA PRIVATE LIMITED.  
**Contact used in site notices:** `connect@vamsimarripudi.me`.  
**Status:** Original substantive policy drafts. **Legal review and operator verification required before publishing.** This file is internal implementation evidence, not a certificate of compliance.

## Public legal documents and their scope

| URL path | Topic |
| --- | --- |
| `/policies` | Trust Center and document navigation |
| `/privacy` | Data inventory, collection purposes, sharing, security, rights, storage and retention |
| `/cookies` | Cookies, session/local storage, analytics choices and withdrawal |
| `/dpdp` | Standalone India DPDP notice, itemized categories, rights and phase-in |
| `/security-retention` | Security controls, retention windows, backup behavior and deletion limitations |
| `/terms` | Conditions governing accounts, readers, comments and Studio |
| `/terms-of-use` | Acceptable use, automation limits and responsibilities |
| `/viewership` | Readers, links, quotations, photo rights and syndication |
| `/disclaimer` | Editorial opinion, future projects, media, external sites and no professional advice |
| `/community` | Comment and guestbook conduct, safety and moderation |
| `/copyright` | Copyright, attribution, permissions, takedown and review |
| `/grievances` | Requests, reporting, contact and applicable escalation |
| `/accessibility` | Keyboard, readable text, alternative content and feedback |

The user-facing legal copy is maintained by `src/legal-core.mjs` and `src/legal-community.mjs`, rendered by `src/legal-ui.mjs`, styled by `public/legal.css`. No separately maintained or conflicting public legal-content file should be added.

## Implementation evidence and policy alignment

- Accounts require an email, display name and credential hash. The identity service provides opt-in update preferences, correction, avatar controls and a user export/deletion-review process.
- Studio and member cookies are HttpOnly and SameSite Strict. A first-party pseudonymous visitor cookie supports reactions. Session metadata uses hashed identifiers; avoid claiming that no network information is processed.
- A separate reading-consent cookie controls optional detailed reading telemetry. Do Not Track and Global Privacy Control inhibit that collection. The detailed reading collector is off without an affirmative choice and reports suppress small segments.
- **Separate limitation:** the basic first-party page/story/share event endpoint can currently record limited events until an explicit refusal cookie is present. This is distinct from detailed reading analytics. Do not write that every first-party event requires advance opt-in when code does not enforce it.
- Platform-wide portfolio website analytics uses a separate consent flow and should not be conflated with Corner reading analytics.
- Posted comments can become public after moderation with the member's chosen display name. Account email, private avatar and saved reading shelf must not be represented as publicly searchable profile data.
- Resend is used for transactional email where configured; verified email-following is feature-gated. Vercel/Railway provide infrastructure, but processor contracts and deployment region arrangements need separate verification.
- Account avatar images are resized and metadata-stripped where supported. The service employs role/access checks, rate limiting, session revocation and audit events.
- Routine cleanup targets 90 days for raw basic and reading analytics events and about three days for ephemeral realtime events. Session records expire separately; offsite backups have an approximately 30-day pruning default while preserving at least two verified copies.
- A user-initiated deletion request is presently a **review workflow**, not instant purging of databases, backups and all public content.

## India DPDP legal dates and content controls

The operative texts are the *Digital Personal Data Protection Act, 2023* and *Digital Personal Data Protection Rules, 2025*. The Central Government staged commencement in **G.S.R. 843(E)** and rules **G.S.R. 846(E)** of **13 November 2025**. A subset of provisions took effect immediately, certain consent-manager matters were scheduled one year later (**13 November 2026**) and most notice, consent, Data Fiduciary and Data Principal-rights provisions were scheduled eighteen months later (**13 May 2027**). The **Digital Personal Data Protection (Removal of Difficulties) Order, 2026**, S.O. 5458(E), gazetted in October 2026, clarifies section 9(1) on data of children/persons with lawful guardians and section 10(2)(c)(ii) on data audits. It **does not accelerate commencement dates**. Check Gazette updates before each rollout. A website with drafted notices is **not thereby certified or automatically compliant**.

Sources:
- [MeitY — DPDP Rules, notification and implementation documents](https://www.meity.gov.in/documents/act-and-policies/digital-personal-data-protection-rules-2025-gDOxUjMtQWa)
- [India Code — Digital Personal Data Protection Act 2023](https://www.indiacode.nic.in/indiacode/handle/123456789/22037?view_type=browse)
- [MeitY — enforcement notification](https://www.meity.gov.in/static/uploads/2025/11/c56ceae6c383460ca69577428d36828b.pdf)
- [MeitY — DPDP Removal of Difficulties Order 2026, S.O. 5458(E)](https://www.meity.gov.in/static/uploads/2026/10/daf495a7b5798a3dfa72a944b51fc176.pdf)
- [MeitY — Information Technology and other applicable policy documents](https://www.meity.gov.in/documents/act-and-policies)

## Human verification gates before production release

1. **Operator identity and privacy contact:** confirm the operator is personally responsible and the displayed email actually receives and responds to rights, grievance and security requests. Do not identify a statutory DPO/Grievance Officer by name unless appointed and verified.
2. **Minors:** the site currently has no verifiable parental consent workflow or independently verified adult-age gate. Under-18 account eligibility must be enforced or restricted to meet the eventual applicable law; a policy statement alone is not a technical gate.
3. **Consent for basic events:** decide the lawful handling of the basic first-party analytics endpoint before the substantive DPDP duties commence. An explicit opt-in or a legally supportable alternative may be required. Review differences between the endpoint, browser prompt and published notice.
4. **Retention and restoration:** validate 90-day cleanup operation, backup deletion timing (including the at-least-two-copies exception), and how restored databases handle previously completed data requests.
5. **Processors and cross-border data:** verify the final infrastructure, providers, locations, appropriate contracts and any applicable government transfer restrictions. Do not promise India-only hosting.
6. **Request handling:** establish who acknowledges/verifies rights requests, how email evidence is protected, legal response windows, and the record of decisions. An email inbox by itself does not prove a complete regulatory grievance mechanism.
7. **Comments, security and age:** ensure the policies match actual moderation, account requirements and incident response. Preserve non-waivable rights and lawful expression.
8. **UI acceptance:** audit all thirteen routes at 320, 390, 768 and 1366 CSS px, check keyboard/skip-to-content, section anchors, screen-reader labels, reading preferences, policy links, title/canonical, no horizontal overflow and print CSS.
9. **Review date:** set the actual effective/publication date at launch, and trigger policy version revision on substantive data-flow changes.
10. **No surprise release:** This feature branch must remain draft/unmerged until the user explicitly authorizes deployment.

## Release criteria

- `npm run lint` and relevant isolated Corner identity, privacy, API and responsive tests must pass.
- Every policy route must respond 200 publicly; private account rights routes require session controls.
- Consent is not created by simply reading a policy. Optional reading settings must have a working allow/deny control.
- All public statements must be supported by code or verified operational configuration. No fictitious visits, fabricated certifications or impossible deletion promises.

**This checklist is an engineering/legal handoff, not a substitute for legal advice on the final deployment.**

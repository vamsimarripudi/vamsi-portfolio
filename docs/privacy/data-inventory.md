# Data inventory

**Owner:** Vamsi Marripudi  
**Privacy contact:** enquiry.portfolio@vamsimarripudi.tech  
**Reviewed:** 24 August 2026

| Processing activity | Data | Purpose | Storage / recipient | Retention |
| --- | --- | --- | --- | --- |
| Contact form and Enquiry Tracker | Name, email, enquiry type, message, generated reference ID, private notes, workflow status, timestamps, email-delivery metadata, and privacy-request status | Read and reply to a requested conversation; operate the owner-only tracker; protect against abuse; manage privacy requests | Vercel Function transit; Neon PostgreSQL tracker; Resend delivery; Vamsi enquiry mailbox | Review tracker records at 24 months after the last meaningful interaction; review spam within 90 days; redact approved erasure requests |
| Form abuse controls | IP-derived runtime key; SHA-256 fingerprint of submitted form values | Rate limiting and duplicate-submission prevention | Process memory in the running Vercel Function | Rate-limit entry up to 15 minutes; duplicate fingerprint up to 10 minutes; not an application database |
| Delivery telemetry | Reference ID, Resend provider message ID, delivery attempt outcome | Troubleshoot delivery without logging form content | Private tracker, Vercel runtime logs, and Resend account logs | Tracker review at 24 months; provider/account retention settings apply to external logs |
| Website hosting | Standard request and technical data handled by hosting infrastructure | Deliver and secure the website | Vercel | Provider/account retention settings |
| Theme preference | `theme` value | Remember light, dark, or system theme | Browser `localStorage` only | Until the visitor clears browser data or changes the preference |
| Signal Runner score | `vm-signal-runner-best` numeric score | Remember an optional local game high score | Browser `localStorage` only | Until the visitor clears browser data |

## Explicit exclusions found in source review

- No advertising cookies or marketing tracker.
- No visitor analytics or session-replay product.
- No public user account, newsletter list, or public phone-number collection.
- The private owner-only Enquiry Tracker uses Neon PostgreSQL, passwordless email-code authentication, and a short-lived signed HttpOnly session.
- No contact-message body is deliberately written to server logs by `api/contact.js`.
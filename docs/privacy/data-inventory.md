# Data inventory

**Owner:** Vamsi Marripudi  
**Privacy contact:** enquiry.portfolio@vamsimarripudi.tech  
**Reviewed:** 24 August 2026

| Processing activity | Data | Purpose | Storage / recipient | Retention |
| --- | --- | --- | --- | --- |
| Contact form | Name, email, enquiry type, message, submission time, generated reference ID | Read and reply to a requested conversation | Vercel Function transit; Resend delivery; Vamsi enquiry mailbox | Mailbox correspondence reviewed at 24 months after last meaningful interaction, unless legal/security/dispute retention is needed |
| Form abuse controls | IP-derived runtime key; SHA-256 fingerprint of the submitted form values | Rate limiting and duplicate-submission prevention | Process memory in the running Vercel Function | Rate-limit entry up to 15 minutes; duplicate fingerprint up to 10 minutes; not an application database |
| Delivery telemetry | Reference ID, Resend provider message ID, delivery attempt outcome | Troubleshoot delivery without logging form content | Vercel runtime logs and Resend account logs | Provider/account retention settings; verify periodically |
| Website hosting | Standard request/technical data handled by hosting infrastructure | Deliver and secure the website | Vercel | Provider/account retention settings |
| Theme preference | `theme` value | Remember light, dark, or system theme | Browser `localStorage` only | Until the visitor clears browser data or changes the preference |
| Signal Runner score | `vm-signal-runner-best` numeric score | Remember an optional local game high score | Browser `localStorage` only | Until the visitor clears browser data |

## Explicit exclusions found in source review

- No advertising cookies or marketing tracker.
- No visitor analytics or session-replay product.
- No application database, user account, CRM, newsletter list, or public phone-number collection.
- No contact-message body is deliberately written to server logs by `api/contact.js`.

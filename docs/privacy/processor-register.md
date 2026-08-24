# Processor and service register

| Service | Role | Data in scope | Contract/account check | Public reference |
| --- | --- | --- | --- | --- |
| Vercel | Hosting and serverless contact endpoint | Technical request data; transient contact-form processing; runtime logs | Keep account access restricted; review data-processing terms and configured log retention | [Vercel Privacy Policy](https://vercel.com/legal/privacy-policy) |
| Neon | Private Enquiry Tracker database | Contact records, private notes, workflow status, email metadata, privacy-request records, auth tokens, and sessions | Keep `DATABASE_URL` server-only; restrict project access; review account retention and data-processing terms | [Neon Privacy Policy](https://neon.com/privacy-policy) |
| Resend | Transactional email delivery | Contact name, email, enquiry type, message, reference ID; delivery metadata | Keep API key server-only; use a verified sending domain; review account retention and data-processing terms | [Resend Privacy Policy](https://resend.com/legal/privacy-policy) |
| Enquiry mailbox provider | Recipient mailbox | Delivered contact emails and replies | Confirm mailbox provider, access controls, retention and deletion process in the owner’s account | Account-specific |

No analytics, advertising, or payment processor is used. The tracker database is private, owner-only, and is not exposed on the public website.
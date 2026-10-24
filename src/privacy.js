export const PRIVACY = {
  operator: 'Vamsi Marripudi',
  contactEmail: 'connect@vamsimarripudi.me',
  siteUrl: 'https://vamsimarripudi.me',
  lastUpdated: '25 October 2026',
  version: '1.4',
};

export const privacySections = [
  {
    title: 'What this notice covers',
    body: 'This notice explains how vamsimarripudi.me handles personal information when you browse the site, email Vamsi, submit the contact form, or participate in the EV-owner survey. It applies to the public website, not to third-party websites linked from it.',
  },
  {
    title: 'Information provided through contact',
    body: 'The contact form asks for your name, email address, enquiry type, and message. It also creates a reference ID and records the time of submission. If you email directly, the information in that email is handled for the same communication purpose.',
  },
  {
    title: 'Why it is used',
    body: 'Contact information is used to read your enquiry, respond, keep a reasonable record of the conversation, prevent duplicate or abusive submissions, and maintain the reliability and security of the contact service. It is not used for advertising, sold, or shared for unrelated marketing.',
  },
  {
    title: 'Service providers',
    body: 'The site is hosted on Vercel. Contact-form email delivery uses Resend, and the private Enquiry Tracker stores contact records in Neon PostgreSQL. Messages are delivered to Vamsi’s enquiry mailbox. These providers process only the information needed to host the site, deliver the message, and operate the relevant service. Their own privacy notices apply to their services.',
  },
  {
    title: 'Electric vehicle research interviews',
    body: 'The optional /ev-survey interview records vehicle model, city if supplied, owner experiences, costs, solutions and hypothetical willingness to pay. An owner may optionally provide a first name or nickname. A 10-digit Indian mobile number is collected only if they separately consent to one research follow-up, never for marketing. Full names, email addresses, registration numbers and identity documents are not required. Questions may still contain personal details that a participant volunteers, so avoid entering identifiers or sensitive information. Interview responses are stored in private Neon PostgreSQL tables accessible only to the authenticated owner via /track/ev-surveys; individual answers are not published and are not sold or used for targeted advertising. Submissions require the participant’s voluntary consent. A random submission identifier prevents accidental duplicates; short-lived, pseudonymous rate-limit records protect the endpoint. Unsubmitted drafts are saved only in the browser used for the interview for up to seven days unless discarded sooner. Individual names and contact numbers are automatically removed after 90 days; other interview responses are kept up to 12 months for research, then deleted or anonymized, subject to necessary legal holds. To request correction or deletion, email connect@vamsimarripudi.me with the interview reference.',
  },
  {
    title: 'Optional website analytics and local preferences',
    body: 'Website analytics is optional and off until you allow it in the footer. It measures allowlisted public pages, broad source and device groups, coarse scroll depth, visible active time, selected contact-flow success/failure and resume/profile link clicks. A random short-lived tab identifier groups public visits; it is HMAC-protected before storage in the existing Neon database. Names, form values, comments, search terms, URL queries, raw referrers, precise location and screen recordings are not included. Nothing in this first-party source is sent to Google. Browser Do Not Track and Global Privacy Control disable collection; private /track, account and admin routes are excluded. Your theme preference and optional Signal Runner score remain browser-local. Website consent is separate from existing Corner reading preferences.',
  },
  {
    title: 'Retention',
    body: 'Website analytics observations expire after 90 days; a daily cleanup is attached to the existing authenticated maintenance job. Withdrawal stops new observation and removes the current tab journey when the server confirms it; older tab identifiers and provider backups follow their retention. A 25-hour revocation marker prevents delayed requests from restoring a deleted journey. The website choice cookie lasts 180 days, and tab IDs rotate after 30 minutes inactivity or 24 hours maximum. Contact-form records, private notes, and delivery events are stored in the Enquiry Tracker for up to 24 months after the last meaningful interaction, then reviewed for deletion or anonymization. Spam records are reviewed within 90 days. Approved erasure requests redact the contact record and associated delivery recipients while retaining only minimal non-identifying audit evidence where necessary. In-memory abuse controls are short-lived: rate-limit entries are kept for up to 15 minutes and duplicate-submission fingerprints for up to 10 minutes per running instance. Contact correspondence, delivery, platform, and security logs are retained under the applicable provider account settings or longer only where reasonably needed for a legal, security, or dispute-related reason.',
  },
  {
    title: 'Security',
    body: 'The contact endpoint uses server-side validation, a honeypot field, rate limiting, duplicate-submission protection, private owner-only tracker access through single-use email links, and HTTPS deployment controls. No security measure can guarantee absolute protection, so please avoid sending passwords, financial information, government identifiers, or other sensitive information through the form.',
  },
  {
    title: 'Your privacy questions and requests',
    body: 'You can ask about the information connected with your enquiry, request correction or deletion where feasible, or raise a privacy concern by emailing connect@vamsimarripudi.me with “Privacy request” in the subject. Vamsi will verify the request where necessary and respond using the contact details provided. This contact path is available now; statutory rights and timelines depend on the law applicable at the time of the request.',
  },
  {
    title: 'Updates to this notice',
    body: 'This notice may change when the site’s data practices or applicable requirements change. The “Last updated” date above identifies the current version.',
  },
];
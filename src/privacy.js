export const PRIVACY = {
  operator: 'Vamsi Marripudi',
  contactEmail: 'enquiry.portfolio@vamsimarripudi.tech',
  siteUrl: 'https://vamsimarripudi.tech',
  lastUpdated: '24 August 2026',
  version: '1.1',
};

export const privacySections = [
  {
    title: 'What this notice covers',
    body: 'This notice explains how vamsimarripudi.tech handles personal information when you browse the site, email Vamsi, or submit the contact form. It applies to the public website, not to third-party websites linked from it.',
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
    title: 'Local preferences and no advertising tracker',
    body: 'This site does not use advertising cookies, a marketing tracker, or a visitor analytics product. Your device may store a theme preference and an optional Signal Runner best score in local storage. Those values stay in your browser and can be removed through browser settings.',
  },
  {
    title: 'Retention',
    body: 'Contact-form records, private notes, and delivery events are stored in the Enquiry Tracker for up to 24 months after the last meaningful interaction, then reviewed for deletion or anonymization. Spam records are reviewed within 90 days. Approved erasure requests redact the contact record and associated delivery recipients while retaining only minimal non-identifying audit evidence where necessary. In-memory abuse controls are short-lived: rate-limit entries are kept for up to 15 minutes and duplicate-submission fingerprints for up to 10 minutes per running instance. Contact correspondence, delivery, platform, and security logs are retained under the applicable provider account settings or longer only where reasonably needed for a legal, security, or dispute-related reason.',
  },
  {
    title: 'Security',
    body: 'The contact endpoint uses server-side validation, a honeypot field, rate limiting, duplicate-submission protection, private owner-only tracker access through single-use email links, and HTTPS deployment controls. No security measure can guarantee absolute protection, so please avoid sending passwords, financial information, government identifiers, or other sensitive information through the form.',
  },
  {
    title: 'Your privacy questions and requests',
    body: 'You can ask about the information connected with your enquiry, request correction or deletion where feasible, or raise a privacy concern by emailing enquiry.portfolio@vamsimarripudi.tech with “Privacy request” in the subject. Vamsi will verify the request where necessary and respond using the contact details provided. This contact path is available now; statutory rights and timelines depend on the law applicable at the time of the request.',
  },
  {
    title: 'Updates to this notice',
    body: 'This notice may change when the site’s data practices or applicable requirements change. The “Last updated” date above identifies the current version.',
  },
];
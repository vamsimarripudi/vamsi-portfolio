/* Vamsi's Corner — original legal disclosures, reviewed 27 October 2026.
 * These describe current capabilities, not a claim of certified legal compliance.
 * India DPDP staged commencement: Act G.S.R. 843(E), Rules G.S.R. 846(E), 13 Nov 2025.
 * Source: egazette.gov.in/WriteReadData/2025/267647.pdf and 267650.pdf
 */
export const CORE_LEGAL=[
{
 slug:'privacy',group:'Privacy & control',title:'Privacy Policy',summary:'What Corner collects, why, with whom it is shared, and how you can control it.',
 updated:'27 October 2026',readingMinutes:12,
 highlights:['First-party, personal publication','Detailed reading analytics is off until you opt in','Private accounts and avatar files','No sale of personal data'],
 sections:[
 {id:'who',title:'1. Who operates this space?',paragraphs:[
  "Vamsi’s Corner at vamsimarripudi.me/corner is a personal publication operated by Vamsi Marripudi (referred to as “Corner”, “we” or “us”). It shares stories, projects, notes, wishes and moments, with optional member accounts and owner-managed publishing.",
  "For questions about personal information and privacy requests, contact connect@vamsimarripudi.me. This notice covers the Corner website, its member area, comments, reactions, reader preferences and any clearly marked optional features. The wider vamsimarripudi.me portfolio has separate collection and consent flows; this notice does not turn those into Corner processing.",
  "A feature described as optional may be unavailable or disabled at a particular time. Its description does not promise activation. This policy is a public explanation, not a certification that every legal obligation has already been audited."
 ]},
 {id:'data',title:'2. Personal information we handle',paragraphs:[
  "Different information is handled depending on whether you simply read, react, create an account, contribute a comment or opt into a publication update."
 ],bullets:[
  "Basic visitor and security information: an automatically assigned first-party pseudonymous visitor token when needed for reactions or abuse prevention; short-lived hashed network identifiers for rate limiting, server security events, general request timestamps and limited browser technical information.",
  "Member registration and account access: email address, chosen display name, salted/hashed password representation, email-verification status, account role, session metadata, sign-in timestamps and password-recovery records.",
  "Private profile data: optional short bio, language selection, optional email-update preference, saved/bookmarked stories and a private uploaded profile image. Profile images are resized and processed to remove embedded metadata where supported.",
  "Contribution data: comment text, the account display name associated with verified comments, moderation state and timestamps; where enabled, guestbook name/message and the consent to submit it.",
  "Optional publication subscriptions: an email address (protected in storage), chosen topics and frequency, verification/withdrawal records and confirmation history when the opt-in follow feature is enabled.",
  "Limited first-party basic events: page/story opens, shares and coarse device details can be recorded during public interaction unless the browser has explicitly declined analytics. Separately, optional reading-depth milestones, visible active time, broad source/device groups and selected feedback require an affirmative reading-analytics choice. These flows do not intentionally record typed form text, full search contents, screen replays, precise GPS locations or full referring URLs."
 ]},
 {id:'purposes',title:'3. Why that information is used',paragraphs:[
  "We use account and session information to create and secure access, verify email addresses, allow users to edit private profiles, provide bookmarked content and recover credentials. We use the visitor token to maintain consistent reactions and protect against repeated automated requests. Contributions are processed to review, publish, hide or remove user-submitted messages.",
  "Detailed first-party reading data is processed only where the browser has actively allowed that category of measurement and privacy signals do not block it. A separate limited basic event endpoint may register page/story/share events before an optional choice, but it is blocked when the Corner analytics cookie is set to deny or an applicable browser privacy signal is present. Optional publication emails require their own opt-in and verification; creating an account alone does not subscribe someone to a mailing list.",
  "Limited operational processing also supports error investigation, access control, fraud/abuse prevention, backup recovery, lawful requests and the security and continuity of the publication."
 ]},
 {id:'legal-basis',title:'4. Permission, necessity and withdrawal',paragraphs:[
  "Where we request a choice—for example optional reading analytics or optional email updates—we aim to make that choice specific, visible and revocable. Essential account operations such as authenticating a login or delivering a requested password-reset message require certain information to provide the service you requested.",
  "For users in India, the applicable lawful grounds will be assessed under the DPDP Act as relevant provisions come into force; the full statutory framework is not yet operative as of this policy date. Consent-based features can be turned off without requiring the visitor to stop reading the site. Turning off an optional category stops new collection for that category subject to technical and legal limitations.",
  "Account deletion requests, correction requests or disputes about ongoing processing can be sent through the private account controls or connect@vamsimarripudi.me. Withdrawal does not automatically erase information that must remain for a lawful retention or security purpose."
 ]},
 {id:'cookies',title:'5. Cookies and device storage',paragraphs:[
  "Corner uses first-party cookies for authenticated sessions, reactions and explicit consent choices. Some temporary state is also kept in session storage—for example navigation or reading-journey data that helps the site work within one browser tab.",
  "Two optional measurement systems are distinct: Corner reading analytics and the wider portfolio website analytics. Their preferences are not interchangeable. A complete purpose-by-purpose list and instructions for changing your choice are in the Cookie & Tracking Policy."
 ]},
 {id:'visibility',title:'6. What is public and what stays private',paragraphs:[
  "Published Corner articles, approved comments, approved guestbook notes and public media may be visible to visitors and may be indexed or copied by search engines. A submitted comment can display the member’s chosen display name next to the comment.",
  "Member email addresses, passwords, authentication tokens, private profile avatars, bookmarked-story lists and account preferences are not intended for public display. Draft or unapproved Studio content is access-controlled. Do not add sensitive personal information about yourself or others to content you intend to publish.",
  "A private profile is not equivalent to an encrypted end-to-end messaging service. Authorized administrators and service providers may need limited access when operating or protecting the site."
 ]},
 {id:'sharing',title:'7. Service providers and sharing',paragraphs:[
  "To host and operate Corner, information may be processed through infrastructure used for the public frontend, backend application, database or verified recovery backups. The connected deployment stack currently includes Vercel and Railway; their involvement can change with infrastructure maintenance.",
  "Account verification or recovery email may be delivered by an email service provider such as Resend when configured. Service providers receive information needed to perform their limited function and operate under their own technical and legal safeguards.",
  "Information may also be disclosed to address suspected abuse, enforce the site's rules, protect visitors, or respond to legally valid orders. We do not sell member details or run behavioral advertising based on personal reading profiles."
 ]},
 {id:'transfers',title:'8. Hosting locations and international access',paragraphs:[
  "Hosting, mail delivery, support and backup services may process or store information in jurisdictions outside India. We do not promise that every copy of data remains in India. Any applicable cross-border restrictions and contractual safeguards will be reviewed as the relevant laws and government directions take effect.",
  "Visitors outside India should understand that their data may be processed under the laws applicable to the infrastructure and operator. If you require a specific jurisdictional data-hosting guarantee, ask before opening an account."
 ]},
 {id:'retention',title:'9. Storage and retention',paragraphs:[
  "Raw first-party reading measurement records and the separate website analytics observations have a 90-day cleanup lifecycle, subject to a narrower current-tab withdrawal request. A reaction-associated pseudonymous visitor cookie can persist for up to one year unless cleared. Account login cookies currently last approximately seven days for members and eight hours for privileged Studio accounts.",
  "Account, bookmarked-content, comment and published records generally remain while needed for their particular feature or until removed, deactivated or subject to a reviewed rights request. Expired sessions and transient rate-limit records are removed in routine maintenance; security and audit records have separate operational lifecycles.",
  "The offsite backup scheduler defaults to 30-day retention of completed recovery snapshots; deployment configuration, recovery requirements and lawful holds may affect actual retention. Data removed from the active service may therefore remain temporarily in rotating backups until expiry or verified replacement."
 ]},
 {id:'security',title:'10. How information is protected',paragraphs:[
  "The application implements hashed password storage, signed or protected session credentials, role-based Studio permissions, verified-email gates, rate limits, origin protections, access-controlled private uploads and operational backup verification. Owner or staff access may require an authenticator depending on role and configuration.",
  "Uploaded profile images are limited to accepted image types and transformed to a smaller, metadata-stripped image; published media and private media have different access rules. Security is a continuing process; no site or transmission can promise perfect protection.",
  "Please report suspected account compromise, exposed private information or security vulnerabilities privately to connect@vamsimarripudi.me rather than posting exploitation details on public pages."
 ]},
 {id:'rights',title:'11. Your choices and data requests',paragraphs:[
  "A signed-in account can edit its name and bio, update preferences, replace or remove its avatar, review saved stories, inspect active sessions, change password, request a data export and submit a deletion-review request. The account area may require reauthentication for sensitive requests.",
  "You may ask for access, correction, updating or deletion of eligible personal information, withdraw optional consent, raise a complaint or request assistance through the contact email. We may need to verify that the requester is entitled to act for the account or information involved.",
  "DPDP rights and procedural deadlines will apply according to the legislation’s phased commencement and any applicable exemptions. The India DPDP & Data Rights Notice explains that timeline, including routes for a future Board complaint."
 ]},
 {id:'children',title:'12. Children and young visitors',paragraphs:[
  "Public stories can be read without creating an account. Member features are designed for people aged 18 or older at present. Corner does not offer a dedicated verifiable parental-consent workflow for child accounts. Children should not create an account or submit identifying information without a lawful basis and appropriate adult involvement.",
  "If you believe information about a child has been supplied improperly, email the operator with enough detail to locate it without sharing additional sensitive information. We will review and restrict or remove it as appropriate."
 ]},
 {id:'changes',title:'13. Changes and contact',paragraphs:[
  "This notice may be revised when features, service providers or legal requirements change. The displayed review date identifies the version published. Material changes affecting an existing consent purpose will be communicated and choices refreshed where legally required and technically feasible.",
  "For a privacy concern or data request: connect@vamsimarripudi.me. See also the Grievances & Requests Policy, DPDP Notice and Cookie & Tracking Policy."
 ]}
]},
{
 slug:'cookies',group:'Privacy & control',title:'Cookie & Tracking Policy',summary:'The exact purposes of browser cookies, temporary storage and independent analytics choices.',
 updated:'27 October 2026',readingMinutes:9,
 highlights:['Required sessions are different from optional analytics','Separate Corner and portfolio controls','Supports Do Not Track and Global Privacy Control'],
 sections:[
 {id:'basics',title:'1. Cookies, tab storage and similar identifiers',paragraphs:[
  "Cookies are small browser records sent with requests to an originating site. Session storage and local storage are browser-side records. Corner uses these different mechanisms for authentication, reactions, user preferences and limited first-party features.",
  "The optional analytics choices do not grant permission to unrelated advertising services. Corner does not intentionally set third-party behavioral-advertising cookies. External links and any separately embedded third-party content may be subject to the other provider’s own rules."
 ]},
 {id:'table',title:'2. Cookie and storage register',paragraphs:[
  "The table below reflects the functionality implemented in the current software. Exact cookie domain, path, duration and availability can vary for development environments or after a future update."
 ],table:{
  headers:['Cookie / storage','Purpose','Typical lifetime','Choice'],
  rows:[
   ['corner_session','Privileged owner or Studio authentication; HttpOnly, SameSite=Strict','Approximately 8 hours','Required when using Studio'],
   ['corner_member_session','Verified member authentication; HttpOnly, SameSite=Strict','Approximately 7 days','Required while signed in'],
   ['corner_visitor','Signed pseudonymous visitor identifier for reactions and abuse controls; HttpOnly','Up to 1 year','Functional when using reactions'],
   ['corner_reading_consent','Stores Allow or Deny for first-party reading measurement','Up to 180 days','Optional; default off'],
   ['vm_site_analytics','Separate opt-in for portfolio website analytics','Up to 180 days','Optional; default off'],
   ['corner-reading-journey-v1 (sessionStorage)','Short-lived reading-journey state within a browser tab','Tab storage; journey typically expires after inactivity','Only when reading analytics enabled'],
   ['vm_site_* (sessionStorage)','Temporary portfolio journey or deferred consent-prompt state','Current tab / limited period','Only where relevant on portfolio pages'],
   ['corner-welcome-v1 (localStorage)','Remembers dismissal of the initial welcome card','Until cleared','Convenience preference']
  ]
 }},
 {id:'essential',title:'3. Essential, functional and optional purposes',paragraphs:[
  "Authentication cookies allow you to remain signed in securely. Clearing them signs you out. A signed visitor token is assigned when necessary for a reaction or abuse-control function, so the site can recognize changes to the same reaction without collecting an account identity.",
  "Preference storage remembers decisions such as whether a first-visit note was dismissed. Optional reading analytics and optional email updates are distinct from cookies needed to use secure account features.",
  "There is no cookie requirement to simply read a public post. Some basic connection and security metadata is necessarily processed by infrastructure when a page is requested."
 ]},
 {id:'analytics',title:'4. Reading analytics and portfolio analytics',paragraphs:[
  "Corner's detailed reading analytics is opt-in and measures broad reading-depth, visible active time and selected interaction events. A separate limited basic event endpoint can count page/story/share actions until an explicit refusal; this distinction is disclosed here. A browser privacy signal such as Global Privacy Control or Do Not Track disables the reading collector, and the basic event endpoint also refuses those signals. Server-side identifiers are HMAC-protected; aggregate owner reports are not individual reading profiles.",
  "Portfolio website analytics is a separate, independently consented first-party collector. It is generally configured through the portfolio’s privacy controls at vamsimarripudi.me/privacy. A choice for one collector does not imply permission for the other.",
  "Turning a category off stops future eligible events and attempts to revoke the active tab journey. Earlier observations can remain until ordinary retention has run. Both raw measurement stores have a 90-day cleanup cycle."
 ]},
 {id:'control',title:'5. How to accept, refuse or withdraw',paragraphs:[
  "Visit the privacy controls beneath the Corner policy text to allow or refuse Reading Analytics. The settings show the current state for this browser. Refusal does not block ordinary story reading.",
  "For the wider portfolio’s measurement controls, use the Privacy page on the main website. You can also clear site storage or block cookies in browser settings. If you clear consent storage, the site will treat a future visit as a new preference decision.",
  "Blocking required session cookies can cause sign-in, saved stories and Studio tools to stop working. Privacy signals imposed by a browser can keep analytics off even when an on-page preference was previously selected."
 ]},
 {id:'third-party',title:'6. Third-party services and browser controls',paragraphs:[
  "Infrastructure service providers may set strictly operational cookies on their own domains if you follow a link to their websites. Corner does not control those cookies, and they are not consent for Corner’s first-party reader measurement.",
  "Browser tools usually allow viewing, deleting and blocking cookies on a site-by-site basis. Some mobile browsers use different labels for website data and privacy permissions."
 ]},
 {id:'updates',title:'7. Future categories and changes',paragraphs:[
  "If Corner introduces advertising, embedded media with third-party tracking, personalization profiling or a materially different analytics purpose, the notice and consent UI must be updated before such processing begins. No such activation is authorized by this current policy.",
  "Email connect@vamsimarripudi.me for questions about a particular cookie or any unexpected tracking behavior."
 ]}
]},
{
 slug:'dpdp',group:'Privacy & control',title:'India DPDP & Data Rights Notice',summary:'An India-specific explanation of the DPDP framework, phased operation and practical privacy requests.',
 updated:'27 October 2026',readingMinutes:11,
 highlights:['Explains the staged commencement accurately','Access, correction, erasure and grievance routes','Children and consent transparency'],
 sections:[
 {id:'scope',title:'1. Purpose of this India notice',paragraphs:[
  "This notice supplements the Privacy Policy for people whose digital personal data is processed in India or otherwise falls within the Digital Personal Data Protection Act, 2023 (the DPDP Act). It explains the operator, data purposes, choices and rights-request process for this personal publication.",
  "Vamsi’s Corner has not represented itself as a registered Consent Manager, a Significant Data Fiduciary or a government-certified privacy service. The published contact for data inquiries is connect@vamsimarripudi.me."
 ]},
 {id:'commencement',title:'2. Legislative status on 27 October 2026',paragraphs:[
  "The Central Government notified staged commencement through Gazette G.S.R. 843(E), dated 13 November 2025. The DPDP Rules, 2025 were notified in G.S.R. 846(E) on the same date. Certain definitions, institutional and administrative provisions are already in force.",
  "Under those notifications, consent-manager-related provisions identified for one year are scheduled for November 2026, and most substantive processing duties, notices, data-principal rights and associated Rules are scheduled to commence eighteen months after publication—approximately May 2027. These dates are subject to the actual Gazette and any lawful amendment or clarification.",
  "The Digital Personal Data Protection (Removal of Difficulties) Order, 2026, S.O. 5458(E), published in October 2026, made editorial clarifications to section 9(1) on children and persons with a lawful guardian, and to section 10(2)(c)(ii) on periodic data audit. It did not bring sections 9 or 10 into early force or change the substantive May 2027 commencement tranche. Official source: https://www.meity.gov.in/static/uploads/2026/10/daf495a7b5798a3dfa72a944b51fc176.pdf.",
  "This Corner notice describes a planned and voluntary privacy practice today and how statutory requests will be addressed when the applicable provisions are in force. It does not falsely assert that every substantive DPDP requirement is already legally enforceable."
 ],bullets:[
  "Official commencement notification: Gazette G.S.R. 843(E), 13 November 2025.",
  "Official DPDP Rules, 2025: Gazette G.S.R. 846(E), 13 November 2025.",
  "Always check an updated government notification for a change in effective dates."
 ]},
 {id:'fiduciary',title:'3. Responsible person and data purposes',paragraphs:[
  "Vamsi Marripudi operates Corner as a personal publication and determines the purposes of its account, reaction and community features. If an activity is covered by the DPDP Act, the responsible operator will evaluate the corresponding Data Fiduciary duties and the lawful grounds relevant to that activity.",
  "Member account processing includes identity/contact details, verification, secure sessions and the member’s chosen private profile settings. Published-content and reaction activities use submissions and pseudonymous functional identifiers. Optional analytics and email subscriptions have separate, specific permission flows.",
  "The full data-category inventory, providers, cross-border possibilities and retention practices are set out in the Privacy Policy. Corner does not require an account for ordinary public reading."
 ]},
 {id:'notice-consent',title:'4. Notice and meaningful choice',paragraphs:[
  "Where consent is the appropriate legal ground, notices will identify which data is requested, what the service will do with it, and how consent can be withdrawn. Detailed reading analytics is off unless affirmatively allowed; a distinct basic event collector currently operates with an explicit refusal option. Declining measurement does not block reading the website. Before applicable consent requirements commence, the operator must assess whether that basic event flow also requires additional opt-in.",
  "Account registration, public-comment submission and optional email subscriptions are different purposes. Agreeing to member account creation does not automatically subscribe a person to publication emails or permit optional reading analytics.",
  "Any new data collection that materially changes these purposes will require its own product review and clear notice before activation."
 ]},
 {id:'rights',title:'5. Access, correction, withdrawal and deletion',paragraphs:[
  "The DPDP Act provides rights and duties that will apply according to its legally effective dates. Subject to applicability, an individual may request a summary of their personal data and its processing, correction or updating of inaccurate data, erasure when appropriate, withdrawal of consent and grievance redressal.",
  "Existing Corner member controls support changing a display name and bio, updating account preferences, removing an avatar, reviewing saved stories and sessions, requesting an export, and asking for deletion review. Requests requiring identity verification may be paused while we confirm control of the relevant account.",
  "A right to erasure is not always an absolute demand for instantaneous destruction of all backups, security evidence or lawful records. A reasoned response should distinguish between information deleted from the live service and information retained for an overriding lawful purpose."
 ]},
 {id:'nomination',title:'6. Nomination and authorized representatives',paragraphs:[
  "As the relevant statutory framework comes into force, eligible individuals may have nomination rights allowing another person to exercise specified rights in prescribed circumstances. Until an authorized verification process exists, a request on someone else’s behalf may require identity, authority and lawful documentation.",
  "Do not send identification scans, full passwords or one-time codes in a first email. The operator will explain if a secure verification step is necessary."
 ]},
 {id:'child',title:'7. Children and parental permission',paragraphs:[
  "The DPDP Act generally defines a child as a person under 18. Its child-related obligations, including verifiable parental consent where applicable, are subject to commencement, exemptions and the precise processing context.",
  "Corner does not currently operate an independent verifiable parental-consent service. For that reason, registered member features are intended for adults 18 and above unless a separate lawful arrangement is implemented and verified. Public reading does not require an account.",
  "If you believe the service holds improperly submitted information about a child, email connect@vamsimarripudi.me for review and reasonable safeguarding steps."
 ]},
 {id:'breach',title:'8. Security incidents and breach response',paragraphs:[
  "The operator uses access restrictions, hashed credentials, private image processing, short-lived authentication sessions and backup checks. Security issues should be reported confidentially to the contact email.",
  "When the relevant statutory breach rules apply, their notification and incident-response requirements will take precedence. The site does not promise that every incident is preventable or claim a government security certification."
 ]},
 {id:'grievance',title:'9. Grievances, escalation and the Data Protection Board',paragraphs:[
  "Send a request or complaint to connect@vamsimarripudi.me with the relevant page or account, the nature of the concern, and a contact method. We may ask for proportionate proof of identity or authority. We aim to acknowledge substantive messages within seven calendar days where feasible, but that is an operational target rather than a guarantee or substitute for any applicable statutory deadline.",
  "The DPDP framework provides a process for complaints to the Data Protection Board of India after using the appropriate grievance process, once the relevant rights and procedures are in force. We will not state that a particular government complaint portal or escalation time is currently available unless verified."
 ]},
 {id:'official',title:'10. Official legal sources and changes',paragraphs:[
  "The binding text is the official Gazette and laws as amended—not an explanatory summary on this site. The operator should re-review this notice before the next scheduled DPDP commencement milestone and whenever government notifications alter the requirements.",
  "Official 2025 Gazette references: https://egazette.gov.in/WriteReadData/2025/267647.pdf (DPDP Act commencement) and https://egazette.gov.in/WriteReadData/2025/267650.pdf (DPDP Rules).",
  "The Privacy Policy and Cookie & Tracking Policy provide the more detailed descriptions of actual current Corner processing."
 ]}
]},
{
 slug:'security-retention',group:'Privacy & control',title:'Security & Retention Statement',summary:'How accounts and media are protected, what is retained, and what happens after a removal request.',
 updated:'27 October 2026',readingMinutes:8,
 highlights:['Password hashes and private sessions','Backups are a recovery measure','Different lifecycle for different records'],
 sections:[
 {id:'scope',title:'1. Security scope',paragraphs:[
  "This statement describes implemented safeguards and known operational limits. It is not a penetration-test certificate, SOC 2 report, cybersecurity warranty or representation that all vulnerabilities have been eliminated.",
  "Public stories are designed for broad distribution; member profile photos, non-published media and security tokens have separate private-access controls. Authentication and administrative privileges are managed server-side."
 ]},
 {id:'identity',title:'2. Account credentials and access controls',paragraphs:[
  "Passwords are stored as one-way hashes rather than readable credentials. Account sessions use token hashes server-side and protected browser cookies. The privileged Studio has role-based authorization boundaries and stricter session duration than member accounts.",
  "Site requests are protected by same-origin checks, rate limits and limits on upload types and sizes. Users should protect their recovery details and sign out on shared devices."
 ]},
 {id:'media',title:'3. Uploaded photos and publishing',paragraphs:[
  "Member avatars are processed into a smaller image format and metadata is stripped during processing. Changes and removals are available to the signed-in account holder. Private uploads are not treated as public merely because the file exists.",
  "When you intentionally submit an approved public comment, public guestbook note or other published submission, it can be accessible to visitors. Take care not to submit third-party private information in a public contribution."
 ]},
 {id:'timeline',title:'4. Retention by record type',paragraphs:[
  "Raw first-party reading and portfolio website measurement data is normally cleaned up after 90 days. Published articles and associated approval records follow the publishing lifecycle rather than the analytics cycle.",
  "The signed visitor token used for reactions can remain in a browser for up to one year; member login cookies have an approximately seven-day lifetime and privileged Studio cookies an approximately eight-hour lifetime. Revocation or password changes may invalidate an otherwise unexpired session.",
  "Expired session rows, rate-limit windows and short-lived realtime event records are cleared in background maintenance. Longer-lived membership records, moderation evidence and audit events remain subject to their service purpose and any lawful retention obligations."
 ]},
 {id:'backup',title:'5. Backups and deletion lag',paragraphs:[
  "The current offsite-backup scheduler uses a default retention setting of 30 days for verified recovery snapshots. Operational configuration may modify that setting. Backups are verified for recoverability and should not be used as a hidden public archive.",
  "A verified data-erasure request can require removal from active storage before aged backup copies expire. If restored backups contain data that has since been deleted, that data should be re-evaluated and removed from the restored active service as appropriate."
 ]},
 {id:'incident',title:'6. Incident reports and service disruption',paragraphs:[
  "For a vulnerability, lost device, unauthorized account activity or exposed content, contact connect@vamsimarripudi.me privately. Do not send passwords, OTPs or exploit data that would put visitors at risk.",
  "If an event requires notification or assistance under applicable law, the operator will assess the actual incident and the relevant statutory duty. No fixed notification time is guaranteed here where no such deadline currently applies."
 ]},
 {id:'rights',title:'7. Requests, review and corrections',paragraphs:[
  "Use the signed-in account’s Privacy & Data section or contact email for a data export, correction or deletion review. Requests affecting someone else’s information may require sufficient legal authority.",
  "Retention periods are reviewed as security needs and Indian legal requirements evolve. See the DPDP Notice and Grievance Policy for the broader rights framework."
 ]}
]}
];

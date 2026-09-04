export const SITE_URL = 'https://vamsimarripudi.tech';

export const SITE_IDENTITY = {
  name: 'Vamsi Marripudi',
  homeTitle: 'Vamsi Marripudi — Founder Engineer',
  homeDescription:
    'Vamsi Marripudi is a Founder Engineer focused on product engineering, full-stack development, backend systems and building scalable digital products.',
};

export const pageDescriptions = {
  '/': SITE_IDENTITY.homeDescription,
  '/now': 'What Vamsi Marripudi is building, learning, and exploring now.',
  '/work': 'Selected product work and earlier engineering projects by Vamsi Marripudi.',
  '/engineering': 'Engineering approach across product, frontend, backend systems, infrastructure, and integrations.',
  '/lab': 'Practical engineering experiments by Vamsi Marripudi.',
  '/writing': 'Notes on product systems, engineering decisions, and technical work.',
  '/journey': 'The professional direction and engineering journey of Vamsi Marripudi.',
  '/resume': 'Web résumé for Vamsi Marripudi, Founder Engineer.',
  '/uses': 'Tools Vamsi Marripudi uses for product engineering.',
  '/contact': 'Contact Vamsi Marripudi for engineering opportunities and collaboration.',
  '/privacy': 'Privacy Notice for vamsimarripudi.tech, including contact-form processing and local browser preferences.',
  '/terms': 'Terms of use for vamsimarripudi.tech.',
  '/faq': 'Frequently asked questions about Vamsi Marripudi, this site, and contacting him.',
  '/changelog': 'A lightweight record of verified improvements to Vamsi Marripudi’s personal engineering site.',
  '/track': 'Private Enquiry Tracker for the authorized owner only.',
};

export const staticRouteMeta = {
  '/': { title: SITE_IDENTITY.homeTitle, description: SITE_IDENTITY.homeDescription },
  '/now': { title: 'Vamsi Marripudi — Now', description: pageDescriptions['/now'] },
  '/work': { title: 'Vamsi Marripudi — Work', description: pageDescriptions['/work'] },
  '/work/event-management': { title: 'Vamsi Marripudi — Event Management', description: 'An event-management project focused on organizing event-related workflows in one application.' },
  '/work/nxtwatch': { title: 'Vamsi Marripudi — Nxtwatch', description: 'A project record from Vamsi Marripudi’s earlier engineering work.' },
  '/work/jobby-app': { title: 'Vamsi Marripudi — Jobby App', description: 'A project record from Vamsi Marripudi’s earlier engineering work.' },
  '/work/backend-twitter-clone-db': { title: 'Vamsi Marripudi — Backend Twitter Clone DB', description: 'A backend and database-focused project record from Vamsi Marripudi’s earlier engineering work.' },
  '/work/multistep-form': { title: 'Vamsi Marripudi — Multistep Form', description: 'A multi-step form project record from Vamsi Marripudi’s earlier engineering work.' },
  '/work/quiz-game': { title: 'Vamsi Marripudi — Quiz Game', description: 'A quiz-game project record from Vamsi Marripudi’s earlier engineering work.' },
  '/engineering': { title: 'Vamsi Marripudi — Engineering', description: pageDescriptions['/engineering'] },
  '/lab': { title: 'Vamsi Marripudi — Lab', description: pageDescriptions['/lab'] },
  '/writing': { title: 'Vamsi Marripudi — Writing', description: pageDescriptions['/writing'] },
  '/writing/building-for-changing-context': { title: 'Vamsi Marripudi — Building for changing context', description: 'Notes on building interfaces and systems that remain clear as operational context changes.' },
  '/writing/auth-as-product-infrastructure': { title: 'Vamsi Marripudi — Auth as product infrastructure', description: 'Notes on authentication as a deliberate product and system boundary.' },
  '/journey': { title: 'Vamsi Marripudi — Journey', description: pageDescriptions['/journey'] },
  '/resume': { title: 'Vamsi Marripudi — Résumé', description: pageDescriptions['/resume'] },
  '/uses': { title: 'Vamsi Marripudi — Uses', description: pageDescriptions['/uses'] },
  '/contact': { title: 'Vamsi Marripudi — Contact', description: pageDescriptions['/contact'] },
  '/privacy': { title: 'Vamsi Marripudi — Privacy Notice', description: pageDescriptions['/privacy'] },
  '/terms': { title: 'Vamsi Marripudi — Terms of Use', description: pageDescriptions['/terms'] },
  '/faq': { title: 'Vamsi Marripudi — FAQ', description: pageDescriptions['/faq'] },
  '/changelog': { title: 'Vamsi Marripudi — Changelog', description: pageDescriptions['/changelog'] },
  '/track': { title: 'Enquiry Tracker — Vamsi Marripudi', description: pageDescriptions['/track'], noindex: true },
  '/not-found': { title: 'Page Not Found — Vamsi Marripudi', description: 'This route does not exist on vamsimarripudi.tech.', noindex: true },
  '/offline': { title: 'You’re Offline — Vamsi Marripudi', description: 'Connection status and recovery options for vamsimarripudi.tech.', noindex: true },
  '/error': { title: 'Something Went Wrong — Vamsi Marripudi', description: 'A recoverable application error page for vamsimarripudi.tech.', noindex: true },
  '/maintenance': { title: 'Maintenance — Vamsi Marripudi', description: 'Temporary maintenance information for vamsimarripudi.tech.', noindex: true },
  '/rate-limited': { title: 'Too Many Requests — Vamsi Marripudi', description: 'A temporary rate limit recovery page for vamsimarripudi.tech.', noindex: true },
};

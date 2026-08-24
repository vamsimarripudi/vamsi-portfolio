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
  '/changelog': 'A lightweight record of verified improvements to Vamsi Marripudi’s personal engineering site.',
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
  '/changelog': { title: 'Vamsi Marripudi — Changelog', description: pageDescriptions['/changelog'] },
};

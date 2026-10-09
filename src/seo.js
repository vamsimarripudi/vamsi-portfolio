export const SITE_URL = 'https://vamsimarripudi.me';

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
  '/privacy': 'Privacy Notice for vamsimarripudi.me, including contact-form processing and local browser preferences.',
  '/terms': 'Terms of use for vamsimarripudi.me.',
  '/faq': 'Frequently asked questions about Vamsi Marripudi, this site, and contacting him.',
  '/changelog': 'A lightweight record of verified improvements to Vamsi Marripudi’s personal engineering site.',
  '/track': 'Private Enquiry Tracker for the authorized owner only.',
  '/birthday': 'Create and share a beautifully handwritten birthday surprise.',
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
  '/birthday': { title: 'Birthday Surprise | Vamsi Marripudi', description: pageDescriptions['/birthday'], noindex: true },
  '/not-found': { title: 'Page Not Found — Vamsi Marripudi', description: 'This route does not exist on vamsimarripudi.me.', noindex: true },
  '/offline': { title: 'You’re Offline — Vamsi Marripudi', description: 'Connection status and recovery options for vamsimarripudi.me.', noindex: true },
  '/error': { title: 'Something Went Wrong — Vamsi Marripudi', description: 'A recoverable application error page for vamsimarripudi.me.', noindex: true },
  '/maintenance': { title: 'Maintenance — Vamsi Marripudi', description: 'Temporary maintenance information for vamsimarripudi.me.', noindex: true },
  '/rate-limited': { title: 'Too Many Requests — Vamsi Marripudi', description: 'A temporary rate limit recovery page for vamsimarripudi.me.', noindex: true },
};

// Shared, human-visible FAQ answers are used for the page and its machine-readable description.
export const faqItems=[['What does Vamsi build?','Vamsi works across product engineering, full-stack development, backend systems, APIs, data, and the practical delivery details that help a product become useful.'],['What is the best way to get in touch?','Use the contact form or email connect@vamsimarripudi.me. Accepted contact-form messages are delivered to that enquiry mailbox.'],['What information does the contact form collect?','The form asks for a name, email address, enquiry type, and message so a response is possible. It does not ask for a phone number, address, or budget.'],['Does this site publish a phone number?','No. The public contact path is the enquiry mailbox and the contact form.'],['Where can I find projects and technical work?','Start with Work for project records, Engineering for the system approach, and Lab for safe local experiments.'],['Does the site use tracking cookies?','No advertising cookies, marketing tracker, or visitor analytics product is used. A theme preference and an optional Signal Runner best score may be stored locally in your browser.'],['Is the Enquiry Tracker public?','No. The tracker is a private owner-only workspace protected by an email verification flow.']];

// Canonical identifiers are stable across the portfolio, FAQ, and creator profile.
export const PERSON_ID = SITE_URL + '/#person';
export const WEBSITE_ID = SITE_URL + '/#website';

export function siteStructuredDataForRoute(route = '/') {
  const path = Object.prototype.hasOwnProperty.call(staticRouteMeta, route) ? route : '/';
  const meta = staticRouteMeta[path];
  const url = SITE_URL + (path === '/' ? '/' : path);
  const creator = {
    '@type': 'Person',
    '@id': PERSON_ID,
    name: SITE_IDENTITY.name,
    alternateName: 'Vamsi',
    url: SITE_URL + '/',
    description: SITE_IDENTITY.homeDescription,
    jobTitle: 'Founder Engineer',
    knowsAbout: ['Product engineering', 'Full-stack development', 'Backend systems', 'APIs', 'Cloud infrastructure'],
    sameAs: [
      'https://github.com/vamsimarripudi',
      'https://www.linkedin.com/in/vamsimarripudi/'
    ]
  };
  const website = {
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    name: SITE_IDENTITY.name,
    url: SITE_URL + '/',
    inLanguage: 'en',
    publisher: {'@id': PERSON_ID}
  };
  const page = {
    '@type': path === '/journey' ? 'ProfilePage' : path === '/faq' ? 'FAQPage' : 'WebPage',
    '@id': url + '#webpage',
    url,
    name: meta.title,
    description: meta.description,
    inLanguage: 'en',
    isPartOf: {'@id': WEBSITE_ID},
    author: {'@id': PERSON_ID}
  };
  if (path === '/' || path === '/journey') page.mainEntity = {'@id': PERSON_ID};
  if (path === '/faq') {
    page.mainEntity = faqItems.map(([question, answer]) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: {'@type': 'Answer', text: answer}
    }));
  }
  const graph = [creator, website, page];
  if (path !== '/' && !meta.noindex) {
    const segments = path.split('/').filter(Boolean);
    const breadcrumbs = [{
      '@type': 'ListItem',
      position: 1,
      name: 'Home',
      item: SITE_URL + '/'
    }];
    for (let i = 0; i < segments.length; i++) {
      const ancestorPath = '/' + segments.slice(0, i + 1).join('/');
      if (!staticRouteMeta[ancestorPath] || staticRouteMeta[ancestorPath].noindex) continue;
      breadcrumbs.push({
        '@type': 'ListItem',
        position: breadcrumbs.length + 1,
        name: ancestorPath === '/work' ? 'Work' :
          ancestorPath === '/writing' ? 'Writing' :
          staticRouteMeta[ancestorPath].title.replace('Vamsi Marripudi — ', ''),
        item: SITE_URL + ancestorPath
      });
    }
    if (breadcrumbs.length > 1) {
      graph.push({
        '@type': 'BreadcrumbList',
        '@id': url + '#breadcrumbs',
        itemListElement: breadcrumbs
      });
    }
  }
  return {'@context': 'https://schema.org', '@graph': graph};
}

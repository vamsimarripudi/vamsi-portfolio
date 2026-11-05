// Existing, observable portfolio routes only. This is NOT a central policy approval ledger.
// Never add an unreviewed product-specific policy or an invented effective date here.
export const legacyPublicLegalDocuments = Object.freeze([
  Object.freeze({
    id: 'portfolio-privacy',
    title: 'Portfolio Privacy Notice',
    href: '/privacy',
    description: 'Existing website notice about contact data, research responses and browser preferences.',
    category: 'Privacy'
  }),
  Object.freeze({
    id: 'portfolio-terms',
    title: 'Portfolio Terms of Use',
    href: '/terms',
    description: 'Existing website terms covering this portfolio and its public contact channels.',
    category: 'Website terms'
  })
]);

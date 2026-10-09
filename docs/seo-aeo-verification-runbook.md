# Vamsi Marripudi — SEO/AEO verification and ranking runbook

## Goal and reality
The canonical public website is https://vamsimarripudi.me/. Improve accurate discoverability for the full name, professional role and relevant queries. A top-five rank for the generic word Vamsi in every country cannot be guaranteed; rankings depend on competing identities, localization, intent, links and helpful content.

## Production technical checks
1. Visit https://vamsimarripudi.me/ and inspect the page source for one google-site-verification meta tag with the supplied token.
2. Visit https://vamsimarripudi.me/google510099dc96bfffe4.html and verify HTTP 200 with precisely the Google verification response, not a homepage fallback.
3. Check canonical, Person and WebSite structured data on the homepage, ProfilePage on Journey, FAQPage on FAQ, and BreadcrumbList on nested public case-study pages.
4. Check https://vamsimarripudi.me/robots.txt, https://vamsimarripudi.me/sitemap.xml, and https://vamsimarripudi.me/llms.txt.
5. Check noindex on private /track and /api/track routes; do not expose private /corner/admin routes.
6. Compare deployed Vercel SHA to merged GitHub master; regression-check /corner, /contact and /track.

## Google Search Console steps
- Open https://search.google.com/search-console/.
- Add or select the https://vamsimarripudi.me/ URL-prefix property. Use the HTML meta tag OR HTML file and click Verify. The provided methods do not constitute domain-wide DNS ownership verification.
- Submit https://vamsimarripudi.me/sitemap.xml, inspect /, /journey, /engineering, /work, /faq and request indexing only when appropriate.
- Use Google Rich Results Test and URL Inspection to check real rendering. Do not invent success if property access is unavailable.

## AEO and search-assistant quality
- Keep helpful, first-hand technical stories and accurate verified biographical facts visible in the page's main content.
- Keep legitimate GitHub/LinkedIn profile descriptions consistent and linking to canonical .me where authorized.
- The optional llms.txt is an informational source index. Google does not require it; it cannot guarantee inclusion in any AI assistant, search experience or featured result.
- Avoid fake endorsements, duplicate keyword-heavy landing pages, paid link schemes, fabricated achievements and Google Business Profile misrepresentation.

## Legacy domain caveat
- The .tech apex recently displayed a GoDaddy parked/expired page. Check registrar renewal and access before making changes.
- Do not modify its other project subdomains or MX records. If the owner separately approves only apex/www migration, use permanent redirects to .me without changing subdomains.

## Monitoring
- Track branded searches (Vamsi Marripudi), professional searches (full-stack developer and founder engineer), and ambiguous broad Vamsi separately.
- Monitor Search Console indexing, impressions, CTR, average position, country/device segmentation and Core Web Vitals weekly.
- Do not equate Google verification with a guaranteed top-five rank.

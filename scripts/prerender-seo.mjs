import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { SITE_IDENTITY, SITE_URL, staticRouteMeta, siteStructuredDataForRoute, faqItems } from '../src/seo.js';

const distDir = new URL('../dist/', import.meta.url);
const baseHtml = await readFile(new URL('index.html', distDir), 'utf8');
const escapeHtml = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const replaceMeta = (html, attribute, value) => html.replace(
  new RegExp(`(<meta ${attribute} content=")[^"]*("\\s*\\/?>)`, 'i'),
  `$1${escapeHtml(value)}$2`,
);


// True no-JavaScript fallback, not cloaking: it uses the same public titles,
// descriptions and FAQ answers that normal React visitors see. This also
// provides factual HTML text to accessibility tools and static HTTP readers.
const publicNav = [
  ['Home', '/'], ['Journey', '/journey'], ['Work', '/work'],
  ['Engineering', '/engineering'], ['FAQ', '/faq'], ['Contact', '/contact']
];
function noScriptContent(route, meta) {
  if (meta.noindex) return '';
  const contentByRoute = {
    '/': '<p>Vamsi Marripudi is a Founder Engineer working across product engineering, full-stack development, backend systems, APIs and scalable digital products.</p>',
    '/journey': '<p>The professional direction is shaped by learning foundations, shipping projects, and moving toward connected product systems.</p>',
    '/engineering': '<p>Engineering work includes product flow, frontend behavior, backend APIs, identity, data, cloud infrastructure and practical integration decisions.</p>',
    '/work': '<p>Selected project records include Event Management, Nxtwatch, Jobby App, Backend Twitter Clone DB, Multistep Form and Quiz Game.</p>'
  };
  const faq = route === '/faq' ?
    '<section aria-label="Frequently asked questions">' +
      faqItems.map(([question, answer]) =>
        '<section><h2>' + escapeHtml(question) + '</h2><p>' + escapeHtml(answer) + '</p></section>'
      ).join('') + '</section>' : '';
  const nav = '<nav aria-label="Website navigation">' +
    publicNav.map(([label, url]) => '<a style="margin-right:1.1rem" href="' + url + '">' + label + '</a>').join('') +
    '</nav>';
  return '<noscript><main style="max-width:780px;margin:3rem auto;padding:1.5rem;color:#171816;background:#f7f6f2;font:16px/1.65 Arial,Helvetica,sans-serif">' +
    nav + '<h1>' + escapeHtml(meta.title) + '</h1><p>' + escapeHtml(meta.description) + '</p>' +
    (contentByRoute[route] || '') + faq +
    '<p>Interactive features require JavaScript. Public contact information is available at <a href="/contact">Contact</a>.</p>' +
    '</main></noscript>';
}

let notFoundHtml = baseHtml;
for (const [route, meta] of Object.entries(staticRouteMeta)) {
  const canonical = `${SITE_URL}${route === '/' ? '/' : route}`;
  let html = baseHtml.replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtml(meta.title)}</title>`);
  html = replaceMeta(html, 'name="description"', meta.description);
  html = replaceMeta(html, 'property="og:title"', meta.title);
  html = replaceMeta(html, 'property="og:description"', meta.description);
  html = replaceMeta(html, 'property="og:url"', canonical);
  html = replaceMeta(html, 'name="twitter:title"', meta.title);
  html = replaceMeta(html, 'name="twitter:description"', meta.description);
  html = html.replace(/(<link rel="canonical" href=")[^"]*("\s*\/?>)/i, `$1${canonical}$2`);
  // A consistent, route-specific JSON-LD graph is available in the initial HTML
  // even to crawlers that do not run the client-side React application.
  const graph = JSON.stringify(siteStructuredDataForRoute(route)).replaceAll('<', '\\u003c');
  const jsonLdPattern = /<script type="application\/ld\+json">[\s\S]*?<\/script>/i;
  if (!jsonLdPattern.test(html)) throw new Error('Expected JSON-LD entry missing on ' + route);
  html = html.replace(jsonLdPattern, '<script type="application/ld+json">' + graph + '</script>');
  if (meta.noindex) html = html.replace('</head>', '    <meta name="robots" content="noindex, follow" />\n  </head>');
  const fallbackMarkup = noScriptContent(route, meta);
  if (fallbackMarkup) {
    if (!html.includes('<div id="root"></div>')) throw new Error('React root missing on ' + route);
    html = html.replace('<div id="root"></div>', '<div id="root">' + fallbackMarkup + '</div>');
  }
  const routeDir = route === '/' ? distDir : new URL(`${route.slice(1)}/`, distDir);
  await mkdir(routeDir, { recursive: true });
  await writeFile(new URL('index.html', routeDir), html);
  if (route === '/not-found') notFoundHtml = html;
}

await writeFile(new URL('404.html', distDir), notFoundHtml);
console.log(`Generated crawler-visible metadata for ${Object.keys(staticRouteMeta).length} routes: ${SITE_IDENTITY.name}.`);
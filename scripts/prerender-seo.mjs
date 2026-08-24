import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { SITE_IDENTITY, SITE_URL, staticRouteMeta } from '../src/seo.js';

const distDir = new URL('../dist/', import.meta.url);
const baseHtml = await readFile(new URL('index.html', distDir), 'utf8');
const escapeHtml = (value) => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;');
const replaceMeta = (html, attribute, value) => html.replace(
  new RegExp(`(<meta ${attribute} content=")[^"]*("\\s*\\/?>)`, 'i'),
  `$1${escapeHtml(value)}$2`,
);

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
  const routeDir = route === '/' ? distDir : new URL(`${route.slice(1)}/`, distDir);
  await mkdir(routeDir, { recursive: true });
  await writeFile(new URL('index.html', routeDir), html);
}

await cp(new URL('index.html', distDir), new URL('404.html', distDir));
console.log(`Generated crawler-visible metadata for ${Object.keys(staticRouteMeta).length} routes: ${SITE_IDENTITY.name}.`);
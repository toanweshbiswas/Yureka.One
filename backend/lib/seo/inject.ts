// Server-only: string-replaces the static placeholder tags in the built
// index.html with the resolved per-route meta, so crawlers that don't execute
// JavaScript (most AEO/GEO bots, social link-preview scrapers) see correct,
// unique tags for every URL — not just the generic homepage defaults.

import { DEFAULT_OG_IMAGE, SITE_URL, type PageMeta } from './pageMeta';
import { crawlerContentHtml } from './crawlerContent';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function replaceTag(html: string, pattern: RegExp, replacement: string): string {
  return pattern.test(html) ? html.replace(pattern, replacement) : html;
}

export function injectHtml(
  template: string,
  meta: PageMeta,
  pathname: string,
  schemas?: object[],
  options?: { status?: number },
): string {
  const title = esc(meta.title);
  const description = esc(meta.description);
  const image = meta.image || DEFAULT_OG_IMAGE;
  const urlPath = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  const url = `${SITE_URL}${urlPath === '/' ? '' : urlPath}`;
  const robots = meta.robots || 'index, follow';
  const keywords = esc(meta.keywords?.join(', ') || '');
  const noindex = /noindex/i.test(robots);
  const is404 = options?.status === 404 || noindex;

  let html = template;
  html = replaceTag(html, /<title>.*?<\/title>/, `<title>${title}</title>`);
  html = replaceTag(html, /<meta name="description" content=".*?"\s*\/>/, `<meta name="description" content="${description}" />`);
  html = replaceTag(html, /<meta name="keywords" content=".*?"\s*\/>/, `<meta name="keywords" content="${keywords}" />`);
  html = replaceTag(html, /<meta name="robots" content=".*?"\s*\/>/, `<meta name="robots" content="${robots}" />`);

  if (is404) {
    html = html.replace(/<link rel="canonical" href=".*?"\s*\/>/, '');
  } else {
    html = replaceTag(html, /<link rel="canonical" href=".*?"\s*\/>/, `<link rel="canonical" href="${url || SITE_URL}" />`);
  }

  html = replaceTag(html, /<meta property="og:title" content=".*?"\s*\/>/, `<meta property="og:title" content="${title}" />`);
  html = replaceTag(html, /<meta property="og:description" content=".*?"\s*\/>/, `<meta property="og:description" content="${description}" />`);
  html = replaceTag(html, /<meta property="og:url" content=".*?"\s*\/>/, `<meta property="og:url" content="${url || SITE_URL}" />`);
  html = replaceTag(html, /<meta property="og:image" content=".*?"\s*\/>/, `<meta property="og:image" content="${image}" />`);

  html = replaceTag(html, /<meta property="twitter:title" content=".*?"\s*\/>/, `<meta property="twitter:title" content="${title}" />`);
  html = replaceTag(html, /<meta property="twitter:description" content=".*?"\s*\/>/, `<meta property="twitter:description" content="${description}" />`);
  html = replaceTag(html, /<meta property="twitter:url" content=".*?"\s*\/>/, `<meta property="twitter:url" content="${url || SITE_URL}" />`);
  html = replaceTag(html, /<meta property="twitter:image" content=".*?"\s*\/>/, `<meta property="twitter:image" content="${image}" />`);
  html = replaceTag(html, /<meta name="twitter:title" content=".*?"\s*\/>/, `<meta name="twitter:title" content="${title}" />`);
  html = replaceTag(html, /<meta name="twitter:description" content=".*?"\s*\/>/, `<meta name="twitter:description" content="${description}" />`);
  html = replaceTag(html, /<meta name="twitter:url" content=".*?"\s*\/>/, `<meta name="twitter:url" content="${url || SITE_URL}" />`);
  html = replaceTag(html, /<meta name="twitter:image" content=".*?"\s*\/>/, `<meta name="twitter:image" content="${image}" />`);

  if (schemas?.length) {
    const scripts = schemas.map((s) => `<script type="application/ld+json">${JSON.stringify(s)}</script>`).join('\n    ');
    html = html.replace('</head>', `    ${scripts}\n  </head>`);
  }

  const snapshot = is404 ? '' : crawlerContentHtml(urlPath || '/');
  html = html.replace('<!--CRAWLER_CONTENT-->', snapshot);

  return html;
}

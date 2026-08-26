// Server-only: given a request pathname, resolves which PageMeta + JSON-LD
// schemas to inject. Static routes are a pure lookup; dynamic routes
// (/blog/:slug) do a best-effort, short-timeout lookup so crawlers see the
// real title. falling back to generic (or 404 for a confirmed miss).

import { DEFAULT_DESCRIPTION, formatTitle, SITE_URL, staticPageMeta, type PageMeta } from './pageMeta';
import {
  blogPostingSchema,
  brandItemListSchema,
  breadcrumbSchema,
  faqPageSchema,
  howToGoldbackSchema,
  jobPostingSchema,
} from './structuredData';
import { faqQuestions } from '../faq';
import { brandCategoryFromSlug, brands, brandsCategorySeo, categorySlug } from '../../../landing/brandsData';
import { listCareers } from '../cms/careersStore';
import { getBlogBySlug } from '../cms/blogStore';

export const REDIRECTS: Record<string, string> = {
  '/ai-magic': '/yureka-ai',
  '/ai': '/yureka-ai',
  '/yureka-os': '/',
  '/blogs': '/blog',
};

export interface ResolvedRoute {
  status: 200 | 404;
  meta: PageMeta;
  schemas?: object[];
  redirect?: string;
}

const NOT_FOUND_META: PageMeta = {
  title: formatTitle('Page Not Found | Yureka One'),
  description: 'The page you are looking for does not exist or may have moved.',
  robots: 'noindex, follow',
};

const cache = new Map<string, { value: ResolvedRoute; expires: number }>();
const TTL_MS = 10 * 60 * 1000;

function getCached(key: string): ResolvedRoute | undefined {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;
  return undefined;
}

function setCached(key: string, value: ResolvedRoute) {
  cache.set(key, { value, expires: Date.now() + TTL_MS });
}

/** Distinguishes "query timed out / errored" from "query confirmed no row". */
function withTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<{ timedOut: boolean; value: T | undefined }> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ timedOut: true, value: undefined }), ms);
    Promise.resolve(promise).then(
      (v) => { clearTimeout(timer); resolve({ timedOut: false, value: v }); },
      () => { clearTimeout(timer); resolve({ timedOut: true, value: undefined }); }
    );
  });
}

function extraSchemas(path: string, jobs?: object[]): object[] {
  if (path === '/') {
    return [
      {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'Yureka One',
        alternateName: 'Yureka',
        url: SITE_URL,
      },
      faqPageSchema(faqQuestions),
      howToGoldbackSchema(),
    ];
  }
  if (path === '/faq') return [faqPageSchema(faqQuestions)];
  if (path === '/jobs') return jobs || [];
  if (path === '/manifesto') {
    return [{
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'The Yureka Manifesto',
      url: `${SITE_URL}/manifesto`,
      about: 'Spend. Accumulate. Evolve.',
    }];
  }
  if (path === '/security-protocol') {
    return [{
      '@context': 'https://schema.org',
      '@type': 'TechArticle',
      headline: 'Yureka.One Security Protocol',
      url: `${SITE_URL}/security-protocol`,
      about: 'AES-256, Account Aggregator consent, DPDP-aligned data handling',
    }];
  }
  if (path === '/about') {
    return [{
      '@context': 'https://schema.org',
      '@type': 'AboutPage',
      name: 'About Yureka.One',
      url: `${SITE_URL}/about`,
    }];
  }
  if (path === '/contact') {
    return [{
      '@context': 'https://schema.org',
      '@type': 'ContactPage',
      name: 'Contact Yureka.One',
      url: `${SITE_URL}/contact`,
    }];
  }
  return [];
}

export async function resolveRouteMeta(pathname: string): Promise<ResolvedRoute> {
  const path = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;

  if (REDIRECTS[path]) {
    return { status: 200, meta: staticPageMeta['/'], redirect: REDIRECTS[path] };
  }

  if (path.startsWith('/dashboard')) {
    return {
      status: 200,
      meta: { title: formatTitle('Dashboard | Yureka One'), description: 'Your personal Yureka One dashboard.', robots: 'noindex, follow' },
    };
  }

  if (path === '/brand' || path.startsWith('/brand/')) {
    return {
      status: 200,
      meta: staticPageMeta['/brand'] || {
        title: formatTitle('Brand portal | Yureka One'),
        description: 'Partner portal.',
        robots: 'noindex, nofollow',
      },
    };
  }

  if (path === '/ww' || path.startsWith('/ww/')) {
    const meta =
      staticPageMeta[path] ||
      staticPageMeta['/ww'] || {
        title: formatTitle('WanderWorld ops | Yureka One'),
        description: 'WanderWorld ops portal.',
        robots: 'noindex, nofollow',
      };
    return { status: 200, meta };
  }

  if (staticPageMeta[path]) {
    if (path === '/jobs') {
      const cached = getCached('jobs:schemas');
      if (cached?.schemas) {
        return { status: 200, meta: staticPageMeta[path], schemas: cached.schemas };
      }
      const { timedOut, value } = await withTimeout(listCareers({ includeDrafts: false }), 2000);
      const schemas = timedOut || !value
        ? []
        : value.map((role) =>
            jobPostingSchema({
              title: role.title,
              type: role.type,
              location: role.location,
              dept: role.department,
              refId: role.refId,
              description: role.description,
            }),
          );
      const resolved = { status: 200 as const, meta: staticPageMeta[path], schemas };
      setCached('jobs:schemas', resolved);
      return resolved;
    }
    return { status: 200, meta: staticPageMeta[path], schemas: extraSchemas(path) };
  }

  const legacyBlog = path.match(/^\/blogs\/([^/]+)$/);
  if (legacyBlog) return { status: 200, meta: staticPageMeta['/blog'] || staticPageMeta['/'], redirect: `/blog/${legacyBlog[1]}` };

  const m = path.match(/^\/blog\/([^/]+)$/);
  if (m) return resolveBlog(m[1]);

  const brandCat = path.match(/^\/brands\/([^/]+)$/);
  if (brandCat) {
    const raw = brandCat[1];
    if (raw !== raw.toLowerCase()) {
      return { status: 200, meta: staticPageMeta['/brands'], redirect: `/brands/${raw.toLowerCase()}` };
    }
    const name = brandCategoryFromSlug(raw);
    if (!name) return { status: 404, meta: NOT_FOUND_META };
    const seo = brandsCategorySeo(name);
    const names = brands.filter((b) => b.image && b.categories.includes(name)).map((b) => b.name);
    return {
      status: 200,
      meta: seo,
      schemas: [
        breadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'Brands', path: '/brands' },
          { name, path: `/brands/${categorySlug(name)}` },
        ]),
        brandItemListSchema(name, names),
      ],
    };
  }

  return { status: 404, meta: NOT_FOUND_META };
}

const BLOG_TIMEOUT_FALLBACK: ResolvedRoute = {
  status: 200,
  meta: { title: formatTitle(staticPageMeta['/blog']?.title || 'Blog'), description: DEFAULT_DESCRIPTION, robots: 'noindex, follow' },
};

async function resolveBlog(slug: string): Promise<ResolvedRoute> {
  const cached = getCached(`blog:${slug}`);
  if (cached) return cached;

  const { timedOut, value } = await withTimeout(getBlogBySlug(slug), 2000);
  if (timedOut) return BLOG_TIMEOUT_FALLBACK;
  if (!value) {
    const miss = { status: 404 as const, meta: NOT_FOUND_META };
    setCached(`blog:${slug}`, miss);
    return miss;
  }

  const resolved: ResolvedRoute = {
    status: 200,
    meta: {
      title: formatTitle(value.title),
      description: value.excerpt || DEFAULT_DESCRIPTION,
      image: value.image || undefined,
    },
    schemas: [
      breadcrumbSchema([
        { name: 'Home', path: '/' },
        { name: 'Blog', path: '/blog' },
        { name: value.title, path: `/blog/${value.slug}` },
      ]),
      blogPostingSchema({
        title: value.title,
        image: value.image,
        createdAt: value.createdAt,
        updatedAt: value.updatedAt,
        author: value.author,
        slug: value.slug,
      }),
    ],
  };
  setCached(`blog:${slug}`, resolved);
  return resolved;
}

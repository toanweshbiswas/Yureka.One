import { categorySlug, indexableBrandCategories } from '../../../landing/brandsData'
import { listBlogs } from '../cms/blogStore'
import { SITE_URL } from './pageMeta'

function entry(loc: string, lastmod: string, changefreq: string, priority: string) {
  return `  <url>
    <loc>${SITE_URL}${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>\n`
}

function metaFor(route: string): { changefreq: string; priority: string } {
  if (route === '') return { changefreq: 'daily', priority: '1.0' }
  if (route.startsWith('/brands')) return { changefreq: 'weekly', priority: '0.8' }
  if (route === '/blog' || route.startsWith('/blog/')) return { changefreq: 'weekly', priority: '0.7' }
  if (['/privacy-policy', '/terms-of-service', '/community-guidelines'].includes(route)) {
    return { changefreq: 'monthly', priority: '0.3' }
  }
  if (route === '/join-waitlist') return { changefreq: 'weekly', priority: '0.5' }
  return { changefreq: 'weekly', priority: '0.7' }
}

export async function buildSitemapXml(): Promise<string> {
  const today = new Date().toISOString().split('T')[0]
  const staticRoutes = [
    '',
    '/brands',
    ...indexableBrandCategories().map((c) => `/brands/${categorySlug(c)}`),
    '/about',
    '/contact',
    '/faq',
    '/blog',
    '/security-protocol',
    '/manifesto',
    '/jobs',
    '/yureka-ai',
    '/join-waitlist',
    '/privacy-policy',
    '/terms-of-service',
    '/community-guidelines',
  ]

  const blogPaths: string[] = []
  try {
    const posts = await listBlogs({ includeDrafts: false })
    for (const post of posts) {
      if (post.slug) blogPaths.push(`/blog/${post.slug}`)
    }
  } catch {
    // Build-time / missing CMS should still emit a valid sitemap.
  }

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
  for (const route of [...staticRoutes, ...blogPaths]) {
    const { changefreq, priority } = metaFor(route)
    xml += entry(route, today, changefreq, priority)
  }
  xml += '</urlset>'
  return xml
}

import type { Express, Request, Response } from 'express'
import { isEmbedHostAllowed } from '../../../shared/superBrowseStores.js'
import { sanitizeBrowseUrl } from '../../../shared/inAppBrowse.js'

const MAX_HTML_BYTES = 2_000_000
const MAX_HOPS = 5
const FETCH_MS = 12_000

const UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36'

function escapeAttr(value: string) {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}

function interceptScript(): string {
  return `<script data-yureka="embed">
(function(){
  function wrap(href){
    try {
      var u = new URL(href, document.baseURI);
      if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
      u.protocol = 'https:';
      return '/api/embed?url=' + encodeURIComponent(u.href);
    } catch (e) { return null; }
  }
  document.addEventListener('click', function(e){
    var n = e.target && e.target.closest ? e.target.closest('a') : null;
    if (!n || !n.href || n.getAttribute('download') != null) return;
    var next = wrap(n.href);
    if (!next) return;
    e.preventDefault();
    location.assign(next);
  }, true);
})();
</script>`
}

function rewriteHtml(html: string, pageUrl: string): string {
  const inject = `<base href="${escapeAttr(pageUrl)}">${interceptScript()}`
  if (/<head[\s>]/i.test(html)) {
    return html.replace(/<head([^>]*)>/i, `<head$1>${inject}`)
  }
  return inject + html
}

async function fetchAllowed(url: string, hops = 0): Promise<{ url: string; res: globalThis.Response }> {
  if (hops > MAX_HOPS) throw new Error('Too many redirects')
  const parsed = new URL(url)
  if (!isEmbedHostAllowed(parsed.hostname)) throw new Error('Host not allowed')

  const res = await fetch(url, {
    redirect: 'manual',
    signal: AbortSignal.timeout(FETCH_MS),
    headers: {
      'User-Agent': UA,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-IN,en;q=0.9',
    },
  })

  if (res.status >= 300 && res.status < 400) {
    const location = res.headers.get('location')
    if (!location) throw new Error('Redirect without location')
    const next = new URL(location, url).toString()
    const safe = sanitizeBrowseUrl(next)
    if (!safe) throw new Error('Redirect blocked')
    return fetchAllowed(safe, hops + 1)
  }

  return { url, res }
}

export function registerEmbedRoutes(app: Express) {
  app.get('/api/embed', async (req: Request, res: Response) => {
    const raw = typeof req.query.url === 'string' ? req.query.url : ''
    const target = sanitizeBrowseUrl(raw)
    if (!target) {
      res.status(400).type('html').send('Invalid store link')
      return
    }
    try {
      if (!isEmbedHostAllowed(new URL(target).hostname)) {
        res.status(403).type('html').send('That store can’t be opened in Yureka')
        return
      }

      const { url: finalUrl, res: upstream } = await fetchAllowed(target)
      const contentType = (upstream.headers.get('content-type') || 'text/html').split(';')[0].trim()

      res.removeHeader('X-Frame-Options')
      res.setHeader('Content-Security-Policy', "frame-ancestors 'self'")
      res.setHeader('X-Content-Type-Options', 'nosniff')
      res.setHeader('Cache-Control', 'private, max-age=60')

      if (contentType.includes('html')) {
        const buf = Buffer.from(await upstream.arrayBuffer())
        if (buf.length > MAX_HTML_BYTES) {
          res.status(502).type('html').send('Store page is too large to open in Yureka')
          return
        }
        const html = rewriteHtml(buf.toString('utf8'), finalUrl)
        res.status(upstream.status).type('html').send(html)
        return
      }

      res.status(upstream.status)
      res.setHeader('Content-Type', contentType || 'application/octet-stream')
      const body = Buffer.from(await upstream.arrayBuffer())
      res.send(body)
    } catch (e: any) {
      console.error('[embed]', e?.message || e)
      res.status(502).type('html').send('Could not open this store inside Yureka')
    }
  })
}

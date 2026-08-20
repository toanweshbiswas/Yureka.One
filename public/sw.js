/**
 * Tiny installability service worker.
 * Chrome requires a SW with a fetch handler for beforeinstallprompt / PWA install.
 *
 * Hashed /assets/* → cache-first (repeat PWA launches should not wait on the network).
 * HTML / other same-origin → network-first, cache fallback.
 */
const CACHE = 'yureka-shell-v2'

self.addEventListener('install', (event) => {
  // @ts-ignore
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  // @ts-ignore
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  // @ts-ignore
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/') || url.pathname.includes('supabase')) return

  const isHashedAsset =
    url.pathname.startsWith('/assets/') ||
    /\.(js|css|woff2?)$/.test(url.pathname)

  if (isHashedAsset) {
    // @ts-ignore
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const hit = await cache.match(req)
        if (hit) return hit
        const res = await fetch(req)
        if (res.ok) cache.put(req, res.clone()).catch(() => {})
        return res
      })
    )
    return
  }

  // @ts-ignore
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && (url.pathname.match(/\.(png|jpg|jpeg|webp|svg|mp4|webmanifest)$/) || url.pathname === '/manifest.webmanifest')) {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {})
        }
        return res
      })
      .catch(async () => {
        const hit = await caches.match(req)
        if (hit) return hit
        if (req.mode === 'navigate') {
          const shell = await caches.match('/')
          if (shell) return shell
        }
        return Response.error()
      })
  )
})

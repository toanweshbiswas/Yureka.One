/**
 * Tiny installability service worker.
 * Chrome requires a SW with a fetch handler for beforeinstallprompt / PWA install.
 * Cache-first for same-origin GETs of static assets; network for navigation/API.
 */
const CACHE = 'yureka-shell-v1'

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
  // Never cache API / auth
  if (url.pathname.startsWith('/api/') || url.pathname.includes('supabase')) return

  // @ts-ignore
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && (url.pathname.match(/\.(js|css|png|jpg|jpeg|webp|svg|woff2?|mp4|webmanifest)$/) || url.pathname === '/manifest.webmanifest')) {
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

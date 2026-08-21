/** Persist dashboard main scroll so returning from stores/browse doesn't jump to top. */

const PREFIX = 'yureka-dash-scroll:'
const RETURN_KEY = 'yureka-dash-return'

export function dashboardScrollRoot(): HTMLElement | null {
  if (typeof document === 'undefined') return null
  return document.querySelector('main.dashboard-scroll')
}

function pathKey(path?: string) {
  const raw = path || (typeof location !== 'undefined' ? location.pathname : '/')
  return raw.split('?')[0].split('#')[0] || '/'
}

export function saveDashboardScroll(path?: string) {
  const el = dashboardScrollRoot()
  if (!el) return
  try {
    sessionStorage.setItem(`${PREFIX}${pathKey(path)}`, String(el.scrollTop))
  } catch {
    /* ignore */
  }
}

export function restoreDashboardScroll(path?: string) {
  const el = dashboardScrollRoot()
  if (!el) return
  let top = 0
  try {
    const raw = sessionStorage.getItem(`${PREFIX}${pathKey(path)}`)
    if (raw == null) return
    top = Number(raw)
  } catch {
    return
  }
  if (!Number.isFinite(top) || top < 0) return
  const apply = () => {
    el.scrollTop = top
  }
  apply()
  requestAnimationFrame(() => {
    apply()
    requestAnimationFrame(apply)
  })
}

/** Scroll to #id inside the dashboard main scroller. */
export function scrollDashboardToId(id: string, behavior: ScrollBehavior = 'auto') {
  const clean = id.replace(/^#/, '').trim()
  if (!clean) return false
  const target = document.getElementById(clean)
  if (!target) return false
  target.scrollIntoView({ block: 'start', behavior })
  saveDashboardScroll()
  return true
}

export function rememberBrowseReturn(returnTo: string) {
  try {
    sessionStorage.setItem(RETURN_KEY, returnTo)
  } catch {
    /* ignore */
  }
  const path = returnTo.split('?')[0].split('#')[0]
  saveDashboardScroll(path)
}

export function consumeBrowseReturn(): string | null {
  try {
    const v = sessionStorage.getItem(RETURN_KEY)
    sessionStorage.removeItem(RETURN_KEY)
    return v
  } catch {
    return null
  }
}

/** After paint: honor hash (#super-browse) or restore saved scroll for this path. */
export function restoreDashboardPosition(opts?: { pathname?: string; hash?: string }) {
  const hash = (opts?.hash ?? (typeof location !== 'undefined' ? location.hash : '')).replace(/^#/, '')
  const path = pathKey(opts?.pathname)

  const run = () => {
    if (hash && scrollDashboardToId(hash, 'auto')) return
    restoreDashboardScroll(path)
  }

  run()
  // Content (images / keep-alive) can shift layout after first paint.
  window.setTimeout(run, 50)
  window.setTimeout(run, 200)
}

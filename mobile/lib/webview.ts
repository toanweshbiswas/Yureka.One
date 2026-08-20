import { APP_URL, supabaseProjectRef } from './config'
import type { Session } from './supabase'

export function dashboardUrl(path = '/dashboard/home') {
  const p = path.startsWith('/') ? path : `/${path}`
  const sep = p.includes('?') ? '&' : '?'
  return `${APP_URL}${p}${sep}embedded=1`
}

function supabaseStorageKey() {
  const ref = supabaseProjectRef()
  return ref ? `sb-${ref}-auth-token` : ''
}

/** Inject Supabase session before page JS runs (WKWebView-safe, Quithero-style pre-load). */
export function sessionInjectScript(session: Session | null) {
  if (!session) return undefined
  const key = supabaseStorageKey()
  if (!key) return undefined
  const payload = JSON.stringify(session)
  return `
    (function () {
      try {
        localStorage.setItem(${JSON.stringify(key)}, ${JSON.stringify(payload)});
        window.__YUREKA_NATIVE_SESSION__ = true;
        window.dispatchEvent(new CustomEvent('yureka-native-session', { detail: { ready: true } }));
      } catch (e) {}
    })();
    true;
  `
}

export const NATIVE_UA_SUFFIX = ' YurekaApp/1.0'

export function isAppOrigin(url: string) {
  try {
    const target = new URL(url)
    const app = new URL(APP_URL)
    return target.hostname === app.hostname
  } catch {
    return false
  }
}

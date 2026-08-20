import { APP_URL, supabaseProjectRef } from './config'
import type { Session } from './supabase'

export function dashboardUrl(path = '/dashboard/home') {
  const p = path.startsWith('/') ? path : `/${path}`
  const sep = p.includes('?') ? '&' : '?'
  return `${APP_URL}${p}${sep}embedded=1`
}

export function sessionInjectScript(session: Session | null) {
  if (!session) return undefined
  const ref = supabaseProjectRef()
  if (!ref) return undefined
  const key = `sb-${ref}-auth-token`
  const payload = JSON.stringify(session)
  return `
    (function () {
      try {
        localStorage.setItem(${JSON.stringify(key)}, ${JSON.stringify(payload)});
      } catch (e) {}
    })();
    true;
  `
}

export const NATIVE_UA_SUFFIX = ' YurekaApp/1.0'

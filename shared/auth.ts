import { createClient, type SupabaseClient, type Session, type User } from '@supabase/supabase-js'
import {
  appOrigin,
  brandOrigin,
  isSplitHostsEnabled,
  resolveSiteRole,
  wanderworldOrigin,
} from '@shared/hosts'
import { isPasswordRecoveryCallback } from '@shared/oauthHandoff'

const url = (import.meta.env.VITE_SUPABASE_URL || '').trim()
const anon = (
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  ''
).trim()

export const supabaseConfigured = Boolean(url && anon)

let client: SupabaseClient | null = null

function shouldDetectSessionInUrl() {
  // Recovery links are exchanged manually via `establishRecoverySession` so we
  // never race `detectSessionInUrl` (which can burn a one-time `code` and then
  // report the link as expired).
  if (typeof window !== 'undefined' && isPasswordRecoveryCallback()) return false
  const role = resolveSiteRole()
  // Only exchange OAuth `?code=` on the app (or combined local) host. never on
  // the marketing site, or PKCE verifier / session land on the wrong origin.
  return role === 'app' || role === 'brand' || role === 'wanderworld' || role === 'all'
}

export function getSupabaseBrowser(): SupabaseClient | null {
  if (!supabaseConfigured) return null
  if (!client) {
    client = createClient(url, anon, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: shouldDetectSessionInUrl(),
        flowType: 'pkce',
      },
    })
  }
  return client
}

let tokenGetter: (() => string | null | undefined) | null = null

export function setAuthTokenGetter(fn: (() => string | null | undefined) | null) {
  tokenGetter = fn
}

export function getAuthAccessToken(): string | null {
  const t = tokenGetter?.()
  return t ? String(t) : null
}

export type AppUserStatus = 'none' | 'pending' | 'accepted' | 'admin' | 'loading' | 'rejected' | 'on-hold'

export function normalizeWaitlistStatus(
  status: string | undefined | null
): Exclude<AppUserStatus, 'loading' | 'none' | 'admin'> | null {
  if (!status) return null
  if (status === 'on_hold' || status === 'on-hold') return 'on-hold'
  if (status === 'pending' || status === 'accepted' || status === 'rejected') return status
  return null
}

/** Canonical OAuth return URL. must be listed in Supabase Auth redirect allowlist. */
export function authCallbackUrl(nextPath = '/dashboard') {
  const next = nextPath.startsWith('/') ? nextPath : `/${nextPath}`
  return `${appOrigin()}/login?next=${encodeURIComponent(next)}`
}

export function brandAuthCallbackUrl(nextPath = '/brand') {
  const next = nextPath.startsWith('/') ? nextPath : `/${nextPath}`
  const origin =
    typeof window !== 'undefined' && !isSplitHostsEnabled()
      ? window.location.origin
      : brandOrigin()
  return `${origin}/brand/login?next=${encodeURIComponent(next)}`
}

/** Redirect target for Supabase "reset your password" email links. */
export function resetPasswordCallbackUrl(path = '/reset-password') {
  const normalized = path.startsWith('/') ? path : `/${path}`
  // Prefer the origin the user is on so the PKCE verifier and redirect match.
  if (typeof window !== 'undefined') {
    const role = resolveSiteRole()
    if (role === 'app' || role === 'all') {
      return `${window.location.origin}${normalized}`
    }
  }
  return `${appOrigin()}${normalized}`
}

export function brandResetPasswordCallbackUrl() {
  const origin =
    typeof window !== 'undefined' && !isSplitHostsEnabled()
      ? window.location.origin
      : brandOrigin()
  return `${origin}/brand/reset-password?next=${encodeURIComponent('/brand')}`
}

export function wanderworldAuthCallbackUrl(nextPath?: string) {
  const role =
    typeof window !== 'undefined'
      ? resolveSiteRole()
      : ('wanderworld' as const)
  const home = role === 'wanderworld' ? '/' : '/ww'
  const next = (nextPath || home).startsWith('/') ? nextPath || home : `/${nextPath || home}`

  // Local combined SPA. stay on this origin under /ww.
  if (typeof window !== 'undefined' && !isSplitHostsEnabled()) {
    return `${window.location.origin}/ww/login?next=${encodeURIComponent(next)}&portal=ww`
  }

  // Production: bridge via app.yureka.one/ww-oauth (usually already on the Supabase
  // redirect allowlist). oauthHandoff then sends ?code= to wanderworld *before*
  // PKCE exchange so the session lands on the ops host.
  return `${appOrigin()}/ww-oauth?next=${encodeURIComponent(next)}&portal=ww`
}

export function wanderworldResetPasswordCallbackUrl() {
  const role =
    typeof window !== 'undefined'
      ? resolveSiteRole()
      : ('wanderworld' as const)
  const home = role === 'wanderworld' ? '/' : '/ww'

  if (typeof window !== 'undefined' && !isSplitHostsEnabled()) {
    return `${window.location.origin}/ww/reset-password?next=${encodeURIComponent(home)}&portal=ww`
  }

  // Prefer direct WW reset URL; also tag portal for handoff if Site URL misroutes.
  return `${wanderworldOrigin()}/reset-password?next=${encodeURIComponent('/')}&portal=ww`
}

export async function signInWithGmail(redirectTo?: string): Promise<{ error?: string }> {
  const sb = getSupabaseBrowser()
  if (!sb) return { error: 'Sign-in is temporarily unavailable. Please try again later.' }
  const redirect = redirectTo || authCallbackUrl('/dashboard')
  const { error } = await sb.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirect,
      queryParams: {
        prompt: 'select_account',
        access_type: 'online',
      },
      scopes: 'openid email profile',
    },
  })
  if (error) return { error: error.message }
  return {}
}

export async function signInWithEmail(
  email: string,
  password: string
): Promise<{ error?: string }> {
  const sb = getSupabaseBrowser()
  if (!sb) return { error: 'Sign-in is temporarily unavailable. Please try again later.' }
  const { error } = await sb.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  })
  if (error) return { error: error.message }
  return {}
}

export async function signUpWithEmail(opts: {
  email: string
  password: string
  fullName?: string
  emailRedirectTo?: string
}): Promise<{ error?: string; needsEmailConfirm?: boolean }> {
  const sb = getSupabaseBrowser()
  if (!sb) return { error: 'Sign-up is temporarily unavailable. Please try again later.' }
  const { data, error } = await sb.auth.signUp({
    email: opts.email.trim().toLowerCase(),
    password: opts.password,
    options: {
      emailRedirectTo: opts.emailRedirectTo || authCallbackUrl('/dashboard'),
      data: opts.fullName ? { full_name: opts.fullName.trim() } : undefined,
    },
  })
  if (error) return { error: error.message }
  if (!data.session) return { needsEmailConfirm: true }
  return {}
}

export async function signOutGmail(): Promise<void> {
  const sb = getSupabaseBrowser()
  await sb?.auth.signOut()
}

export async function resetPasswordForEmail(email: string, redirectTo?: string): Promise<{ error?: string }> {
  const normalized = email.trim().toLowerCase()
  if (!normalized) return { error: 'Email is required' }

  const target = redirectTo || resetPasswordCallbackUrl()

  // Prefer our API: emails a token_hash link that works in any browser.
  // Supabase's default PKCE `?code=` mail often shows as expired when opened
  // from Gmail/Outlook in-app browsers (missing code verifier).
  try {
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: normalized, redirectTo: target }),
    })
    if (res.ok) return {}
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    // Fall through to Supabase client if API is unavailable.
    if (res.status !== 404 && res.status !== 502 && res.status !== 503) {
      return { error: body?.error || 'Could not send reset email' }
    }
  } catch {
    /* network / local without API. fall back */
  }

  const sb = getSupabaseBrowser()
  if (!sb) return { error: 'Password reset is temporarily unavailable. Please try again later.' }

  const { error } = await sb.auth.resetPasswordForEmail(normalized, {
    redirectTo: target,
  })

  if (error) return { error: error.message }
  return {}
}

const RESET_LINK_EXPIRED =
  'This reset link is invalid or expired. Please request a new one from the login page.'

const RESET_LINK_PKCE =
  'Open the latest reset email in the same browser where you requested it (email in-app browsers often break this link). Or request a new link and open it immediately.'

export function friendlyAuthError(message: string | undefined | null, fallback = RESET_LINK_EXPIRED): string {
  const raw = (message || '').trim()
  if (!raw) return fallback
  const lower = raw.toLowerCase()
  if (
    lower.includes('invalid flow state') ||
    lower.includes('pkce') ||
    lower.includes('code verifier') ||
    lower.includes('both auth code and code verifier')
  ) {
    return RESET_LINK_PKCE
  }
  if (
    lower.includes('auth session missing') ||
    lower.includes('session missing') ||
    lower.includes('expired') ||
    lower.includes('invalid or expired') ||
    lower.includes('otp_expired') ||
    lower.includes('token has expired')
  ) {
    return RESET_LINK_EXPIRED
  }
  return raw
}

function stripAuthParamsFromUrl() {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  for (const key of ['code', 'error', 'error_description', 'type', 'token', 'token_hash']) {
    url.searchParams.delete(key)
  }
  url.hash = ''
  const next = `${url.pathname}${url.search}`
  window.history.replaceState(window.history.state, '', next)
}

function readRecoveryUrlParts() {
  const search = typeof window !== 'undefined' ? window.location.search.replace(/^\?/, '') : ''
  const hashRaw = typeof window !== 'undefined' ? window.location.hash : ''
  const params = new URLSearchParams(search)
  const hash = new URLSearchParams(hashRaw.startsWith('#') ? hashRaw.slice(1) : hashRaw)
  return { params, hash }
}

function waitForAuthSession(sb: SupabaseClient, timeoutMs = 5000): Promise<Session | null> {
  return new Promise((resolve) => {
    let settled = false
    const finish = (session: Session | null) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      sub.subscription.unsubscribe()
      resolve(session)
    }

    const { data: sub } = sb.auth.onAuthStateChange((event, session) => {
      if ((event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') && session?.user) {
        finish(session)
      }
    })

    void sb.auth.getSession().then(({ data }) => {
      if (data.session?.user) finish(data.session)
    })

    const timer = window.setTimeout(() => finish(null), timeoutMs)
  })
}

/** Exchange the email-link `code` / hash tokens so `updateUser` has a session. */
let recoverySessionInFlight: Promise<{ session: Session | null; error?: string }> | null = null

export async function establishRecoverySession(): Promise<{ session: Session | null; error?: string }> {
  if (recoverySessionInFlight) return recoverySessionInFlight
  recoverySessionInFlight = establishRecoverySessionOnce().finally(() => {
    // Allow a fresh attempt if the user requests another link in-tab.
    if (typeof window !== 'undefined') {
      window.setTimeout(() => {
        recoverySessionInFlight = null
      }, 1500)
    } else {
      recoverySessionInFlight = null
    }
  })
  return recoverySessionInFlight
}

async function establishRecoverySessionOnce(): Promise<{ session: Session | null; error?: string }> {
  const sb = getSupabaseBrowser()
  if (!sb) {
    return { session: null, error: 'Password reset is temporarily unavailable. Please try again later.' }
  }

  const { params, hash } = readRecoveryUrlParts()
  const urlError = params.get('error_description') || params.get('error') || hash.get('error_description') || hash.get('error')
  if (urlError) {
    return { session: null, error: friendlyAuthError(urlError.replace(/\+/g, ' ')) }
  }

  const tokenHash = params.get('token_hash') || hash.get('token_hash')
  const otpType = (params.get('type') || hash.get('type') || 'recovery') as
    | 'recovery'
    | 'email'
    | 'invite'
    | 'magiclink'
    | 'signup'

  // token_hash works across browsers (no PKCE verifier). prefer it.
  if (tokenHash) {
    const verified = await sb.auth.verifyOtp({
      token_hash: tokenHash,
      type: otpType === 'email' ? 'email' : 'recovery',
    })
    if (verified.data.session?.user) {
      stripAuthParamsFromUrl()
      return { session: verified.data.session }
    }
    if (verified.error) {
      return { session: null, error: friendlyAuthError(verified.error.message) }
    }
  }

  const accessToken = hash.get('access_token') || params.get('access_token')
  const refreshToken = hash.get('refresh_token') || params.get('refresh_token')
  if (accessToken && refreshToken) {
    const { data, error } = await sb.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    })
    if (data.session?.user) {
      stripAuthParamsFromUrl()
      return { session: data.session }
    }
    if (error) return { session: null, error: friendlyAuthError(error.message) }
  }

  const code = params.get('code')
  if (code) {
    const exchanged = await sb.auth.exchangeCodeForSession(code)
    if (exchanged.data.session?.user) {
      stripAuthParamsFromUrl()
      return { session: exchanged.data.session }
    }
    if (exchanged.error) {
      // Fall through to existing session / waiter before failing hard.
      const pkceFail = friendlyAuthError(exchanged.error.message)
      const afterExchange = await sb.auth.getSession()
      if (afterExchange.data.session?.user) {
        stripAuthParamsFromUrl()
        return { session: afterExchange.data.session }
      }
      const awaited = await waitForAuthSession(sb, 2500)
      if (awaited?.user) {
        stripAuthParamsFromUrl()
        return { session: awaited }
      }
      return { session: null, error: pkceFail }
    }
  }

  // Only reuse an existing session when the URL no longer carries a recovery
  // one-time token. Returning early used to strip `code`/`token_hash` and burn
  // valid reset links when a stale session was already present.
  const hasRecoveryParams =
    Boolean(tokenHash) ||
    Boolean(code) ||
    Boolean(accessToken) ||
    params.get('type') === 'recovery' ||
    hash.get('type') === 'recovery'

  if (!hasRecoveryParams) {
    const existing = await sb.auth.getSession()
    if (existing.data.session?.user) {
      return { session: existing.data.session }
    }
  } else {
    const awaited = await waitForAuthSession(sb)
    if (awaited?.user) {
      stripAuthParamsFromUrl()
      return { session: awaited }
    }
  }

  return {
    session: null,
    error: friendlyAuthError(params.get('error_description') || params.get('error'), RESET_LINK_EXPIRED),
  }
}

export type { Session, User }

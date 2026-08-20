import { createClient, type SupabaseClient, type Session, type User } from '@supabase/supabase-js'
import { appOrigin, brandOrigin, isSplitHostsEnabled, resolveSiteRole } from '@shared/hosts'

const url = (import.meta.env.VITE_SUPABASE_URL || '').trim()
const anon = (
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  ''
).trim()

export const supabaseConfigured = Boolean(url && anon)

let client: SupabaseClient | null = null

function shouldDetectSessionInUrl() {
  const role = resolveSiteRole()
  // Only exchange OAuth `?code=` on the app (or combined local) host — never on
  // the marketing site, or PKCE verifier / session land on the wrong origin.
  return role === 'app' || role === 'brand' || role === 'all'
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

/** Canonical OAuth return URL — must be listed in Supabase Auth redirect allowlist. */
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
  return `${appOrigin()}${path.startsWith('/') ? path : `/${path}`}`
}

export function brandResetPasswordCallbackUrl() {
  const origin =
    typeof window !== 'undefined' && !isSplitHostsEnabled()
      ? window.location.origin
      : brandOrigin()
  return `${origin}/brand/reset-password?next=${encodeURIComponent('/brand')}`
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
  const sb = getSupabaseBrowser()
  if (!sb) return { error: 'Password reset is temporarily unavailable. Please try again later.' }
  const normalized = email.trim().toLowerCase()
  if (!normalized) return { error: 'Email is required' }

  const { error } = await sb.auth.resetPasswordForEmail(normalized, {
    redirectTo: redirectTo || resetPasswordCallbackUrl(),
  })

  if (error) return { error: error.message }
  return {}
}

const RESET_LINK_EXPIRED =
  'This reset link is invalid or expired. Please request a new one from the login page.'

export function friendlyAuthError(message: string | undefined | null, fallback = RESET_LINK_EXPIRED): string {
  const raw = (message || '').trim()
  if (!raw) return fallback
  const lower = raw.toLowerCase()
  if (
    lower.includes('auth session missing') ||
    lower.includes('session missing') ||
    lower.includes('invalid flow state') ||
    lower.includes('pkce') ||
    lower.includes('code verifier') ||
    lower.includes('expired') ||
    lower.includes('invalid or expired')
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

function waitForAuthSession(sb: SupabaseClient, timeoutMs = 4000): Promise<Session | null> {
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

    const timer = window.setTimeout(() => finish(null), timeoutMs)
  })
}

/** Exchange the email-link `code` / hash tokens so `updateUser` has a session. */
let recoverySessionInFlight: Promise<{ session: Session | null; error?: string }> | null = null

export async function establishRecoverySession(): Promise<{ session: Session | null; error?: string }> {
  if (recoverySessionInFlight) return recoverySessionInFlight
  recoverySessionInFlight = establishRecoverySessionOnce()
  return recoverySessionInFlight
}

async function establishRecoverySessionOnce(): Promise<{ session: Session | null; error?: string }> {
  const sb = getSupabaseBrowser()
  if (!sb) {
    return { session: null, error: 'Password reset is temporarily unavailable. Please try again later.' }
  }

  const initial = await sb.auth.getSession()
  if (initial.data.session?.user) {
    stripAuthParamsFromUrl()
    return { session: initial.data.session }
  }

  const params = new URLSearchParams(
    typeof window !== 'undefined' ? window.location.search.replace(/^\?/, '') : '',
  )
  const code = params.get('code')
  if (code) {
    const exchanged = await sb.auth.exchangeCodeForSession(code)
    if (exchanged.data.session?.user) {
      stripAuthParamsFromUrl()
      return { session: exchanged.data.session }
    }
    const afterExchange = await sb.auth.getSession()
    if (afterExchange.data.session?.user) {
      stripAuthParamsFromUrl()
      return { session: afterExchange.data.session }
    }
  }

  const hash = typeof window !== 'undefined' ? window.location.hash : ''
  const tokens = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash)
  const accessToken = tokens.get('access_token')
  const refreshToken = tokens.get('refresh_token')
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

  const hasCallback = Boolean(code) || Boolean(accessToken) || tokens.get('type') === 'recovery'
  if (hasCallback) {
    const awaited = await waitForAuthSession(sb)
    if (awaited?.user) {
      stripAuthParamsFromUrl()
      return { session: awaited }
    }
  }

  const lastError = initial.error?.message || params.get('error_description') || params.get('error')
  return { session: null, error: friendlyAuthError(lastError, RESET_LINK_EXPIRED) }
}

export type { Session, User }

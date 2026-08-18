import { createClient, type SupabaseClient, type Session, type User } from '@supabase/supabase-js'
import { appOrigin, resolveSiteRole } from '@shared/hosts'

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
  return role === 'app' || role === 'all'
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

/** Redirect target for Supabase "reset your password" email links. */
export function resetPasswordCallbackUrl() {
  return `${appOrigin()}/reset-password`
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
}): Promise<{ error?: string; needsEmailConfirm?: boolean }> {
  const sb = getSupabaseBrowser()
  if (!sb) return { error: 'Sign-up is temporarily unavailable. Please try again later.' }
  const { data, error } = await sb.auth.signUp({
    email: opts.email.trim().toLowerCase(),
    password: opts.password,
    options: {
      emailRedirectTo: authCallbackUrl('/dashboard'),
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

export async function resetPasswordForEmail(email: string): Promise<{ error?: string }> {
  const sb = getSupabaseBrowser()
  if (!sb) return { error: 'Password reset is temporarily unavailable. Please try again later.' }
  const normalized = email.trim().toLowerCase()
  if (!normalized) return { error: 'Email is required' }

  const { error } = await sb.auth.resetPasswordForEmail(normalized, {
    redirectTo: resetPasswordCallbackUrl(),
  })

  if (error) return { error: error.message }
  return {}
}

export type { Session, User }

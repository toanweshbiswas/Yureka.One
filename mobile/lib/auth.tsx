import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { Platform } from 'react-native'
import * as AppleAuthentication from 'expo-apple-authentication'
import * as Linking from 'expo-linking'
import * as WebBrowser from 'expo-web-browser'
import { apiFetch, setApiTokenGetter } from './api'
import { authRedirectUri } from './authRedirect'
import { signInWithGoogleOAuth } from './googleAuth'
import { supabase, supabaseConfigured, type Session, type User } from './supabase'

WebBrowser.maybeCompleteAuthSession()

export type AppUserStatus =
  | 'none'
  | 'pending'
  | 'accepted'
  | 'admin'
  | 'loading'
  | 'rejected'
  | 'on-hold'

type AuthContextValue = {
  user: User | null
  session: Session | null
  status: AppUserStatus
  ready: boolean
  error: string | null
  canEnterApp: boolean
  signInWithEmail: (email: string, password: string) => Promise<void>
  signUpWithEmail: (email: string, password: string, fullName: string) => Promise<{ needsConfirm: boolean }>
  signInWithGoogle: () => Promise<void>
  signInWithApple: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
  signOut: () => Promise<void>
  refreshStatus: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function normalizeStatus(raw?: string | null): AppUserStatus {
  if (!raw) return 'none'
  if (raw === 'on_hold' || raw === 'on-hold') return 'on-hold'
  if (raw === 'pending' || raw === 'accepted' || raw === 'rejected' || raw === 'admin' || raw === 'none') return raw
  return 'none'
}

async function fetchStatus(email: string): Promise<AppUserStatus> {
  try {
    const res = await apiFetch<{ status?: string }>(
      `/api/v1/auth/status?email=${encodeURIComponent(email)}`,
    )
    return normalizeStatus(res.data?.status)
  } catch {
    return 'none'
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [status, setStatus] = useState<AppUserStatus>('loading')
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setApiTokenGetter(() => session?.access_token ?? null)
  }, [session])

  const refreshStatus = useCallback(async () => {
    const email = user?.email
    if (!email) {
      setStatus('none')
      return
    }
    const next = await fetchStatus(email)
    setStatus(next)
  }, [user?.email])

  useEffect(() => {
    if (!supabase) {
      setReady(true)
      setStatus('none')
      return
    }
    let alive = true
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return
      setSession(data.session)
      setUser(data.session?.user ?? null)
      setReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      setUser(next?.user ?? null)
    })

    const client = supabase
    const consumeAuthUrl = async (url: string) => {
      try {
        const parsed = new URL(url)
        if (!parsed.pathname.includes('/auth/callback')) return
        const code = parsed.searchParams.get('code')
        if (!code) return
        // auth/callback screen performs the exchange; avoid double-handling here.
        if (parsed.protocol === 'yureka:') return
        const { error: exchangeError } = await client.auth.exchangeCodeForSession(code)
        if (exchangeError) setError(exchangeError.message)
      } catch {
        /* ignore malformed deep links */
      }
    }
    const linkSub = Linking.addEventListener('url', ({ url }) => {
      void consumeAuthUrl(url)
    })
    void Linking.getInitialURL().then((url) => {
      if (url) void consumeAuthUrl(url)
    })

    return () => {
      alive = false
      sub.subscription.unsubscribe()
      linkSub.remove()
    }
  }, [])

  useEffect(() => {
    if (!ready) return
    if (!user?.email) {
      setStatus('none')
      return
    }
    void refreshStatus()
  }, [ready, user?.email, refreshStatus])

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error('Sign-in is unavailable')
    setError(null)
    const { error: err } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })
    if (err) throw new Error(err.message)
  }, [])

  const signUpWithEmail = useCallback(async (email: string, password: string, fullName: string) => {
    if (!supabase) throw new Error('Sign-up is unavailable')
    setError(null)
    const { data, error: err } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: { data: { full_name: fullName.trim() } },
    })
    if (err) throw new Error(err.message)
    return { needsConfirm: !data.session }
  }, [])

  const signInWithGoogle = useCallback(async () => {
    if (!supabase) throw new Error('Sign-in is unavailable')
    setError(null)
    await signInWithGoogleOAuth(supabase)
  }, [])

  const signInWithApple = useCallback(async () => {
    if (!supabase) throw new Error('Sign-in is unavailable')
    if (Platform.OS !== 'ios') throw new Error('Apple sign-in is only on iOS')
    setError(null)
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    })
    if (!credential.identityToken) throw new Error('Apple sign-in did not return a token')
    const { error: err } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
    })
    if (err) throw new Error(err.message)
  }, [])

  const resetPassword = useCallback(async (email: string) => {
    if (!supabase) throw new Error('Reset is unavailable')
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: authRedirectUri(),
    })
    if (err) throw new Error(err.message)
  }, [])

  const signOut = useCallback(async () => {
    await supabase?.auth.signOut()
    setStatus('none')
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      status,
      ready,
      error,
      canEnterApp: status === 'accepted' || status === 'admin',
      signInWithEmail,
      signUpWithEmail,
      signInWithGoogle,
      signInWithApple,
      resetPassword,
      signOut,
      refreshStatus,
    }),
    [
      user,
      session,
      status,
      ready,
      error,
      signInWithEmail,
      signUpWithEmail,
      signInWithGoogle,
      signInWithApple,
      resetPassword,
      signOut,
      refreshStatus,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

export { supabaseConfigured }

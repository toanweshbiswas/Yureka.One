import * as Linking from 'expo-linking'
import * as WebBrowser from 'expo-web-browser'
import type { SupabaseClient } from '@supabase/supabase-js'
import { authRedirectUri } from './authRedirect'

function parseOAuthCode(url: string): string | null {
  const parsed = Linking.parse(url)
  const raw = parsed.queryParams?.code
  if (typeof raw === 'string') return raw
  if (Array.isArray(raw) && raw[0]) return raw[0]
  return null
}

function redirectLooksNative(oauthUrl: string): boolean {
  try {
    const redirectTo = new URL(oauthUrl).searchParams.get('redirect_to')
    return Boolean(redirectTo?.startsWith('yureka://'))
  } catch {
    return false
  }
}

function waitForSignedIn(client: SupabaseClient, ms = 90_000) {
  let timeout: ReturnType<typeof setTimeout>
  let sub: { subscription: { unsubscribe: () => void } }
  const promise = new Promise<void>((resolve, reject) => {
    timeout = setTimeout(() => {
      sub.subscription.unsubscribe()
      reject(new Error('Sign-in timed out. Try again.'))
    }, ms)
    sub = client.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        clearTimeout(timeout)
        sub.subscription.unsubscribe()
        resolve()
      }
    }).data
  })
  const cancel = () => {
    clearTimeout(timeout)
    sub.subscription.unsubscribe()
  }
  return { promise, cancel }
}

export async function signInWithGoogleOAuth(client: SupabaseClient) {
  const redirectTo = authRedirectUri()
  const { data, error: err } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      queryParams: { prompt: 'select_account', access_type: 'online' },
      scopes: 'openid email profile',
    },
  })
  if (err) throw new Error(err.message)
  if (!data.url) throw new Error('Could not start Google sign-in')
  if (!redirectLooksNative(data.url)) {
    throw new Error(
      'Supabase must allow yureka://auth/callback as a redirect URL (Authentication → URL configuration).',
    )
  }

  const { promise: sessionPromise, cancel: cancelSessionWait } = waitForSignedIn(client)
  try {
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo)

    if (result.type === 'success' && result.url) {
      const code = parseOAuthCode(result.url)
      if (code) {
        const { error: exchangeError } = await client.auth.exchangeCodeForSession(code)
        if (exchangeError) throw new Error(exchangeError.message)
        return
      }
    }

    try {
      await sessionPromise
      return
    } catch {
      /* fall through */
    }

    if (result.type === 'cancel' || result.type === 'dismiss') {
      throw new Error('Sign-in was interrupted. Try again.')
    }
    throw new Error('Could not complete Google sign-in. Check Supabase redirect URLs.')
  } finally {
    cancelSessionWait()
  }
}

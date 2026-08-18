/**
 * Google Identity Services helper for Gmail read-only consent.
 * Login (Supabase) only asks for openid/email/profile.
 * Spending sync needs a separate gmail.readonly token.
 */

const GMAIL_READONLY = 'https://www.googleapis.com/auth/gmail.readonly'
const TOKEN_KEY = 'yureka_gmail_readonly_token'
const TOKEN_EXP_KEY = 'yureka_gmail_readonly_token_exp'

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (config: {
            client_id: string
            scope: string
            callback: (response: {
              access_token?: string
              expires_in?: number
              error?: string
              error_description?: string
            }) => void
            error_callback?: (err: unknown) => void
          }) => {
            requestAccessToken: (opts?: { prompt?: string }) => void
          }
        }
      }
    }
  }
}

export function getStoredGmailAccessToken(): string | null {
  try {
    const token = sessionStorage.getItem(TOKEN_KEY)
    const exp = Number(sessionStorage.getItem(TOKEN_EXP_KEY) || 0)
    if (!token) return null
    if (exp && Date.now() > exp - 60_000) {
      sessionStorage.removeItem(TOKEN_KEY)
      sessionStorage.removeItem(TOKEN_EXP_KEY)
      return null
    }
    return token
  } catch {
    return null
  }
}

export function clearStoredGmailAccessToken() {
  try {
    sessionStorage.removeItem(TOKEN_KEY)
    sessionStorage.removeItem(TOKEN_EXP_KEY)
  } catch {
    // ignore
  }
}

function storeGmailAccessToken(token: string, expiresInSec?: number) {
  try {
    sessionStorage.setItem(TOKEN_KEY, token)
    const exp = Date.now() + Math.max(60, Number(expiresInSec || 3500)) * 1000
    sessionStorage.setItem(TOKEN_EXP_KEY, String(exp))
  } catch {
    // ignore
  }
}

export function requestGmailReadonlyToken(opts?: {
  forceConsent?: boolean
}): Promise<{ accessToken?: string; error?: string; needsConsent?: boolean }> {
  const clientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim()
  if (!clientId) {
    return Promise.resolve({
      error: 'Google Client ID is not configured (VITE_GOOGLE_CLIENT_ID).',
    })
  }

  if (!opts?.forceConsent) {
    const existing = getStoredGmailAccessToken()
    if (existing) return Promise.resolve({ accessToken: existing })
  }

  const google = window.google
  if (!google?.accounts?.oauth2?.initTokenClient) {
    return Promise.resolve({
      error: 'Google sign-in failed to load. Refresh the page and try again.',
      needsConsent: true,
    })
  }

  return new Promise((resolve) => {
    try {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: GMAIL_READONLY,
        callback: (tokenResponse) => {
          if (tokenResponse?.error || !tokenResponse?.access_token) {
            const code = String(tokenResponse?.error || '')
            const denied = /access_denied|403/i.test(code) || /access_denied|verification/i.test(String(tokenResponse?.error_description || ''))
            resolve({
              error: denied
                ? 'Gmail access is limited until Google verifies Yureka (or adds your email as a test user). You can continue without inbox sync.'
                : tokenResponse?.error_description ||
                  tokenResponse?.error ||
                  'Gmail access was denied. Grant read-only inbox access to sync spending.',
              needsConsent: true,
            })
            return
          }
          storeGmailAccessToken(tokenResponse.access_token, tokenResponse.expires_in)
          resolve({ accessToken: tokenResponse.access_token })
        },
        error_callback: () => {
          resolve({
            error: 'Gmail consent popup was blocked or closed.',
            needsConsent: true,
          })
        },
      })
      client.requestAccessToken(
        opts?.forceConsent ? { prompt: 'consent' } : {}
      )
    } catch (e: any) {
      resolve({
        error: e?.message || 'Failed to start Gmail consent',
        needsConsent: true,
      })
    }
  })
}

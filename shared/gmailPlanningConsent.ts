/**
 * Isolated Gmail consent for extra planning inboxes.
 * Never reads or writes yureka_gmail_readonly_token (primary ledger scan).
 */

const GMAIL_READONLY = 'https://www.googleapis.com/auth/gmail.readonly'
const TOKEN_MAP_KEY = 'yureka_planning_gmail_tokens'

type TokenEntry = { token: string; exp: number }
type TokenMap = Record<string, TokenEntry>

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function readMap(): TokenMap {
  try {
    const raw = sessionStorage.getItem(TOKEN_MAP_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as TokenMap
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeMap(map: TokenMap) {
  try {
    sessionStorage.setItem(TOKEN_MAP_KEY, JSON.stringify(map))
  } catch {
    // ignore
  }
}

export function getPlanningGmailToken(email: string): string | null {
  const key = normalizeEmail(email)
  if (!key) return null
  const map = readMap()
  const entry = map[key]
  if (!entry?.token) return null
  if (entry.exp && Date.now() > entry.exp - 60_000) {
    delete map[key]
    writeMap(map)
    return null
  }
  return entry.token
}

export function storePlanningGmailToken(email: string, token: string, expiresInSec?: number) {
  const key = normalizeEmail(email)
  if (!key || !token) return
  const map = readMap()
  map[key] = {
    token,
    exp: Date.now() + Math.max(60, Number(expiresInSec || 3500)) * 1000,
  }
  writeMap(map)
}

export function clearPlanningGmailToken(email: string) {
  const map = readMap()
  delete map[normalizeEmail(email)]
  writeMap(map)
}

export function requestPlanningGmailToken(opts?: {
  hint?: string
}): Promise<{ accessToken?: string; error?: string; needsConsent?: boolean }> {
  const clientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim()
  if (!clientId) {
    return Promise.resolve({
      error: 'Google Client ID is not configured (VITE_GOOGLE_CLIENT_ID).',
    })
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
        include_granted_scopes: false,
        callback: (tokenResponse) => {
          if (tokenResponse?.error || !tokenResponse?.access_token) {
            const code = String(tokenResponse?.error || '')
            const denied =
              /access_denied|403/i.test(code) ||
              /access_denied|verification/i.test(String(tokenResponse?.error_description || ''))
            resolve({
              error: denied
                ? 'Gmail access was declined. You can add another inbox later, or continue without it.'
                : tokenResponse?.error_description ||
                  tokenResponse?.error ||
                  'Gmail access was denied. Grant read-only inbox access to add another account.',
              needsConsent: true,
            })
            return
          }
          resolve({ accessToken: tokenResponse.access_token })
        },
        error_callback: () => {
          resolve({
            error: 'Gmail consent popup was blocked or closed.',
            needsConsent: true,
          })
        },
      })
      client.requestAccessToken({
        prompt: 'select_account',
        ...(opts?.hint ? { hint: opts.hint } : {}),
      } as { prompt?: string })
    } catch (e: any) {
      resolve({
        error: e?.message || 'Failed to start Gmail consent',
        needsConsent: true,
      })
    }
  })
}

export async function requestPlanningGmailTokenForInbox(email: string): Promise<{
  accessToken?: string
  error?: string
  needsConsent?: boolean
}> {
  const existing = getPlanningGmailToken(email)
  if (existing) return { accessToken: existing }
  const next = await requestPlanningGmailToken({ hint: email })
  if (next.accessToken) storePlanningGmailToken(email, next.accessToken)
  return next
}

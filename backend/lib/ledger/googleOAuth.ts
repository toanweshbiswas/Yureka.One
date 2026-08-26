/** Exchange Google OAuth authorization code for tokens (offline refresh). */
export async function exchangeGoogleAuthCode(opts: {
  code: string
  redirectUri?: string
}): Promise<{
  accessToken: string
  refreshToken?: string
  expiresIn?: number
  email?: string
}> {
  const clientId = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || ''
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || ''
  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required for Gmail connect')
  }

  const body = new URLSearchParams({
    code: opts.code,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'authorization_code',
    redirect_uri: opts.redirectUri || 'postmessage',
  })

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const json = (await res.json()) as Record<string, unknown>
  if (!res.ok) {
    const err = String(json.error_description || json.error || res.status)
    if (/invalid_grant|expired|revoked/i.test(err)) {
      throw new Error('AUTH_EXPIRED')
    }
    throw new Error(err)
  }

  const accessToken = String(json.access_token || '')
  if (!accessToken) throw new Error('Google token exchange returned no access_token')

  return {
    accessToken,
    refreshToken: json.refresh_token ? String(json.refresh_token) : undefined,
    expiresIn: json.expires_in ? Number(json.expires_in) : undefined,
  }
}

/** Refresh a stored Gmail access token. */
export async function refreshGoogleAccessToken(refreshToken: string): Promise<{
  accessToken: string
  expiresIn?: number
  refreshToken?: string
}> {
  const clientId = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || ''
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || ''
  if (!clientId || !clientSecret) throw new Error('Google OAuth client not configured')

  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
  })

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const json = (await res.json()) as Record<string, unknown>
  if (!res.ok) {
    const err = String(json.error_description || json.error || res.status)
    if (/invalid_grant|expired|revoked/i.test(err)) throw new Error('AUTH_EXPIRED')
    throw new Error(err)
  }

  const accessToken = String(json.access_token || '')
  if (!accessToken) throw new Error('Refresh returned no access_token')

  return {
    accessToken,
    expiresIn: json.expires_in ? Number(json.expires_in) : undefined,
    refreshToken: json.refresh_token ? String(json.refresh_token) : undefined,
  }
}

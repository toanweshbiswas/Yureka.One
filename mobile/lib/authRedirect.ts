import * as AuthSession from 'expo-auth-session'

/** Must match Supabase Auth → Redirect URLs and Google OAuth client. */
export const NATIVE_AUTH_REDIRECT_URI = 'yureka://auth/callback'

/** Always return the custom scheme so OAuth closes Safari and re-opens the app. */
export function authRedirectUri() {
  const generated = AuthSession.makeRedirectUri({
    scheme: 'yureka',
    path: 'auth/callback',
    native: NATIVE_AUTH_REDIRECT_URI,
    preferLocalhost: false,
  })
  return generated.startsWith('yureka://') ? generated : NATIVE_AUTH_REDIRECT_URI
}

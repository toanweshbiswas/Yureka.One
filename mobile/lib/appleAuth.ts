import type { SupabaseClient } from '@supabase/supabase-js'
import { Platform } from 'react-native'

/** Lazy-load Apple auth so personal-team builds (module excluded) don't crash at import. */
export async function isAppleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false
  try {
    const AppleAuthentication = await import('expo-apple-authentication')
    return AppleAuthentication.isAvailableAsync()
  } catch {
    return false
  }
}

export async function signInWithAppleNative(client: SupabaseClient): Promise<void> {
  if (Platform.OS !== 'ios') throw new Error('Apple sign-in is only on iOS')
  const AppleAuthentication = await import('expo-apple-authentication')
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  })
  if (!credential.identityToken) throw new Error('Apple sign-in did not return a token')
  const { error } = await client.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
  })
  if (error) throw new Error(error.message)
}

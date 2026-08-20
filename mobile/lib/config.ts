export const API_URL = (process.env.EXPO_PUBLIC_API_URL || 'https://app.yureka.one').replace(/\/$/, '')
export const APP_URL = (process.env.EXPO_PUBLIC_APP_URL || 'https://app.yureka.one').replace(/\/$/, '')
export const LANDING_URL = (process.env.EXPO_PUBLIC_LANDING_URL || 'https://yureka.one').replace(/\/$/, '')
export const SUPABASE_URL = (process.env.EXPO_PUBLIC_SUPABASE_URL || '').trim()
export const SUPABASE_ANON_KEY = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '').trim()
export const SUPPORT_EMAIL = 'support@yureka.one'
export const TERMS_URL = `${LANDING_URL}/terms-of-service`
export const PRIVACY_URL = `${LANDING_URL}/privacy-policy`
export const CONTACT_URL = `${LANDING_URL}/contact`

export function supabaseProjectRef() {
  try {
    return new URL(SUPABASE_URL).hostname.split('.')[0]
  } catch {
    return ''
  }
}

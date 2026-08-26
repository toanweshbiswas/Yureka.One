/**
 * Browser Supabase client. re-export of the app auth helper.
 * Prefer `getSupabaseBrowser()` / `signInWithGmail()` from `@shared/auth` for auth flows.
 */
export { getSupabaseBrowser as getSupabase, supabaseConfigured } from '@shared/auth'
import { getSupabaseBrowser } from '@shared/auth'

/** Lazily created client (null if env is missing). */
export const supabase = getSupabaseBrowser()

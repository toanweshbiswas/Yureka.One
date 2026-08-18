import type { User } from '@supabase/supabase-js'

export function googleAvatarUrl(user?: User | null): string | null {
  if (!user) return null
  const meta = user.user_metadata || {}
  const fromMeta = String(meta.avatar_url || meta.picture || '').trim()
  if (fromMeta.startsWith('http')) return fromMeta
  const identities = user.identities || []
  for (const ident of identities) {
    const data = (ident.identity_data || {}) as Record<string, unknown>
    const url = String(data.avatar_url || data.picture || '').trim()
    if (url.startsWith('http')) return url
  }
  return null
}

export function prettyGender(value?: string | null): string {
  const g = String(value || '').trim().toLowerCase()
  if (g === 'male' || g === 'masculine') return 'Male'
  if (g === 'female' || g === 'feminine') return 'Female'
  if (g === 'other' || g === 'undisclosed') return 'Other'
  return g ? g[0].toUpperCase() + g.slice(1) : '—'
}

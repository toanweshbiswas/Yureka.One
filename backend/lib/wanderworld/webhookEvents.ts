import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let sb: SupabaseClient | null = null

function client(): SupabaseClient | null {
  if (sb) return sb
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  sb = createClient(url, key, { auth: { persistSession: false } })
  return sb
}

function isMissingTable(msg: string | undefined) {
  const t = String(msg || '').toLowerCase()
  return t.includes('does not exist') || t.includes('could not find') || t.includes('schema cache')
}

export async function claimWwWebhookEvent(eventKey: string, kind: string, payload: unknown): Promise<boolean> {
  const c = client()
  if (!c) return false
  const { error } = await c.from('wanderworld_webhook_events').insert({
    event_key: eventKey,
    kind,
    payload: payload ?? {},
  })
  if (error) {
    if (error.code === '23505') return false
    if (isMissingTable(error.message)) return false
    console.warn('[wanderworld] webhook event insert failed:', error.message)
    return false
  }
  return true
}

export async function hasWwWebhookEvent(eventKey: string): Promise<boolean> {
  const c = client()
  if (!c) return false
  const { data, error } = await c.from('wanderworld_webhook_events').select('event_key').eq('event_key', eventKey).maybeSingle()
  if (error) {
    if (isMissingTable(error.message)) return false
    return false
  }
  return Boolean(data)
}

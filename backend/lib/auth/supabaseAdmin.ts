import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'

function getServiceClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Supabase service role is not configured (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)')
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

function isAlreadyRegistered(message: string | undefined) {
  const text = String(message || '').toLowerCase()
  return (
    text.includes('already been registered') ||
    text.includes('already registered') ||
    text.includes('user already exists') ||
    text.includes('email address is already')
  )
}

async function findAuthUserByEmail(sb: SupabaseClient, email: string): Promise<User | null> {
  const target = email.trim().toLowerCase()
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw new Error(error.message)
    const users = data?.users || []
    const match = users.find((u) => String(u.email || '').trim().toLowerCase() === target)
    if (match) return match
    if (users.length < 200) break
  }
  return null
}

export async function createAppAuthUser(opts: {
  email: string
  password: string
  fullName?: string | null
}): Promise<{ userId: string; created: boolean; passwordUpdated: boolean }> {
  const email = opts.email.trim().toLowerCase()
  const sb = getServiceClient()
  const metadata = opts.fullName ? { full_name: opts.fullName.trim() } : undefined

  const created = await sb.auth.admin.createUser({
    email,
    password: opts.password,
    email_confirm: true,
    user_metadata: metadata,
  })

  if (!created.error && created.data.user?.id) {
    return { userId: created.data.user.id, created: true, passwordUpdated: true }
  }

  if (!isAlreadyRegistered(created.error?.message)) {
    throw new Error(created.error?.message || 'Failed to create auth user')
  }

  const existing = await findAuthUserByEmail(sb, email)
  if (!existing?.id) {
    throw new Error('An account with this email already exists, but it could not be updated')
  }

  const updated = await sb.auth.admin.updateUserById(existing.id, {
    password: opts.password,
    email_confirm: true,
    user_metadata: metadata || existing.user_metadata,
  })
  if (updated.error || !updated.data.user?.id) {
    throw new Error(updated.error?.message || 'Failed to update existing auth user password')
  }

  return { userId: updated.data.user.id, created: false, passwordUpdated: true }
}

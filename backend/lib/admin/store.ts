import fs from 'fs'
import path from 'path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'
import type { AdminRole } from './auth.js'

export interface WaitlistRow {
  id: string
  email: string
  fullName: string | null
  mobileNumber: string | null
  status: 'pending' | 'accepted' | 'rejected' | 'on_hold'
  yurekaScore: number | null
  scoreDecision: string | null
  scoreMetrics: Record<string, unknown> | null
  monthlySpend: string | null
  topCategory: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface AdminUserRow {
  id: string
  email: string
  fullName: string | null
  role: AdminRole
  createdAt: string
  hasPassword?: boolean
  invitePending?: boolean
}

export interface AdminAuthState {
  passwordHash: string | null
  inviteTokenHash: string | null
  inviteExpiresAt: string | null
  passwordSetAt: string | null
}

interface AdminFileStore {
  waitlist: WaitlistRow[]
  admins: AdminUserRow[]
}

function filePath() {
  return path.join(process.cwd(), 'data', 'admin_store.json')
}

function authFilePath() {
  return path.join(process.cwd(), 'data', 'admin_auth.json')
}

function getSupabase(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

async function withTimeout<T>(promise: PromiseLike<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      Promise.resolve(promise),
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

/** Skip Supabase briefly after failures so waitlist join stays fast under Netlify proxy limits. */
let supabaseCircuitOpenUntil = 0
let supabaseFailStreak = 0
let supabaseSchemaUnavailable = false
const SUPABASE_WAITLIST_TIMEOUT_MS = Number(process.env.SUPABASE_WAITLIST_TIMEOUT_MS || 10000)
const SUPABASE_CIRCUIT_MS = Number(process.env.SUPABASE_CIRCUIT_MS || 20000)

function supabaseWaitlistAllowed() {
  return !supabaseSchemaUnavailable && Date.now() >= supabaseCircuitOpenUntil
}

function isMissingSchemaError(message: string | undefined) {
  const text = String(message || '').toLowerCase()
  return text.includes("could not find the table") || text.includes('schema cache')
}

function disableSupabaseSchema(reason: unknown) {
  supabaseSchemaUnavailable = true
  console.warn('[waitlist] supabase schema unavailable, falling back to file store:', (reason as Error)?.message || reason)
}

function tripSupabaseCircuit(reason: unknown) {
  supabaseFailStreak += 1
  // Don't open the circuit on a single cold-start timeout. join/auth would
  // silently fall back to the empty local file store.
  if (supabaseFailStreak < 2) {
    console.warn(
      '[waitlist] supabase soft-fail (streak',
      supabaseFailStreak,
      '):',
      (reason as Error)?.message || reason
    )
    return
  }
  supabaseCircuitOpenUntil = Date.now() + SUPABASE_CIRCUIT_MS
  console.warn(
    `[waitlist] supabase circuit open ${Math.round(SUPABASE_CIRCUIT_MS / 1000)}s:`,
    (reason as Error)?.message || reason
  )
}

function clearSupabaseCircuit() {
  supabaseFailStreak = 0
}

function seedStore(): AdminFileStore {
  const now = new Date().toISOString()
  const bootstrapEmail =
    (process.env.ADMIN_EMAILS || '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .find(Boolean) || 'admin@localhost'
  return {
    admins: [
      {
        id: randomUUID(),
        email: bootstrapEmail,
        fullName: 'Yureka Admin',
        role: 'superadmin',
        createdAt: now,
      },
    ],
    waitlist: [
      {
        id: randomUUID(),
        email: 'priya.sharma@example.com',
        fullName: 'Priya Sharma',
        mobileNumber: '+91 98xxx',
        status: 'pending',
        yurekaScore: 72,
        scoreDecision: 'accept',
        scoreMetrics: null,
        monthlySpend: '₹40k to 60k',
        topCategory: 'shopping',
        notes: null,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: randomUUID(),
        email: 'arjun.mehta@example.com',
        fullName: 'Arjun Mehta',
        mobileNumber: null,
        status: 'accepted',
        yurekaScore: 88,
        scoreDecision: 'accept',
        scoreMetrics: null,
        monthlySpend: '₹80k+',
        topCategory: 'travel',
        notes: null,
        createdAt: now,
        updatedAt: now,
      },
    ],
  }
}

function readFile(): AdminFileStore {
  const p = filePath()
  try {
    if (!fs.existsSync(p)) {
      const s = seedStore()
      fs.mkdirSync(path.dirname(p), { recursive: true })
      fs.writeFileSync(p, JSON.stringify(s, null, 2))
      return s
    }
    return JSON.parse(fs.readFileSync(p, 'utf-8')) as AdminFileStore
  } catch {
    const s = seedStore()
    fs.mkdirSync(path.dirname(p), { recursive: true })
    fs.writeFileSync(p, JSON.stringify(s, null, 2))
    return s
  }
}

function writeFile(s: AdminFileStore) {
  fs.mkdirSync(path.dirname(filePath()), { recursive: true })
  fs.writeFileSync(filePath(), JSON.stringify(s, null, 2))
}

function readAuthMap(): Record<string, AdminAuthState> {
  try {
    if (!fs.existsSync(authFilePath())) return {}
    return JSON.parse(fs.readFileSync(authFilePath(), 'utf-8')) as Record<string, AdminAuthState>
  } catch {
    return {}
  }
}

function writeAuthMap(map: Record<string, AdminAuthState>) {
  fs.mkdirSync(path.dirname(authFilePath()), { recursive: true })
  fs.writeFileSync(authFilePath(), JSON.stringify(map, null, 2))
}

function emptyAuth(): AdminAuthState {
  return { passwordHash: null, inviteTokenHash: null, inviteExpiresAt: null, passwordSetAt: null }
}

function publicAdmin(row: AdminUserRow, auth?: AdminAuthState | null): AdminUserRow {
  const invitePending = Boolean(
    auth?.inviteTokenHash && auth.inviteExpiresAt && new Date(auth.inviteExpiresAt).getTime() > Date.now()
  )
  return {
    id: row.id,
    email: row.email,
    fullName: row.fullName,
    role: row.role,
    createdAt: row.createdAt,
    hasPassword: Boolean(auth?.passwordHash),
    invitePending,
  }
}

export async function getAdminAuth(email: string): Promise<AdminAuthState> {
  const normalized = email.toLowerCase().trim()
  const fromFile = readAuthMap()[normalized]
  const sb = getSupabase()
  if (sb) {
    const { data, error } = await sb
      .from('admin_users')
      .select('password_hash, invite_token_hash, invite_expires_at, password_set_at')
      .eq('email', normalized)
      .maybeSingle()
    if (!error && data) {
      return {
        passwordHash: data.password_hash || fromFile?.passwordHash || null,
        inviteTokenHash: data.invite_token_hash || fromFile?.inviteTokenHash || null,
        inviteExpiresAt: data.invite_expires_at || fromFile?.inviteExpiresAt || null,
        passwordSetAt: data.password_set_at || fromFile?.passwordSetAt || null,
      }
    }
  }
  return fromFile || emptyAuth()
}

async function persistAdminAuth(email: string, auth: AdminAuthState) {
  const normalized = email.toLowerCase().trim()
  const map = readAuthMap()
  map[normalized] = auth
  writeAuthMap(map)

  const sb = getSupabase()
  if (!sb) return
  await sb
    .from('admin_users')
    .update({
      password_hash: auth.passwordHash,
      invite_token_hash: auth.inviteTokenHash,
      invite_expires_at: auth.inviteExpiresAt,
      password_set_at: auth.passwordSetAt,
    })
    .eq('email', normalized)
}

export async function saveAdminInvite(opts: {
  email: string
  tokenHash: string
  expiresAt: string
}): Promise<void> {
  const current = await getAdminAuth(opts.email)
  await persistAdminAuth(opts.email, {
    ...current,
    inviteTokenHash: opts.tokenHash,
    inviteExpiresAt: opts.expiresAt,
  })
}

export async function findAdminByInviteHash(
  tokenHash: string
): Promise<{ admin: AdminUserRow; auth: AdminAuthState } | null> {
  const map = readAuthMap()
  const now = Date.now()
  for (const [email, auth] of Object.entries(map)) {
    if (auth.inviteTokenHash !== tokenHash) continue
    if (!auth.inviteExpiresAt || new Date(auth.inviteExpiresAt).getTime() < now) return null
    const admin = await findAdminByEmail(email)
    if (!admin) return null
    return { admin, auth }
  }

  const sb = getSupabase()
  if (sb) {
    const { data, error } = await sb
      .from('admin_users')
      .select('*')
      .eq('invite_token_hash', tokenHash)
      .maybeSingle()
    if (!error && data) {
      const auth = await getAdminAuth(data.email)
      if (!auth.inviteExpiresAt || new Date(auth.inviteExpiresAt).getTime() < now) return null
      return { admin: mapAdmin(data), auth }
    }
  }
  return null
}

export async function setAdminPassword(email: string, passwordHash: string): Promise<AdminUserRow | null> {
  const admin = await findAdminByEmail(email)
  if (!admin) return null
  await persistAdminAuth(email, {
    passwordHash,
    inviteTokenHash: null,
    inviteExpiresAt: null,
    passwordSetAt: new Date().toISOString(),
  })
  return admin
}

function parseNotes(notes: string | null | undefined): Record<string, any> {
  try {
    return notes ? JSON.parse(notes) : {}
  } catch {
    return {}
  }
}

function mapWaitlist(row: any): WaitlistRow {
  const notes = row.notes ?? null
  const meta = parseNotes(notes)
  const raw = row.yureka_score ?? row.yurekaScore ?? meta.yurekaScore ?? meta.score
  const score = raw != null && Number.isFinite(Number(raw)) ? Number(raw) : null
  const decision = meta.scoreDecision || meta.decision || null
  const metrics = meta.scoreMetrics && typeof meta.scoreMetrics === 'object' ? meta.scoreMetrics : null
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name ?? row.fullName ?? null,
    mobileNumber: row.mobile_number ?? row.mobileNumber ?? null,
    status: row.status,
    yurekaScore: score,
    scoreDecision: typeof decision === 'string' ? decision : null,
    scoreMetrics: metrics,
    monthlySpend: row.monthly_spend ?? row.monthlySpend ?? null,
    topCategory: row.top_category ?? row.topCategory ?? null,
    notes,
    createdAt: row.created_at ?? row.createdAt,
    updatedAt: row.updated_at ?? row.updatedAt,
  }
}

function mapAdmin(row: any): AdminUserRow {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name ?? row.fullName ?? null,
    role: row.role,
    createdAt: row.created_at ?? row.createdAt,
  }
}

export function adminBackendMode(): 'supabase' | 'file' {
  return getSupabase() ? 'supabase' : 'file'
}

export async function findAdminByEmail(email: string): Promise<AdminUserRow | null> {
  const normalized = email.toLowerCase().trim()
  const bootstrap = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)

  const sb = getSupabase()
  if (sb) {
    const { data, error } = await sb.from('admin_users').select('*').eq('email', normalized).maybeSingle()
    if (error && isMissingSchemaError(error.message)) {
      disableSupabaseSchema(error)
    }
    if (!error && data) return mapAdmin(data)
    if (!error && !data && bootstrap.includes(normalized)) {
      return {
        id: 'bootstrap',
        email: normalized,
        fullName: 'Bootstrap Admin',
        role: 'superadmin',
        createdAt: new Date().toISOString(),
      }
    }
  }

  const store = readFile()
  const found = store.admins.find((a) => a.email === normalized)
  if (found) return found
  if (bootstrap.includes(normalized)) {
    return {
      id: 'bootstrap',
      email: normalized,
      fullName: 'Bootstrap Admin',
      role: 'superadmin',
      createdAt: new Date().toISOString(),
    }
  }
  return null
}

export async function listWaitlist(filters: {
  status?: string
  search?: string
  /** Cap rows returned from Supabase (default 2000). Overview / admin UI don't need unbounded scans. */
  limit?: number
}): Promise<WaitlistRow[]> {
  const limit = Math.min(Math.max(Number(filters.limit) || 2000, 1), 5000)
  const sb = getSupabase()
  if (sb && supabaseWaitlistAllowed()) {
    try {
      let q = sb
        .from('waitlist')
        .select(
          'id,email,full_name,mobile_number,status,yureka_score,monthly_spend,top_category,notes,created_at,updated_at',
        )
        .order('created_at', { ascending: false })
        .limit(limit)
      if (filters.status && filters.status !== 'all') q = q.eq('status', filters.status)
      const { data, error } = await withTimeout(
        q,
        SUPABASE_WAITLIST_TIMEOUT_MS,
        'supabase listWaitlist',
      )
      if (error) {
        if (isMissingSchemaError(error.message)) {
          disableSupabaseSchema(error)
        } else {
          console.warn('[waitlist] supabase list error:', error.message)
          tripSupabaseCircuit(error)
        }
      } else {
        clearSupabaseCircuit()
        let rows = (data || []).map(mapWaitlist)
        if (filters.search) {
          const s = filters.search.toLowerCase()
          rows = rows.filter(
            (r) =>
              r.email.toLowerCase().includes(s) ||
              (r.fullName || '').toLowerCase().includes(s),
          )
        }
        return sortWaitlistOperational(rows, filters.status)
      }
    } catch (e) {
      tripSupabaseCircuit(e)
      console.warn('[waitlist] listWaitlist failed:', (e as Error)?.message || e)
    }
  }

  let rows = readFile().waitlist.map((row) => {
    if (row.scoreMetrics) return row
    const meta = parseNotes(row.notes)
    return {
      ...row,
      scoreMetrics: meta.scoreMetrics && typeof meta.scoreMetrics === 'object' ? meta.scoreMetrics : null,
      scoreDecision: row.scoreDecision || (typeof meta.scoreDecision === 'string' ? meta.scoreDecision : null),
    }
  })
  if (filters.status && filters.status !== 'all') {
    rows = rows.filter((r) => r.status === filters.status)
  }
  if (filters.search) {
    const s = filters.search.toLowerCase()
    rows = rows.filter(
      (r) => r.email.toLowerCase().includes(s) || (r.fullName || '').toLowerCase().includes(s)
    )
  }
  return sortWaitlistOperational(rows, filters.status).slice(0, limit)
}

/** Pending / on-hold first when browsing All; otherwise newest first. */
function sortWaitlistOperational(rows: WaitlistRow[], statusFilter?: string): WaitlistRow[] {
  const STATUS_RANK: Record<string, number> = {
    pending: 0,
    on_hold: 1,
    accepted: 2,
    rejected: 3,
  }
  const scoreOf = (r: WaitlistRow) =>
    typeof r.yurekaScore === 'number' && Number.isFinite(r.yurekaScore) ? r.yurekaScore : -1
  const all = !statusFilter || statusFilter === 'all'
  return [...rows].sort((a, b) => {
    if (all) {
      const ra = STATUS_RANK[a.status] ?? 9
      const rb = STATUS_RANK[b.status] ?? 9
      if (ra !== rb) return ra - rb
      const sd = scoreOf(b) - scoreOf(a)
      if (sd) return sd
    }
    return b.createdAt.localeCompare(a.createdAt)
  })
}

export async function updateWaitlistStatus(id: string, status: WaitlistRow['status']): Promise<WaitlistRow | null> {
  const sb = getSupabase()
  const now = new Date().toISOString()
  if (sb) {
    const { data, error } = await sb
      .from('waitlist')
      .update({ status, updated_at: now })
      .eq('id', id)
      .select('*')
      .single()
    if (error && isMissingSchemaError(error.message)) {
      disableSupabaseSchema(error)
    }
    if (!error && data) return mapWaitlist(data)
  }
  const store = readFile()
  const idx = store.waitlist.findIndex((w) => w.id === id)
  if (idx < 0) return null
  store.waitlist[idx] = { ...store.waitlist[idx], status, updatedAt: now }
  writeFile(store)
  return store.waitlist[idx]
}

export async function bulkUpdateWaitlistStatus(ids: string[], status: WaitlistRow['status']) {
  for (const id of ids) await updateWaitlistStatus(id, status)
}

export async function listAdmins(): Promise<AdminUserRow[]> {
  const sb = getSupabase()
  let rows: AdminUserRow[] = []
  if (sb) {
    const { data, error } = await sb.from('admin_users').select('*').order('created_at', { ascending: false })
    if (error && isMissingSchemaError(error.message)) {
      disableSupabaseSchema(error)
    }
    if (!error && data?.length) rows = data.map(mapAdmin)
  }
  if (!rows.length) rows = readFile().admins
  return Promise.all(rows.map(async (row) => publicAdmin(row, await getAdminAuth(row.email))))
}

export async function upsertAdmin(input: {
  email: string
  role: AdminRole
  fullName?: string
}): Promise<AdminUserRow> {
  const email = input.email.toLowerCase().trim()
  const sb = getSupabase()
  if (sb) {
    const { data: existing } = await sb.from('admin_users').select('*').eq('email', email).maybeSingle()
    if (existing) {
      const { data, error } = await sb
        .from('admin_users')
        .update({ role: input.role, full_name: input.fullName ?? existing.full_name })
        .eq('id', existing.id)
        .select('*')
        .single()
      if (error && isMissingSchemaError(error.message)) {
        disableSupabaseSchema(error)
      }
      if (!error && data) return mapAdmin(data)
    } else {
      const { data, error } = await sb
        .from('admin_users')
        .insert({ email, role: input.role, full_name: input.fullName || null })
        .select('*')
        .single()
      if (error && isMissingSchemaError(error.message)) {
        disableSupabaseSchema(error)
      }
      if (!error && data) return mapAdmin(data)
    }
  }

  const store = readFile()
  const idx = store.admins.findIndex((a) => a.email === email)
  if (idx >= 0) {
    store.admins[idx] = {
      ...store.admins[idx],
      role: input.role,
      fullName: input.fullName ?? store.admins[idx].fullName,
    }
    writeFile(store)
    return store.admins[idx]
  }
  const created: AdminUserRow = {
    id: randomUUID(),
    email,
    fullName: input.fullName || null,
    role: input.role,
    createdAt: new Date().toISOString(),
  }
  store.admins.push(created)
  writeFile(store)
  return created
}

export async function deleteAdmin(id: string): Promise<boolean> {
  const sb = getSupabase()
  if (sb) {
    const { error } = await sb.from('admin_users').delete().eq('id', id)
    if (error && isMissingSchemaError(error.message)) {
      disableSupabaseSchema(error)
    }
    if (!error) return true
  }
  const store = readFile()
  const before = store.admins.length
  store.admins = store.admins.filter((a) => a.id !== id)
  writeFile(store)
  return store.admins.length < before
}

export async function createWaitlistEntry(input: {
  email: string
  fullName?: string
  status?: WaitlistRow['status']
}): Promise<WaitlistRow> {
  const now = new Date().toISOString()
  const row: WaitlistRow = {
    id: randomUUID(),
    email: input.email.toLowerCase().trim(),
    fullName: input.fullName || null,
    mobileNumber: null,
    status: input.status || 'pending',
    yurekaScore: null,
    scoreDecision: null,
    scoreMetrics: null,
    monthlySpend: null,
    topCategory: null,
    notes: null,
    createdAt: now,
    updatedAt: now,
  }
  const sb = getSupabase()
  if (sb) {
    const { data, error } = await sb
      .from('waitlist')
      .insert({
        email: row.email,
        full_name: row.fullName,
        status: row.status,
      })
      .select('*')
      .single()
    if (error && isMissingSchemaError(error.message)) {
      disableSupabaseSchema(error)
    }
    if (!error && data) return mapWaitlist(data)
  }
  const store = readFile()
  store.waitlist.unshift(row)
  writeFile(store)
  return row
}

export async function findWaitlistByEmail(email: string): Promise<WaitlistRow | null> {
  const normalized = email.toLowerCase().trim()
  const sb = getSupabase()
  if (sb && supabaseWaitlistAllowed()) {
    try {
      const { data, error } = await withTimeout(
        sb.from('waitlist').select('*').eq('email', normalized).maybeSingle(),
        SUPABASE_WAITLIST_TIMEOUT_MS,
        'supabase findWaitlist'
      )
      if (!error) {
        clearSupabaseCircuit()
        return data ? mapWaitlist(data) : null
      }
      if (isMissingSchemaError(error.message)) {
        disableSupabaseSchema(error)
      }
      console.warn('[waitlist] supabase find error:', error.message)
    } catch (e) {
      tripSupabaseCircuit(e)
    }
  }
  return readFile().waitlist.find((w) => w.email.toLowerCase() === normalized) || null
}

export async function countWaitlist(): Promise<number> {
  const sb = getSupabase()
  if (sb && supabaseWaitlistAllowed()) {
    try {
      const { count, error } = await withTimeout(
        sb.from('waitlist').select('*', { count: 'exact', head: true }),
        SUPABASE_WAITLIST_TIMEOUT_MS,
        'supabase countWaitlist'
      )
      if (error && isMissingSchemaError(error.message)) {
        disableSupabaseSchema(error)
      }
      if (!error && typeof count === 'number') return count
    } catch (e) {
      tripSupabaseCircuit(e)
    }
  }
  return readFile().waitlist.length
}

export type WaitlistJoinInput = {
  email: string
  fullName?: string | null
  mobileNumber?: string | null
  status?: WaitlistRow['status']
  yurekaScore?: number | null
  monthlySpend?: string | null
  topCategory?: string | null
  meta?: Record<string, unknown>
}

function writeJoinToFile(
  existing: WaitlistRow | null,
  payload: {
    email: string
    full_name: string | null
    mobile_number: string | null
    status: string
    yureka_score: number | null
    monthly_spend: string | null
    top_category: string | null
    notes: string
  },
  meta: Record<string, any>,
  now: string
): { row: WaitlistRow; meta: Record<string, any> } {
  const store = readFile()
  if (existing) {
    const idx = store.waitlist.findIndex((w) => w.id === existing.id || w.email === existing.email)
    if (idx >= 0) {
      store.waitlist[idx] = {
        ...store.waitlist[idx],
        fullName: payload.full_name,
        mobileNumber: payload.mobile_number,
        status: payload.status as WaitlistRow['status'],
        yurekaScore: payload.yureka_score,
        scoreDecision: typeof meta.scoreDecision === 'string' ? meta.scoreDecision : store.waitlist[idx].scoreDecision,
        scoreMetrics: meta.scoreMetrics && typeof meta.scoreMetrics === 'object' ? meta.scoreMetrics : store.waitlist[idx].scoreMetrics,
        monthlySpend: payload.monthly_spend,
        topCategory: payload.top_category,
        notes: payload.notes,
        updatedAt: now,
      }
      writeFile(store)
      return { row: store.waitlist[idx], meta }
    }
  }
  const row: WaitlistRow = {
    id: randomUUID(),
    email: payload.email,
    fullName: payload.full_name,
    mobileNumber: payload.mobile_number,
    status: payload.status as WaitlistRow['status'],
    yurekaScore: payload.yureka_score,
    scoreDecision: typeof meta.scoreDecision === 'string' ? meta.scoreDecision : null,
    scoreMetrics: meta.scoreMetrics && typeof meta.scoreMetrics === 'object' ? meta.scoreMetrics : null,
    monthlySpend: payload.monthly_spend,
    topCategory: payload.top_category,
    notes: payload.notes,
    createdAt: now,
    updatedAt: now,
  }
  store.waitlist.unshift(row)
  writeFile(store)
  return { row, meta }
}

export async function upsertWaitlistJoin(
  input: WaitlistJoinInput
): Promise<{ row: WaitlistRow; meta: Record<string, any> }> {
  const email = input.email.toLowerCase().trim()
  const existing = await findWaitlistByEmail(email)
  let prevMeta: Record<string, any> = {}
  try {
    prevMeta = existing?.notes ? JSON.parse(existing.notes) : {}
  } catch {
    prevMeta = {}
  }
  const meta = { ...prevMeta, ...(input.meta || {}) }
  const now = new Date().toISOString()
  const status: WaitlistRow['status'] =
    existing?.status && existing.status !== 'pending'
      ? existing.status
      : ((input.status || existing?.status || 'pending') as WaitlistRow['status'])

  const payload = {
    email,
    full_name: input.fullName ?? existing?.fullName ?? null,
    mobile_number: input.mobileNumber ?? existing?.mobileNumber ?? null,
    status,
    yureka_score: input.yurekaScore ?? existing?.yurekaScore ?? null,
    monthly_spend: input.monthlySpend ?? existing?.monthlySpend ?? null,
    top_category: input.topCategory ?? existing?.topCategory ?? null,
    notes: JSON.stringify(meta),
    updated_at: now,
  }

  const sb = getSupabase()
  if (sb && supabaseWaitlistAllowed()) {
    try {
      if (existing) {
        const { data, error } = await withTimeout(
          sb.from('waitlist').update(payload).eq('id', existing.id).select('*').single(),
          SUPABASE_WAITLIST_TIMEOUT_MS,
          'supabase waitlist update'
        )
        if (!error && data) {
          clearSupabaseCircuit()
          return { row: mapWaitlist(data), meta }
        }
        if (error && isMissingSchemaError(error.message)) {
          disableSupabaseSchema(error)
        }
        console.warn('[waitlist] supabase update failed:', error?.message)
      } else {
        const { data, error } = await withTimeout(
          sb.from('waitlist').insert({ ...payload, created_at: now }).select('*').single(),
          SUPABASE_WAITLIST_TIMEOUT_MS,
          'supabase waitlist insert'
        )
        if (!error && data) {
          clearSupabaseCircuit()
          return { row: mapWaitlist(data), meta }
        }
        if (error && isMissingSchemaError(error.message)) {
          disableSupabaseSchema(error)
        }
        if (error) console.warn('[waitlist] supabase insert failed:', error.message)
      }
    } catch (e) {
      tripSupabaseCircuit(e)
    }
  }

  return writeJoinToFile(existing, payload, meta, now)
}

export async function findWaitlistById(id: string): Promise<WaitlistRow | null> {
  const sb = getSupabase()
  if (sb && supabaseWaitlistAllowed()) {
    try {
      const { data, error } = await withTimeout(
        sb.from('waitlist').select('*').eq('id', id).maybeSingle(),
        SUPABASE_WAITLIST_TIMEOUT_MS,
        'supabase findWaitlistById'
      )
      if (error && isMissingSchemaError(error.message)) {
        disableSupabaseSchema(error)
      }
      if (!error && data) return mapWaitlist(data)
    } catch (e) {
      tripSupabaseCircuit(e)
    }
  }
  return readFile().waitlist.find((w) => w.id === id) || null
}

export async function patchWaitlistMetadata(
  id: string,
  patch: Record<string, unknown>
): Promise<{ row: WaitlistRow; meta: Record<string, any> } | null> {
  const existing = await findWaitlistById(id)
  if (!existing) return null

  let prevMeta: Record<string, any> = {}
  try {
    prevMeta = existing.notes ? JSON.parse(existing.notes) : {}
  } catch {
    prevMeta = {}
  }
  const meta = { ...prevMeta, ...patch }
  const now = new Date().toISOString()
  const notes = JSON.stringify(meta)

  const sb = getSupabase()
  if (sb && supabaseWaitlistAllowed()) {
    try {
      const { data, error } = await withTimeout(
        sb.from('waitlist').update({ notes, updated_at: now }).eq('id', id).select('*').single(),
        SUPABASE_WAITLIST_TIMEOUT_MS,
        'supabase patchWaitlistMetadata'
      )
      if (error && isMissingSchemaError(error.message)) {
        disableSupabaseSchema(error)
      }
      if (!error && data) return { row: mapWaitlist(data), meta }
    } catch (e) {
      tripSupabaseCircuit(e)
    }
  }

  const store = readFile()
  const idx = store.waitlist.findIndex((w) => w.id === id)
  if (idx < 0) return null
  store.waitlist[idx] = { ...store.waitlist[idx], notes, updatedAt: now }
  writeFile(store)
  return { row: store.waitlist[idx], meta }
}

export async function updateWaitlistUser(
  id: string,
  patch: {
    fullName?: string | null
    mobileNumber?: string | null
    status?: WaitlistRow['status']
    yurekaScore?: number | null
    scoreDecision?: string | null
    rewardPoints?: number | null
  },
): Promise<WaitlistRow | null> {
  const existing = await findWaitlistById(id)
  if (!existing) return null

  let prevMeta: Record<string, any> = {}
  try {
    prevMeta = existing.notes ? JSON.parse(existing.notes) : {}
  } catch {
    prevMeta = {}
  }

  const meta = { ...prevMeta }
  if (patch.scoreDecision !== undefined) meta.scoreDecision = patch.scoreDecision
  if (patch.rewardPoints !== undefined) {
    meta.rewardPoints =
      patch.rewardPoints == null || !Number.isFinite(Number(patch.rewardPoints))
        ? null
        : Math.round(Number(patch.rewardPoints))
  }

  const now = new Date().toISOString()
  const next: WaitlistRow = {
    ...existing,
    fullName: patch.fullName !== undefined ? patch.fullName : existing.fullName,
    mobileNumber: patch.mobileNumber !== undefined ? patch.mobileNumber : existing.mobileNumber,
    status: patch.status !== undefined ? patch.status : existing.status,
    yurekaScore:
      patch.yurekaScore !== undefined
        ? patch.yurekaScore == null || !Number.isFinite(Number(patch.yurekaScore))
          ? null
          : Math.round(Number(patch.yurekaScore))
        : existing.yurekaScore,
    scoreDecision:
      patch.scoreDecision !== undefined
        ? patch.scoreDecision
        : existing.scoreDecision,
    notes: JSON.stringify(meta),
    updatedAt: now,
  }

  const sb = getSupabase()
  if (sb && supabaseWaitlistAllowed()) {
    try {
      const { data, error } = await withTimeout(
        sb
          .from('waitlist')
          .update({
            full_name: next.fullName,
            mobile_number: next.mobileNumber,
            status: next.status,
            yureka_score: next.yurekaScore,
            notes: next.notes,
            updated_at: now,
          })
          .eq('id', id)
          .select('*')
          .single(),
        SUPABASE_WAITLIST_TIMEOUT_MS,
        'supabase updateWaitlistUser',
      )
      if (error && isMissingSchemaError(error.message)) disableSupabaseSchema(error)
      if (!error && data) return mapWaitlist(data)
    } catch (e) {
      tripSupabaseCircuit(e)
    }
  }

  const store = readFile()
  const idx = store.waitlist.findIndex((w) => w.id === id)
  if (idx < 0) return null
  store.waitlist[idx] = next
  writeFile(store)
  return next
}

export async function deleteWaitlistEntry(id: string): Promise<boolean> {
  const rowId = String(id || '').trim()
  if (!rowId) return false
  let removed = false

  const sb = getSupabase()
  if (sb && supabaseWaitlistAllowed()) {
    try {
      const { data, error } = await withTimeout(
        sb.from('waitlist').delete().eq('id', rowId).select('id'),
        SUPABASE_WAITLIST_TIMEOUT_MS,
        'supabase deleteWaitlistEntry',
      )
      if (error && isMissingSchemaError(error.message)) disableSupabaseSchema(error)
      else if (error) {
        console.warn('[waitlist] supabase delete failed:', error.message)
      } else {
        // Some PostgREST setups return [] even when the row was deleted.
        removed = true
        if (Array.isArray(data) && data.length === 0) {
          const check = await withTimeout(
            sb.from('waitlist').select('id').eq('id', rowId).maybeSingle(),
            SUPABASE_WAITLIST_TIMEOUT_MS,
            'supabase deleteWaitlistEntry verify',
          )
          if (!check.error && check.data) removed = false
        }
      }
    } catch (e) {
      tripSupabaseCircuit(e)
    }
  }

  const store = readFile()
  const before = store.waitlist.length
  store.waitlist = store.waitlist.filter((w) => w.id !== rowId)
  if (store.waitlist.length !== before) {
    writeFile(store)
    removed = true
  }
  return removed
}

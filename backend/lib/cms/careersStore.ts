import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { CAREER_ROLES_FALLBACK } from '../../../landing/careersData.js'

export interface CmsCareer {
  id: string
  refId: string
  title: string
  department: string
  location: string
  type: string
  description: string
  applyEmail: string
  status: 'draft' | 'published'
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export type CareerInput = Partial<CmsCareer> & { title: string; dept?: string }

interface CareerFileStore {
  roles: CmsCareer[]
}

function forceFileMode() {
  return (process.env.CAREERS_STORE || process.env.BLOG_STORE || '').toLowerCase() === 'file'
}

let supabaseSchemaUnavailable = false

function isMissingSchemaError(message: string | undefined) {
  const text = String(message || '').toLowerCase()
  return (
    text.includes('could not find the table') ||
    text.includes('schema cache') ||
    text.includes('does not exist')
  )
}

function filePath() {
  return path.join(process.cwd(), 'data', 'careers_store.json')
}

function seedRoles(): CmsCareer[] {
  const now = new Date().toISOString()
  return CAREER_ROLES_FALLBACK.map((role, index) => ({
    id: randomUUID(),
    refId: role.refId,
    title: role.title,
    department: role.dept,
    location: role.location,
    type: role.type,
    description: role.description || '',
    applyEmail: role.applyEmail || 'support@yureka.one',
    status: 'published' as const,
    sortOrder: index,
    createdAt: now,
    updatedAt: now,
  }))
}

function emptyStore(): CareerFileStore {
  return { roles: seedRoles() }
}

function readFileStore(): CareerFileStore {
  const p = filePath()
  try {
    if (!fs.existsSync(p)) {
      const snap = emptyStore()
      fs.mkdirSync(path.dirname(p), { recursive: true })
      fs.writeFileSync(p, JSON.stringify(snap, null, 2))
      return snap
    }
    const raw = JSON.parse(fs.readFileSync(p, 'utf-8')) as CareerFileStore
    if (!Array.isArray(raw.roles) || raw.roles.length === 0) {
      const snap = emptyStore()
      writeFileStore(snap)
      return snap
    }
    return raw
  } catch {
    const snap = emptyStore()
    writeFileStore(snap)
    return snap
  }
}

function writeFileStore(snap: CareerFileStore) {
  fs.mkdirSync(path.dirname(filePath()), { recursive: true })
  fs.writeFileSync(filePath(), JSON.stringify(snap, null, 2))
}

function getSupabase(): SupabaseClient | null {
  if (forceFileMode() || supabaseSchemaUnavailable) return null
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || ''
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

function mapRow(row: any): CmsCareer {
  return {
    id: String(row.id),
    refId: String(row.ref_id || row.refId || ''),
    title: String(row.title || ''),
    department: String(row.department || row.dept || ''),
    location: String(row.location || 'Bengaluru'),
    type: String(row.type || 'Full-time'),
    description: String(row.description || ''),
    applyEmail: String(row.apply_email || row.applyEmail || 'support@yureka.one'),
    status: row.status === 'published' ? 'published' : 'draft',
    sortOrder: Number(row.sort_order ?? row.sortOrder ?? 0),
    createdAt: row.created_at || row.createdAt || new Date().toISOString(),
    updatedAt: row.updated_at || row.updatedAt || new Date().toISOString(),
  }
}

export function careerToApi(role: CmsCareer) {
  return {
    id: role.id,
    refId: role.refId,
    title: role.title,
    department: role.department,
    dept: role.department,
    location: role.location,
    type: role.type,
    description: role.description,
    applyEmail: role.applyEmail,
    status: role.status,
    sortOrder: role.sortOrder,
    createdAt: role.createdAt,
    updatedAt: role.updatedAt,
  }
}

function sortRoles(roles: CmsCareer[]) {
  return roles.slice().sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
    return b.updatedAt.localeCompare(a.updatedAt)
  })
}

function uniqueRefId(desired: string, existing: CmsCareer[], exceptId?: string): string {
  const base = String(desired || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24)
  if (!base) return `JOB-${Date.now().toString(36).toUpperCase()}`
  let refId = base
  let n = 2
  const taken = (s: string) => existing.some((r) => r.refId === s && r.id !== exceptId)
  while (taken(refId)) {
    refId = `${base}-${n}`
    n += 1
  }
  return refId
}

function normalizeInput(input: CareerInput, existing: CmsCareer[], previous?: CmsCareer | null): CmsCareer {
  const now = new Date().toISOString()
  const title = String(input.title || previous?.title || '').trim()
  const department = String(input.department || input.dept || previous?.department || 'General').trim() || 'General'
  const refSource = String(input.refId || previous?.refId || '').trim()
  const status: CmsCareer['status'] =
    input.status === 'published' ? 'published' : input.status === 'draft' ? 'draft' : previous?.status || 'draft'

  return {
    id: previous?.id || input.id || randomUUID(),
    refId: uniqueRefId(refSource || title.split(/\s+/).slice(0, 2).join('-'), existing, previous?.id),
    title,
    department,
    location: String(input.location || previous?.location || 'Bengaluru').trim() || 'Bengaluru',
    type: String(input.type || previous?.type || 'Full-time').trim() || 'Full-time',
    description: String(input.description ?? previous?.description ?? '').trim(),
    applyEmail: String(input.applyEmail || previous?.applyEmail || 'support@yureka.one').trim() || 'support@yureka.one',
    status,
    sortOrder: Number.isFinite(Number(input.sortOrder))
      ? Number(input.sortOrder)
      : previous?.sortOrder ?? existing.length,
    createdAt: previous?.createdAt || now,
    updatedAt: now,
  }
}

export async function listCareers(opts?: { includeDrafts?: boolean }): Promise<CmsCareer[]> {
  const sb = getSupabase()
  if (sb) {
    let q = sb.from('cms_careers').select('*').order('sort_order', { ascending: true })
    if (!opts?.includeDrafts) q = q.eq('status', 'published')
    const { data, error } = await q
    if (error) {
      if (isMissingSchemaError(error.message)) supabaseSchemaUnavailable = true
      else console.warn('[careers] supabase list failed:', error.message)
    } else if (data) {
      return sortRoles(data.map(mapRow))
    }
  }
  const roles = readFileStore().roles
  const filtered = opts?.includeDrafts ? roles : roles.filter((r) => r.status === 'published')
  return sortRoles(filtered)
}

export async function getCareerById(id: string): Promise<CmsCareer | null> {
  const sb = getSupabase()
  if (sb) {
    const { data, error } = await sb.from('cms_careers').select('*').eq('id', id).maybeSingle()
    if (error) {
      if (isMissingSchemaError(error.message)) supabaseSchemaUnavailable = true
    } else if (data) return mapRow(data)
  }
  return readFileStore().roles.find((r) => r.id === id) || null
}

export async function upsertCareer(input: CareerInput): Promise<CmsCareer> {
  const existing = await listCareers({ includeDrafts: true })
  const previous = input.id ? existing.find((r) => r.id === input.id) || null : null
  const next = normalizeInput(input, existing, previous)

  const sb = getSupabase()
  if (sb) {
    const row = {
      id: next.id,
      ref_id: next.refId,
      title: next.title,
      department: next.department,
      location: next.location,
      type: next.type,
      description: next.description,
      apply_email: next.applyEmail,
      status: next.status,
      sort_order: next.sortOrder,
      created_at: next.createdAt,
      updated_at: next.updatedAt,
    }
    const { data, error } = await sb.from('cms_careers').upsert(row).select('*').single()
    if (error) {
      if (isMissingSchemaError(error.message)) supabaseSchemaUnavailable = true
      else throw new Error(error.message)
    } else if (data) {
      return mapRow(data)
    }
  }

  const snap = readFileStore()
  const idx = snap.roles.findIndex((r) => r.id === next.id)
  if (idx >= 0) snap.roles[idx] = next
  else snap.roles.push(next)
  writeFileStore(snap)
  return next
}

export async function deleteCareer(id: string): Promise<boolean> {
  const sb = getSupabase()
  if (sb) {
    const { error } = await sb.from('cms_careers').delete().eq('id', id)
    if (error) {
      if (isMissingSchemaError(error.message)) supabaseSchemaUnavailable = true
      else throw new Error(error.message)
    } else {
      return true
    }
  }
  const snap = readFileStore()
  const next = snap.roles.filter((r) => r.id !== id)
  if (next.length === snap.roles.length) return false
  snap.roles = next
  writeFileStore(snap)
  return true
}

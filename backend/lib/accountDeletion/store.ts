import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
import {
  DELETION_RETENTION_DAYS,
  type DeletionRequest,
  type DeletionRequestStatus,
} from './types.js'

type FileStore = { items: DeletionRequest[] }

function filePath() {
  return path.join(process.cwd(), 'data', 'account_deletion_requests.json')
}

function emptyStore(): FileStore {
  return { items: [] }
}

function readFileStore(): FileStore {
  const p = filePath()
  try {
    if (!fs.existsSync(p)) {
      const snap = emptyStore()
      fs.mkdirSync(path.dirname(p), { recursive: true })
      fs.writeFileSync(p, JSON.stringify(snap, null, 2))
      return snap
    }
    return JSON.parse(fs.readFileSync(p, 'utf-8')) as FileStore
  } catch {
    const snap = emptyStore()
    writeFileStore(snap)
    return snap
  }
}

function writeFileStore(snap: FileStore) {
  const dest = filePath()
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.writeFileSync(dest, JSON.stringify(snap, null, 2))
}

function normalizeEmail(value?: string | null) {
  return String(value || '')
    .trim()
    .toLowerCase()
}

export function retentionPurgeAt(from = new Date()): string {
  const d = new Date(from)
  d.setUTCDate(d.getUTCDate() + DELETION_RETENTION_DAYS)
  return d.toISOString()
}

export async function listDeletionRequests(opts?: {
  status?: DeletionRequestStatus | 'all'
}): Promise<DeletionRequest[]> {
  const status = opts?.status || 'all'
  const items = [...readFileStore().items]
  items.sort((a, b) => b.requestedAt.localeCompare(a.requestedAt))
  if (status === 'all') return items
  return items.filter((r) => r.status === status)
}

export async function getDeletionRequest(id: string): Promise<DeletionRequest | null> {
  const row = readFileStore().items.find((r) => r.id === id)
  return row || null
}

export async function findActiveDeletionByEmail(email: string): Promise<DeletionRequest | null> {
  const e = normalizeEmail(email)
  if (!e) return null
  const active = readFileStore().items.filter(
    (r) => r.email === e && (r.status === 'pending' || r.status === 'approved'),
  )
  active.sort((a, b) => b.requestedAt.localeCompare(a.requestedAt))
  return active[0] || null
}

export async function createDeletionRequest(input: {
  email: string
  userId?: string | null
  waitlistId?: string | null
  fullName?: string | null
  reason?: string | null
  source: 'app' | 'admin'
  /** Admin-created can skip pending and land as approved with retention clock. */
  status?: 'pending' | 'approved'
  reviewedBy?: string | null
}): Promise<DeletionRequest> {
  const email = normalizeEmail(input.email)
  if (!email) throw new Error('email required')

  const existing = await findActiveDeletionByEmail(email)
  if (existing) return existing

  const now = new Date().toISOString()
  const status = input.status || 'pending'
  const row: DeletionRequest = {
    id: randomUUID(),
    email,
    userId: input.userId || null,
    waitlistId: input.waitlistId || null,
    fullName: input.fullName || null,
    reason: input.reason?.trim() || null,
    status,
    purgeAt: status === 'approved' ? retentionPurgeAt(new Date(now)) : null,
    requestedAt: now,
    reviewedAt: status === 'approved' ? now : null,
    reviewedBy: status === 'approved' ? input.reviewedBy || null : null,
    reviewNote: null,
    purgedAt: null,
    source: input.source,
  }

  const snap = readFileStore()
  snap.items.unshift(row)
  writeFileStore(snap)
  return row
}

export async function updateDeletionRequest(
  id: string,
  patch: Partial<DeletionRequest>,
): Promise<DeletionRequest | null> {
  const snap = readFileStore()
  const idx = snap.items.findIndex((r) => r.id === id)
  if (idx < 0) return null
  snap.items[idx] = { ...snap.items[idx], ...patch, id: snap.items[idx].id }
  writeFileStore(snap)
  return snap.items[idx]
}

export async function listDueForPurge(now = new Date()): Promise<DeletionRequest[]> {
  const iso = now.toISOString()
  return readFileStore().items.filter(
    (r) => r.status === 'approved' && r.purgeAt && r.purgeAt <= iso,
  )
}

import { deleteWaitlistEntry, findWaitlistByEmail, updateWaitlistStatus } from '../admin/store.js'
import {
  sendDeletionApprovedEmail,
  sendDeletionPurgedEmail,
  sendDeletionRejectedEmail,
  sendDeletionRequestAdminEmail,
  sendDeletionRequestReceivedEmail,
} from '../mail/appEmails.js'
import {
  createDeletionRequest,
  findActiveDeletionByEmail,
  getDeletionRequest,
  listDeletionRequests,
  listDueForPurge,
  retentionPurgeAt,
  updateDeletionRequest,
} from './store.js'
import type { DeletionRequest } from './types.js'
import { DELETION_RETENTION_DAYS } from './types.js'

function adminNotifyEmails(): string[] {
  return (process.env.ADMIN_EMAILS || process.env.DELETION_NOTIFY_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
}

export async function requestAccountDeletion(opts: {
  email: string
  userId?: string | null
  reason?: string | null
  source?: 'app' | 'admin'
}): Promise<{ request: DeletionRequest; created: boolean }> {
  const email = opts.email.trim().toLowerCase()
  const existing = await findActiveDeletionByEmail(email)
  if (existing) return { request: existing, created: false }

  const row = await findWaitlistByEmail(email)
  const request = await createDeletionRequest({
    email,
    userId: opts.userId || null,
    waitlistId: row?.id || null,
    fullName: row?.fullName || null,
    reason: opts.reason,
    source: opts.source || 'app',
    status: 'pending',
  })

  await Promise.allSettled([
    sendDeletionRequestReceivedEmail({
      to: email,
      fullName: request.fullName,
      retentionDays: DELETION_RETENTION_DAYS,
    }),
    ...adminNotifyEmails().map((to) =>
      sendDeletionRequestAdminEmail({
        to,
        memberEmail: email,
        fullName: request.fullName,
        reason: request.reason,
        requestId: request.id,
      }),
    ),
  ])

  return { request, created: true }
}

export async function approveDeletionRequest(opts: {
  id: string
  reviewedBy: string
  note?: string | null
}): Promise<DeletionRequest> {
  const row = await getDeletionRequest(opts.id)
  if (!row) throw new Error('Request not found')
  if (row.status === 'purged') throw new Error('Already purged')
  if (row.status === 'cancelled') throw new Error('Request was cancelled')
  if (row.status === 'rejected') throw new Error('Request was rejected')

  const now = new Date()
  const next = await updateDeletionRequest(row.id, {
    status: 'approved',
    purgeAt: retentionPurgeAt(now),
    reviewedAt: now.toISOString(),
    reviewedBy: opts.reviewedBy,
    reviewNote: opts.note?.trim() || null,
  })
  if (!next) throw new Error('Failed to approve')

  // Soft-close access: hold the waitlist row until purge.
  if (next.waitlistId) {
    try {
      await updateWaitlistStatus(next.waitlistId, 'on_hold')
    } catch {
      /* optional */
    }
  }

  await sendDeletionApprovedEmail({
    to: next.email,
    fullName: next.fullName,
    purgeAt: next.purgeAt!,
    retentionDays: DELETION_RETENTION_DAYS,
  })

  return next
}

export async function rejectDeletionRequest(opts: {
  id: string
  reviewedBy: string
  note?: string | null
}): Promise<DeletionRequest> {
  const row = await getDeletionRequest(opts.id)
  if (!row) throw new Error('Request not found')
  if (row.status !== 'pending' && row.status !== 'approved') {
    throw new Error(`Cannot reject from status ${row.status}`)
  }

  const next = await updateDeletionRequest(row.id, {
    status: 'rejected',
    purgeAt: null,
    reviewedAt: new Date().toISOString(),
    reviewedBy: opts.reviewedBy,
    reviewNote: opts.note?.trim() || null,
  })
  if (!next) throw new Error('Failed to reject')

  if (next.waitlistId && row.status === 'approved') {
    try {
      await updateWaitlistStatus(next.waitlistId, 'accepted')
    } catch {
      /* optional restore */
    }
  }

  await sendDeletionRejectedEmail({
    to: next.email,
    fullName: next.fullName,
    note: next.reviewNote,
  })

  return next
}

export async function cancelDeletionRequest(opts: {
  email: string
}): Promise<DeletionRequest | null> {
  const row = await findActiveDeletionByEmail(opts.email)
  if (!row) return null
  if (row.status !== 'pending') {
    throw new Error('Only pending requests can be cancelled from the app')
  }
  return updateDeletionRequest(row.id, {
    status: 'cancelled',
    reviewedAt: new Date().toISOString(),
    reviewedBy: opts.email,
    reviewNote: 'Cancelled by member',
  })
}

/** Permanent delete of waitlist row + mark request purged. */
export async function purgeDeletionRequest(
  id: string,
  opts?: { force?: boolean; actor?: string },
): Promise<DeletionRequest> {
  const row = await getDeletionRequest(id)
  if (!row) throw new Error('Request not found')
  if (row.status === 'purged') return row

  if (!opts?.force && row.status !== 'approved') {
    throw new Error('Only approved requests can be purged (or use force)')
  }
  if (!opts?.force && row.purgeAt && row.purgeAt > new Date().toISOString()) {
    throw new Error(`Retention window open until ${row.purgeAt}`)
  }

  let waitlistId = row.waitlistId
  if (!waitlistId) {
    const wl = await findWaitlistByEmail(row.email)
    waitlistId = wl?.id || null
  }
  if (waitlistId) {
    await deleteWaitlistEntry(waitlistId)
  }

  const next = await updateDeletionRequest(row.id, {
    status: 'purged',
    purgedAt: new Date().toISOString(),
    waitlistId,
    reviewedBy: opts?.actor || row.reviewedBy,
  })
  if (!next) throw new Error('Failed to mark purged')

  await sendDeletionPurgedEmail({
    to: next.email,
    fullName: next.fullName,
  })

  return next
}

/** Admin schedules deletion without a member request (Users tab Delete). */
export async function adminScheduleUserDeletion(opts: {
  email: string
  waitlistId?: string | null
  userId?: string | null
  fullName?: string | null
  reviewedBy: string
  immediate?: boolean
}): Promise<DeletionRequest> {
  const email = opts.email.trim().toLowerCase()
  let request = await findActiveDeletionByEmail(email)
  if (!request) {
    request = await createDeletionRequest({
      email,
      userId: opts.userId,
      waitlistId: opts.waitlistId,
      fullName: opts.fullName,
      source: 'admin',
      status: 'pending',
      reviewedBy: opts.reviewedBy,
      reason: 'Scheduled by admin',
    })
  }

  if (request.status === 'pending') {
    request = await approveDeletionRequest({
      id: request.id,
      reviewedBy: opts.reviewedBy,
      note: 'Approved via admin delete',
    })
  }

  if (opts.immediate) {
    return purgeDeletionRequest(request.id, { force: true, actor: opts.reviewedBy })
  }

  return request
}

export async function runDueDeletionPurges(): Promise<{ purged: number; errors: string[] }> {
  const due = await listDueForPurge()
  let purged = 0
  const errors: string[] = []
  for (const row of due) {
    try {
      await purgeDeletionRequest(row.id, { actor: 'system:retention' })
      purged += 1
    } catch (e: any) {
      errors.push(`${row.id}: ${e?.message || e}`)
    }
  }
  return { purged, errors }
}

export { listDeletionRequests, findActiveDeletionByEmail, DELETION_RETENTION_DAYS }

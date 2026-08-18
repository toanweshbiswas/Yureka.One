import type { WaitlistRow } from '../admin/store.js'

export function parseWaitlistMeta(row: WaitlistRow): Record<string, any> {
  try {
    return row.notes ? JSON.parse(row.notes) : {}
  } catch {
    return {}
  }
}

export function toPublicWaitlistEntry(row: WaitlistRow, meta?: Record<string, any>) {
  const m = meta ?? parseWaitlistMeta(row)
  return {
    id: row.id,
    name: row.fullName || '',
    email: row.email,
    mobileNumber: row.mobileNumber || undefined,
    dateOfBirth: m.dateOfBirth || undefined,
    gender: m.gender || undefined,
    role: 'user' as const,
    mostUsedFor: row.topCategory || m.mostUsedFor || undefined,
    monthlySpend: row.monthlySpend || undefined,
    referralCode: m.referredBy || undefined,
    personalReferralCode: m.personalReferralCode || undefined,
    sourceChannel: m.sourceChannel || undefined,
    rank: typeof m.rank === 'number' ? m.rank : undefined,
    status: (row.status === 'on_hold' ? 'on-hold' : row.status) as
      | 'pending'
      | 'accepted'
      | 'rejected'
      | 'on-hold'
      | 'on_hold',
    yurekaScore: row.yurekaScore ?? m.yurekaScore ?? undefined,
    scoreDecision: row.scoreDecision || m.scoreDecision || undefined,
    scoreMetrics: m.scoreMetrics && typeof m.scoreMetrics === 'object' ? m.scoreMetrics : undefined,
    joinedAt: row.createdAt,
    createdAt: row.createdAt,
  }
}

export type PublicWaitlistEntry = ReturnType<typeof toPublicWaitlistEntry>

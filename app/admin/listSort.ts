/** Shared list ordering for admin People / commerce tables. */

export const WAITLIST_STATUS_RANK: Record<string, number> = {
  pending: 0,
  on_hold: 1,
  accepted: 2,
  rejected: 3,
}

export type WaitlistSortKey = 'action' | 'newest' | 'score' | 'name'
export type UserSortKey = 'action' | 'score' | 'active' | 'goldback' | 'name' | 'status'
export type SortDir = 'asc' | 'desc'

function scoreRank(score: number | null | undefined): number {
  return typeof score === 'number' && Number.isFinite(score) ? score : -1
}

function str(a: string | null | undefined): string {
  return (a || '').toLowerCase()
}

export function compareWaitlistRows(
  a: {
    status: string
    createdAt?: string
    updatedAt?: string
    yurekaScore?: number | null
    fullName?: string | null
    email?: string
  },
  b: {
    status: string
    createdAt?: string
    updatedAt?: string
    yurekaScore?: number | null
    fullName?: string | null
    email?: string
  },
  sort: WaitlistSortKey,
): number {
  if (sort === 'action') {
    const ra = WAITLIST_STATUS_RANK[a.status] ?? 9
    const rb = WAITLIST_STATUS_RANK[b.status] ?? 9
    if (ra !== rb) return ra - rb
    const scoreDiff = scoreRank(b.yurekaScore) - scoreRank(a.yurekaScore)
    if (scoreDiff) return scoreDiff
    return (b.createdAt || '').localeCompare(a.createdAt || '')
  }
  if (sort === 'score') {
    const scoreDiff = scoreRank(b.yurekaScore) - scoreRank(a.yurekaScore)
    if (scoreDiff) return scoreDiff
    return (b.createdAt || '').localeCompare(a.createdAt || '')
  }
  if (sort === 'name') {
    const na = str(a.fullName) || str(a.email)
    const nb = str(b.fullName) || str(b.email)
    const c = na.localeCompare(nb)
    if (c) return c
    return (b.createdAt || '').localeCompare(a.createdAt || '')
  }
  // newest
  return (b.createdAt || b.updatedAt || '').localeCompare(a.createdAt || a.updatedAt || '')
}

export function compareUserRows(
  a: {
    status?: string | null
    score?: number | null
    lastActiveAt?: string | null
    goldbackPaise?: number
    name?: string | null
    email?: string | null
    key?: string
  },
  b: {
    status?: string | null
    score?: number | null
    lastActiveAt?: string | null
    goldbackPaise?: number
    name?: string | null
    email?: string | null
    key?: string
  },
  sort: UserSortKey,
  dir: SortDir = 'desc',
): number {
  const mul = dir === 'asc' ? 1 : -1
  let primary = 0
  if (sort === 'action' || sort === 'status') {
    const ra = WAITLIST_STATUS_RANK[a.status || ''] ?? 9
    const rb = WAITLIST_STATUS_RANK[b.status || ''] ?? 9
    // action: pending first (asc rank); status column uses dir
    primary = sort === 'action' ? ra - rb : (ra - rb) * mul
    if (primary) return primary
    primary = (scoreRank(b.score) - scoreRank(a.score))
    if (primary) return primary
    return (b.lastActiveAt || '').localeCompare(a.lastActiveAt || '')
  }
  if (sort === 'score') {
    primary = (scoreRank(a.score) - scoreRank(b.score)) * mul
    if (primary) return primary
    return (b.lastActiveAt || '').localeCompare(a.lastActiveAt || '')
  }
  if (sort === 'goldback') {
    primary = ((a.goldbackPaise || 0) - (b.goldbackPaise || 0)) * mul
    if (primary) return primary
    return (b.lastActiveAt || '').localeCompare(a.lastActiveAt || '')
  }
  if (sort === 'name') {
    const na = str(a.name) || str(a.email) || str(a.key)
    const nb = str(b.name) || str(b.email) || str(b.key)
    primary = na.localeCompare(nb) * (dir === 'asc' ? 1 : -1)
    if (primary) return primary
    return (b.lastActiveAt || '').localeCompare(a.lastActiveAt || '')
  }
  // active
  primary = (a.lastActiveAt || '').localeCompare(b.lastActiveAt || '') * mul
  if (primary) return primary
  return scoreRank(b.score) - scoreRank(a.score)
}

export function toggleSortDir(prev: SortDir): SortDir {
  return prev === 'asc' ? 'desc' : 'asc'
}

export type DeletionRequestStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'purged'

export type DeletionRequest = {
  id: string
  email: string
  userId: string | null
  waitlistId: string | null
  fullName: string | null
  reason: string | null
  status: DeletionRequestStatus
  /** When status becomes approved — permanent purge after this instant. */
  purgeAt: string | null
  requestedAt: string
  reviewedAt: string | null
  reviewedBy: string | null
  reviewNote: string | null
  purgedAt: string | null
  source: 'app' | 'admin'
}

export const DELETION_RETENTION_DAYS = 30

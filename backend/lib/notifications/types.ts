export type UserNotificationType = 'info' | 'success' | 'warning' | 'error'

export interface UserNotification {
  id: string
  userId: string
  email: string | null
  title: string
  body: string
  type: UserNotificationType
  href: string | null
  imageUrl: string | null
  dedupeKey: string | null
  readAt: string | null
  dismissedAt: string | null
  createdAt: string
}

export interface NotifyUserInput {
  userId: string
  email?: string | null
  title: string
  body: string
  type?: UserNotificationType
  href?: string | null
  imageUrl?: string | null
  dedupeKey?: string | null
}

// ─── Response Envelope ────────────────────────────────────────────────────────

export interface YurekaResponse<T> {
  data: T | null
  count?: number
  status: number
  timestamp: string
  error?: string
  path?: string
  details?: Record<string, string[]>
}

export type ApiSuccess<T>     = YurekaResponse<T> & { data: T }
export type ApiListSuccess<T> = YurekaResponse<T[]> & { data: T[]; count: number }
export type ApiError          = YurekaResponse<null> & { error: string }

export const isApiError = (res: YurekaResponse<unknown>): res is ApiError =>
  res.status >= 400

export const isValidationError = (
  res: YurekaResponse<unknown>
): res is ApiError & { details: Record<string, string[]> } =>
  res.status === 400 && !!res.details

// ─── Entities (camelCase — matches Java schema) ───────────────────────────────

export interface Card {
  id?: string
  name: string
  bank: string
  issuer?: string
  type: string
  image: string
  rating: number
  benefits: string[]
  annualFee: string
  joiningFee: string
  bestFor: string
  color: string
  rewardsRate?: string
  category?: string
  projectedSavings?: string
  introOffer?: string
  tags?: string[]
  eliteRating?: number
  /** JSON string — parse with JSON.parse() to get { heading, subheading }[] */
  benefitItems?: string
  verdict?: string
  slug?: string
  categories?: string[]
  applyLink?: string
  status?: 'draft' | 'published'
  description?: string
  updatedOn?: string
  author?: string
  rewardType?: string
  welcomeBenefits?: string
  productDetails?: string[]
  pros?: string[]
  cons?: string[]
  /** JSON string — parse to get { title, content }[] */
  detailedFeatures?: string
  cashbackDetails?: string[]
  /** JSON string — parse to get { category, value }[] */
  redemptionTable?: string
  exclusions?: string[]
  /** JSON string — parse to get { criteria, salaried, self_employed }[] */
  eligibilityCriteria?: string
  comparisonCards?: string[]
  latestNews?: string[]
  finalReviewImage?: string
  finalVerdictText?: string
  /** JSON string — parse to get { title, value }[] */
  gridBenefits?: string
  /** JSON string — parse to get { title, value }[] */
  gridFees?: string
  createdAt?: string
  updatedAt?: string
}

export interface Blog {
  id?: string
  title: string
  slug?: string
  excerpt: string
  content: string
  author: string
  category: string
  image: string
  externalLink?: string
  date?: string
  featured?: boolean
  readTime?: string
  status?: 'draft' | 'published'
  scheduledAt?: string
  createdAt?: string
  updatedAt?: string
}

export interface Review {
  id?: string
  author: string
  role: string
  company: string
  companyLogo?: string
  avatar?: string
  image: string
  quote: string
  rating?: number
  source?: 'App Store' | 'Google Play' | 'Direct'
  featured?: boolean
  rotation?: number
  status?: 'draft' | 'published'
  createdAt?: string
  updatedAt?: string
}

export interface Waitlist {
  id?: string
  name: string
  firstName?: string
  lastName?: string
  email: string
  phone?: string
  mobileNumber?: string
  dateOfBirth?: string
  gender?: string
  role: 'user' | 'partner'
  category?: string
  company?: string
  creditCardsCount?: number
  /** JSON string — parse to get { bank, card }[] */
  creditCardsDetails?: string
  mostUsedFor?: string
  monthlySpend?: string
  referralCode?: string
  personalReferralCode?: string
  sourceChannel?: string
  rank?: number
  yurekaScore?: number
  scoreDecision?: string
  scoreMetrics?: Record<string, unknown>
  status: 'pending' | 'accepted' | 'rejected' | 'on_hold' | 'on-hold'
  joinedAt?: string
  createdAt?: string
}

export interface LedgerResyncQuota {
  used: number
  remaining: number
  limit: number
  windowDays: number
  nextAvailableAt?: string | null
  allowed?: boolean
}

export interface UserOwnedCard {
  id?: string
  userId?: string
  cardId?: string | null
  bankName: string
  cardName: string
  cardImage?: string | null
  syncedFromWaitlist?: boolean
  isPrimary?: boolean
  isSecondary?: boolean
  createdAt?: string
}

export interface PlatformNotification {
  id?: string
  title: string
  message: string
  type: 'info' | 'warning' | 'success' | 'error'
  status?: 'active' | 'archived'
  imageUrl?: string
  createdBy?: string
  createdAt?: string
}

export interface NotificationInteraction {
  id?: string
  notificationId: string
  userEmail: string
  username?: string
  action: 'read' | 'clicked'
  createdAt?: string
}

export interface Newsletter {
  id?: string
  email: string
  status?: 'active' | 'unsubscribed'
  subscribedAt?: string
  createdAt?: string
}

export interface AppUser {
  id?: string
  email: string
  fullName?: string
  role: 'admin' | 'editor' | 'writer' | 'user'
  createdAt?: string
}

export interface PlatformTrash {
  id?: string
  entityType: 'blog' | 'card' | 'review' | 'notification' | 'user' | 'waitlist'
  originalId?: string
  /** JSON string — parse to get the original row */
  payload?: string
  deletedBy?: string
  deletedAt?: string
}

export interface AuditLog {
  id?: string
  action?: string
  entity?: string
  entityId?: string
  performedBy?: string
  /** JSON string — parse to get detail object */
  details?: string
  createdAt?: string
}

export interface RankResult {
  baseRank: number
  effectiveRank: number
  totalReferrals: number
  approvedReferrals: number
  rankBoost: number
  entry: Waitlist
}

export interface ProfileDTO {
  name?: string
  dob?: string
  gender?: string
  phone?: string
  email?: string
}

export interface LedgerResponse {
  profile: ProfileDTO
  transactions: Array<{
    brandName?: string
    amount?: string
    description?: string
    date?: string
    sender?: string
    type?: string
  }>
}

// ─── Waitlist join — data is nested one level deeper ─────────────────────────

export interface WaitlistJoinResult {
  data: Waitlist
  alreadyExists: boolean
}

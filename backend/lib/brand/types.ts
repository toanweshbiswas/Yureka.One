export const BRAND_ROLES = ['owner', 'editor', 'viewer'] as const
export type BrandMemberRole = (typeof BRAND_ROLES)[number]

export const BRAND_STATUSES = ['active', 'paused'] as const
export type BrandStatus = (typeof BRAND_STATUSES)[number]

export const BRAND_EVENT_TYPES = ['impression', 'click', 'copy'] as const
export type BrandEventType = (typeof BRAND_EVENT_TYPES)[number]

export function isBrandRole(value: unknown): value is BrandMemberRole {
  return BRAND_ROLES.includes(String(value || '') as BrandMemberRole)
}

export function isBrandEventType(value: unknown): value is BrandEventType {
  return BRAND_EVENT_TYPES.includes(String(value || '') as BrandEventType)
}

export interface Brand {
  id: string
  name: string
  slug: string
  logoUrl?: string | null
  website?: string | null
  category: string
  contactEmail?: string | null
  status: BrandStatus
  notes?: string | null
  createdAt: string
}

export interface BrandMember {
  id: string
  brandId: string
  email: string
  userId?: string | null
  role: BrandMemberRole
  invitedAt: string
  joinedAt?: string | null
}

export interface BrandOffer {
  id: string
  brandId: string
  brandName?: string
  brandLogoUrl?: string | null
  title: string
  description: string
  url: string
  couponCode?: string | null
  category: string
  imageUrl?: string | null
  startsAt?: string | null
  endsAt?: string | null
  active: boolean
  createdBy?: string | null
  createdAt: string
  clicks?: number
  copies?: number
  impressions?: number
}

export interface BrandOfferEvent {
  id: string
  offerId: string
  brandId: string
  userId: string
  type: BrandEventType
  createdAt: string
}

export interface BrandMembership {
  member: BrandMember
  brand: Brand
}

export interface BrandDayPoint {
  date: string
  clicks: number
  copies: number
  impressions: number
  uniqueUsers: number
}

export interface BrandOverview {
  brand: Brand
  liveOfferCount: number
  clicks: number
  copies: number
  impressions: number
  uniqueUsers: number
  series: BrandDayPoint[]
  topOffers: { id: string; title: string; clicks: number; copies: number }[]
}

export interface BrandListRow extends Brand {
  liveOfferCount: number
  clicks30d: number
  lastEventAt: string | null
  memberCount: number
}

export interface BrandSnapshot {
  brands: Brand[]
  members: BrandMember[]
  offers: BrandOffer[]
  events: BrandOfferEvent[]
}

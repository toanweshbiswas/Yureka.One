export const WW_ROLES = ['owner', 'admin', 'promoter'] as const
export type WwMemberRole = (typeof WW_ROLES)[number]

export const WW_TRIP_STATUSES = ['draft', 'published', 'closed'] as const
export type WwTripStatus = (typeof WW_TRIP_STATUSES)[number]

export const WW_PAYMENT_MODES = ['full', 'plan'] as const
export type WwPaymentMode = (typeof WW_PAYMENT_MODES)[number]

export const WW_REG_STATUSES = ['pending', 'partial', 'paid', 'cancelled'] as const
export type WwRegistrationStatus = (typeof WW_REG_STATUSES)[number]

export const WW_INSTALLMENT_STATUSES = ['due', 'paid', 'overdue', 'cancelled'] as const
export type WwInstallmentStatus = (typeof WW_INSTALLMENT_STATUSES)[number]

export function isWwRole(value: unknown): value is WwMemberRole {
  return WW_ROLES.includes(String(value || '') as WwMemberRole)
}

export function isWwTripStatus(value: unknown): value is WwTripStatus {
  return WW_TRIP_STATUSES.includes(String(value || '') as WwTripStatus)
}

export interface WwOrg {
  id: string
  name: string
  slug: string
  createdAt: string
}

export interface WwMember {
  id: string
  orgId: string
  email: string
  userId?: string | null
  role: WwMemberRole
  invitedAt: string
  joinedAt?: string | null
  /** Promoter public profile */
  displayName?: string | null
  phone?: string | null
  city?: string | null
  bio?: string | null
  instagram?: string | null
  /** Empty = all published trips; otherwise only these trip IDs */
  assignedTripIds?: string[]
}

export interface WwPlanInstallmentTemplate {
  /** Fraction of trip price, 0 to 1 */
  percent: number
  /** Days before trip start (0 = on start day); booking deposit uses null / pay now */
  daysBeforeStart?: number | null
  label: string
}

export interface WwTrip {
  id: string
  orgId: string
  title: string
  slug: string
  description: string
  itinerary: string
  priceInr: number
  seats: number
  seatsTaken: number
  startDate: string
  endDate: string
  coverImageUrl?: string | null
  status: WwTripStatus
  paymentPlansEnabled: boolean
  planTemplate: WwPlanInstallmentTemplate[]
  /** Admin-enabled pool for promoter/admin group bookings */
  groupBookingEnabled?: boolean
  /** Seats reserved for group bookings (separate from walk-in singles) */
  groupSeats?: number
  groupSeatsTaken?: number
  /** percent = % off list; flat_per_seat = INR off each seat */
  groupDiscountType?: 'percent' | 'flat_per_seat'
  groupDiscountValue?: number
  groupMinSize?: number
  groupMaxSize?: number
  createdAt: string
  updatedAt: string
}

export interface WwPromoterLink {
  id: string
  orgId: string
  memberId: string
  code: string
  /** Older codes that still resolve to this link after a rename */
  previousCodes?: string[]
  tripId?: string | null
  clickCount?: number
  lastClickedAt?: string | null
  createdAt: string
}

export interface WwInstallment {
  id: string
  registrationId: string
  sequence: number
  label: string
  amountInr: number
  dueAt: string
  status: WwInstallmentStatus
  razorpayOrderId?: string | null
  razorpayPaymentId?: string | null
  paidAt?: string | null
  /** How this installment was settled */
  paymentMethod?: 'razorpay' | 'cash' | null
  /** WanderWorld member who recorded cash collection */
  collectedByMemberId?: string | null
  cashNote?: string | null
  /** Group share claimed by this app user */
  claimedByUserId?: string | null
  claimedByEmail?: string | null
  claimedByName?: string | null
  claimedAt?: string | null
}

export interface WwRegistration {
  id: string
  orgId: string
  tripId: string
  userId: string
  buyerEmail: string
  buyerName: string
  buyerPhone?: string | null
  promoterCode?: string | null
  paymentMode: WwPaymentMode
  status: WwRegistrationStatus
  amountDueInr: number
  amountPaidInr: number
  notes?: string | null
  city?: string | null
  groupSize?: number | null
  /** True when booked via admin/promoter group booking flow */
  isGroup?: boolean
  /** Public code for /dashboard/getaway/group/:code join link */
  joinCode?: string | null
  /** Per-person share after discount */
  perSeatInr?: number | null
  /** List price before discount (price × seats) */
  listPriceInr?: number | null
  /** Total discount applied in INR */
  discountInr?: number | null
  /** Member who created the group booking (promoter/admin) */
  bookedByMemberId?: string | null
  createdAt: string
  updatedAt: string
}

export interface WwMembership {
  member: WwMember
  org: WwOrg
}

export interface WwTripPublic extends WwTrip {
  seatsLeft: number
  groupSeatsLeft?: number
}

export interface WwAnalytics {
  trips: number
  publishedTrips: number
  registrations: number
  paidRegistrations: number
  partialRegistrations: number
  revenueInr: number
  planVsFull: { full: number; plan: number }
  byTrip: {
    tripId: string
    title: string
    registrations: number
    paid: number
    revenueInr: number
    seatsLeft: number
  }[]
  byBuyer: {
    userId: string
    buyerEmail: string
    buyerName: string
    registrations: number
    paid: number
    revenueInr: number
    promoterCodes: string[]
  }[]
  promoters: {
    memberId: string
    email: string
    displayName?: string | null
    role?: string
    code: string
    links?: {
      id: string
      code: string
      tripId: string | null
      tripTitle: string | null
    }[]
    registrations: number
    paid: number
    revenueInr: number
    onlineCollectedInr: number
    cashCollectedInr: number
    outstandingInr: number
    clicks: number
    assignedTripIds: string[]
  }[]
}

export interface WwSnapshot {
  org: WwOrg
  members: WwMember[]
  trips: WwTrip[]
  promoterLinks: WwPromoterLink[]
  registrations: WwRegistration[]
  installments: WwInstallment[]
}

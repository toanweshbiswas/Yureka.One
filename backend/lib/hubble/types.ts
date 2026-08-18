export type HubbleProductStatus = 'ACTIVE' | 'INACTIVE' | string

export interface HubbleAmountRestrictions {
  minAmount?: number | null
  maxAmount?: number | null
  minOrderAmount?: number | null
  maxOrderAmount?: number | null
  minVoucherAmount?: number | null
  maxVoucherAmount?: number | null
  maxVouchersPerOrder?: number | null
  denominations?: number[] | null
}

export interface HubbleProductRaw {
  id: string
  status: HubbleProductStatus
  title: string
  brandDescription?: string | null
  category?: string[] | string | null
  tags?: string[] | null
  denominationType?: string | null
  cardType?: string | null
  redemptionType?: string | null
  amountRestrictions?: HubbleAmountRestrictions | null
  iconImageUrl?: string | null
  thumbnailUrl?: string | null
  logoUrl?: string | null
  tncUrl?: string | null
  termsAndConditions?: string[] | null
  usageInstructions?: Record<string, string[]> | null
  howToUseInstructions?: Array<{
    retailMode?: string
    retailModeName?: string
    instructions?: string[]
  }> | null
  discountPercentage?: number | null
  parentBrand?: { id?: string; name?: string } | null
  voucherExpiryInMonths?: number | null
}

/** Normalized gift card for the Yureka platform UI */
export interface GiftCard {
  id: string
  title: string
  brand: string
  description: string
  status: HubbleProductStatus
  categories: string[]
  tags: string[]
  redemptionType: string
  denominationType: string
  denominations: number[]
  minAmount: number | null
  maxAmount: number | null
  discountPercentage: number | null
  imageUrl: string | null
  logoUrl: string | null
  tncUrl: string | null
  termsAndConditions: string[]
  howToUse: string[]
  voucherExpiryInMonths: number | null
}

export type HubbleOrderStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'SUCCESS'
  | 'FAILED'
  | 'CANCELLED'
  | 'REVERSED'

export interface HubbleVoucherRaw {
  id?: string
  cardType?: string | null
  cardPin?: string | null
  cardNumber?: string | null
  validTill?: string | null
  amount?: number | string | null
}

export interface HubbleOrderRaw {
  id: string
  referenceId?: string
  status: HubbleOrderStatus | string
  vouchers?: HubbleVoucherRaw[] | null
  failureReason?: string | null
}

export interface PlaceOrderInput {
  productId: string
  referenceId: string
  amount: number
  denominationDetails: Array<{ denomination: number; quantity: number }>
  customerDetails?: {
    name: string
    phoneNumber: string
    email: string
  } | null
}

export interface StoredVoucher {
  id: string
  hubbleVoucherId: string | null
  cardType: string | null
  cardNumber: string | null
  cardPin: string | null
  amount: number | null
  validTill: string | null
}

export interface StoredOrder {
  id: string
  userId: string
  referenceId: string
  hubbleOrderId: string | null
  productId: string
  productTitle: string
  amountInr: number
  denomination: number
  quantity: number
  status: HubbleOrderStatus
  failureReason: string | null
  customerName: string | null
  customerEmail: string | null
  customerPhone: string | null
  paymentStatus: 'unpaid' | 'paid' | 'failed' | 'refunded'
  razorpayOrderId: string | null
  razorpayPaymentId: string | null
  vouchers: StoredVoucher[]
  createdAt: string
  updatedAt: string
}

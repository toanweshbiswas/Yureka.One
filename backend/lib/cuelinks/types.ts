export type CueLinksOfferType = 'discount' | 'coupon' | 'deal' | string

export interface CueLinksOffer {
  id: string
  campaignId: number | null
  merchant: string
  title: string
  description: string
  couponCode: string | null
  imageUrl: string | null
  type: CueLinksOfferType
  status: string
  url: string
  affiliateUrl: string
  startDate: string | null
  endDate: string | null
  categories: string[]
  source: 'marketplace' | string
}

export interface CueLinksRawOffer {
  id?: number | string
  camapign_id?: number
  campaign_id?: number
  campaign?: string
  merchant_name?: string
  merchant?: string
  title?: string
  description?: string
  terms_and_condition?: string
  coupon_code?: string
  image_url?: string
  image?: string
  logo?: string
  banner?: string
  merchant_logo?: string
  type?: string
  status?: string
  url?: string
  affiliate_url?: string
  start_date?: string
  end_date?: string
  categories?: Record<string, string> | string[] | null
}

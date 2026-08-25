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

export type CueLinksPayoutCategory = {
  name: string
  payoutType: string
  payout: number | null
  payoutCurrency: string
  isHeader: boolean
}

/** Normalized CueLinks campaign / brand row (from /campaigns.json). */
export type CueLinksCampaign = {
  id: number
  name: string
  url: string
  domain: string | null
  imageUrl: string | null
  payoutType: string
  payout: number | null
  payoutCurrency: string
  /** True when payout is pay-per-click (CPC). */
  isPayPerClick: boolean
  payoutCategories: CueLinksPayoutCategory[]
  newUserCommission: number | null
  existingUserCommission: number | null
  newUserPayoutType: string | null
  existingUserPayoutType: string | null
  categories: { id: number; name: string }[]
  countries: { id: number; iso: string; name: string }[]
  reportingType: string | null
  deeplinkAllowed: boolean
  subIdsAllowed: boolean
  cookieDuration: string | null
  affiliateUrl: string | null
  importantInfo: string | null
  lastModified: string | null
}

export type CueLinksRawCampaign = {
  id?: number
  name?: string
  url?: string
  domain?: string
  image?: string | null
  payout_type?: string
  payout?: number | string
  payout_currency?: string
  payout_categories?: Array<{
    name?: string
    payout_type?: string
    payout?: number | string
    payout_currency?: string
    is_header?: boolean
  }>
  categories?: Array<{ id?: number; name?: string }>
  countries?: Array<{ id?: number; iso?: string; name?: string }>
  reporting_type?: string
  deeplink_allowed?: boolean
  sub_ids_allowed?: boolean
  cookie_duration?: string | number
  affiliate_url?: string
  important_info_html?: string | null
  last_modified?: string
}

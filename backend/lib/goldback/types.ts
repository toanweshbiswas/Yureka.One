export type GoldbackLedgerType = 'earn' | 'redeem' | 'adjust'
export type GoldbackLedgerStatus = 'pending' | 'earned' | 'failed' | 'redeemed'

export interface GoldbackOffer {
  id: string
  title: string
  merchant: string
  category: string
  description: string
  url: string
  imageUrl?: string | null
  rewardPaise: number
  rewardLabel: string
  active: boolean
}

export interface GoldbackLedgerEntry {
  id: string
  userId: string
  type: GoldbackLedgerType
  amountPaise: number
  offerId: string | null
  status: GoldbackLedgerStatus
  idempotencyKey: string
  meta: Record<string, unknown>
  createdAt: string
}

export interface GoldbackBalance {
  userId: string
  balancePaise: number
  updatedAt: string
}

export interface GoldbackStoreSnapshot {
  accounts: Record<string, GoldbackBalance>
  offers: GoldbackOffer[]
  ledger: GoldbackLedgerEntry[]
  clicks: { id: string; userId: string; offerId: string; createdAt: string }[]
  /** After an admin deletes an offer, do not auto-insert seed catalog rows. */
  offerSeedLocked?: boolean
}

import React from 'react'
import { Megaphone, Store, Building2, Compass, BadgePercent } from 'lucide-react'
import BrandsTab from './BrandsTab'
import SuperBrowseTab from './SuperBrowseTab'
import CueLinksCampaignsTab from './CueLinksCampaignsTab'
import PushTab from './PushTab'
import WanderWorldTab from './WanderWorldTab'
import { PageHeader, pressClass } from './ui'

export type ClubSubTab = 'offers' | 'brands' | 'push' | 'super-browse' | 'cuelinks' | 'wanderworld'

const SUBS: { id: ClubSubTab; label: string; icon: typeof Store }[] = [
  { id: 'offers', label: 'Offers', icon: Store },
  { id: 'brands', label: 'Brands', icon: Building2 },
  { id: 'wanderworld', label: 'WanderWorld', icon: Compass },
  { id: 'cuelinks', label: 'CueLinks', icon: BadgePercent },
  { id: 'push', label: 'Push', icon: Megaphone },
  { id: 'super-browse', label: 'Super Browse', icon: Compass },
]

export default function ClubHub({
  sub,
  onSubChange,
  token,
  canWrite,
  offersPanel,
}: {
  sub: ClubSubTab
  onSubChange: (s: ClubSubTab) => void
  token: string | null
  canWrite: boolean
  offersPanel: React.ReactNode
}) {
  return (
    <section className="space-y-6">
      <PageHeader
        title="Club"
        subtitle="Offers, partner brands, WanderWorld trips, CueLinks commissions, Super Browse catalog, and member push."
      />
      <div className="flex flex-wrap gap-2">
        {SUBS.map((s) => {
          const active = sub === s.id
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onSubChange(s.id)}
              className={`${pressClass} inline-flex items-center gap-2 rounded-[12px] px-3.5 py-2 text-[14px] font-medium ${
                active ? 'bg-white text-black' : 'bg-white/[0.06] text-white/55 hover:text-white'
              }`}
            >
              <s.icon size={14} />
              {s.label}
            </button>
          )
        })}
      </div>
      {sub === 'offers' && offersPanel}
      {sub === 'brands' && <BrandsTab token={token} canWrite={canWrite} />}
      {sub === 'wanderworld' && <WanderWorldTab token={token} canWrite={canWrite} />}
      {sub === 'cuelinks' && <CueLinksCampaignsTab token={token} canWrite={canWrite} />}
      {sub === 'push' && <PushTab token={token} canWrite={canWrite} />}
      {sub === 'super-browse' && <SuperBrowseTab token={token} canWrite={canWrite} />}
    </section>
  )
}

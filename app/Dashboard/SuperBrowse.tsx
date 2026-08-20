import React, { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'motion/react'
import { ArrowRight, Mic, Search } from 'lucide-react'
import { SUPER_BROWSE_STORES, storeLogo, type SuperBrowseStore } from '@shared/superBrowseStores'
import { browsePath, sanitizeBrowseUrl } from '@shared/inAppBrowse'
import { InAppBrowserFrame } from './InAppBrowser'

const spring = { type: 'spring' as const, bounce: 0, duration: 0.35 }

function CashbackBadge({ pct }: { pct: string }) {
  return (
    <span
      className="absolute -right-1.5 -top-1.5 z-10 flex h-7 w-7 items-center justify-center text-[8px] font-black leading-none text-white"
      style={{
        background: '#e31b23',
        clipPath:
          'polygon(50% 0%, 61% 16%, 82% 8%, 80% 32%, 100% 50%, 80% 68%, 82% 92%, 61% 84%, 50% 100%, 39% 84%, 18% 92%, 20% 68%, 0 50%, 20% 32%, 18% 8%, 39% 16%)',
      }}
    >
      {pct}
    </span>
  )
}

function StoreTile({ store }: { store: SuperBrowseStore }) {
  const to = browsePath({
    url: store.url,
    title: store.name,
    returnTo: '/dashboard/browse',
  })
  if (!to) return null
  return (
    <Link to={to} className="flex flex-col items-center gap-2">
      <motion.span
        whileTap={{ scale: 0.94 }}
        transition={spring}
        className="relative flex h-[3.85rem] w-[3.85rem] items-center justify-center overflow-visible rounded-[1.15rem] shadow-[0_8px_18px_rgba(0,0,0,0.28)]"
        style={{ background: store.bg }}
      >
        <img
          src={storeLogo(store.domain)}
          alt=""
          className="h-9 w-9 object-contain"
        />
        {store.cashback && <CashbackBadge pct={store.cashback} />}
      </motion.span>
      <span className="max-w-[4.6rem] truncate text-center text-[11px] font-medium text-white/88">
        {store.name}
      </span>
    </Link>
  )
}

export function SuperBrowseGrid({ showChrome = true }: { showChrome?: boolean }) {
  const navigate = useNavigate()
  const [draft, setDraft] = useState('')

  const openDraft = () => {
    const url = sanitizeBrowseUrl(draft.includes('://') ? draft : `https://${draft}`)
    if (!url) return
    const path = browsePath({ url, returnTo: '/dashboard/browse' })
    if (path) navigate(path)
  }

  const demo = browsePath({
    url: 'https://www.flipkart.com/',
    title: 'Flipkart',
    returnTo: '/dashboard/browse',
  })

  return (
    <div className="space-y-5">
      {showChrome && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            openDraft()
          }}
          className="flex items-center gap-2 rounded-2xl bg-[#16181d] px-4 py-3"
        >
          <Search size={16} className="shrink-0 text-white/35" />
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Paste any store link"
            className="min-w-0 flex-1 bg-transparent text-[14px] text-white outline-none placeholder:text-white/35"
            inputMode="url"
            autoCapitalize="off"
            autoCorrect="off"
          />
          <Mic size={16} className="shrink-0 text-white/28" aria-hidden />
        </form>
      )}

      <div>
        <h2 className="text-[1.65rem] font-semibold tracking-[-0.04em] text-white">Super Browse</h2>
        <p className="mt-0.5 text-[13px] text-white/45">Browse every store from one place.</p>
      </div>

      <div className="grid grid-cols-4 gap-x-2 gap-y-5">
        {SUPER_BROWSE_STORES.map((store) => (
          <StoreTile key={store.id} store={store} />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <Link
          to="/dashboard/offers?tab=marketplace"
          className="rounded-2xl bg-[linear-gradient(90deg,#5b6cff_0%,#7a4dff_100%)] px-4 py-3 text-center text-[13px] font-semibold text-white"
        >
          See all stores →
        </Link>
        {demo && (
          <Link
            to={demo}
            className="rounded-2xl border border-white/20 bg-transparent px-4 py-3 text-center text-[13px] font-semibold text-white"
          >
            Show Demo
          </Link>
        )}
      </div>

      {showChrome && (
        <div className="space-y-3 pt-1">
          <h3 className="text-[1.05rem] font-semibold tracking-[-0.02em] text-white">Curated for you</h3>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-2xl bg-[#16181d] px-3 py-4">
              <p className="text-[13px] font-semibold leading-snug text-[#f5c542]">
                20.2K+ pts. earned by 3.2K+ users
              </p>
            </div>
            <div className="rounded-2xl bg-[#16181d] px-3 py-4">
              <p className="text-[13px] font-semibold leading-snug text-[#f5c542]">
                ₹ 40L+ saved by 9K+ users
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const SuperBrowsePage: React.FC = () => {
  const [params] = useSearchParams()
  const url = params.get('url')
  const title = params.get('title') || undefined
  const from = params.get('from') || '/dashboard/browse'

  if (url) {
    return <InAppBrowserFrame src={url} title={title} returnTo={from} />
  }

  return (
    <div className="pb-8">
      <SuperBrowseGrid />
    </div>
  )
}

export default SuperBrowsePage

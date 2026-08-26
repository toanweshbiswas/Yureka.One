import React, { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { motion } from 'motion/react'
import { Search } from 'lucide-react'
import { SUPER_BROWSE_STORES, fetchSuperBrowseStores, type SuperBrowseStore } from '@shared/superBrowseStores'
import { BrandLogo } from '@shared/BrandLogo'
import { sanitizeBrowseUrl } from '@shared/inAppBrowse'
import {
  openStoreBrowse,
  prefetchSuperBrowseLinks,
  type TrackedOpen,
} from '@shared/trackedBrowse'
import { onCatalogUpdate } from '@shared/catalogSync'
import { useSupabase } from '@shared/SupabaseProvider'
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

function useSuperBrowseOpen() {
  // Always window.open — Super Browse is a store launcher, not the in-app iframe.
  return (url: string, userId: string, opts?: { title?: string; knownOpenUrl?: string }) => {
    const cueOk = Boolean(opts?.knownOpenUrl)
    void openStoreBrowse(url, userId, {
      title: opts?.title,
      returnTo: '/dashboard/browse',
      forceExternal: true,
      knownOpenUrl: cueOk ? opts?.knownOpenUrl : undefined,
      preferWeb: !cueOk,
    })
  }
}

function StoreTile({
  store,
  userId,
  knownOpen,
  openStore,
}: {
  store: SuperBrowseStore
  userId: string
  knownOpen?: TrackedOpen | null
  openStore: ReturnType<typeof useSuperBrowseOpen>
}) {
  const className = 'flex flex-col items-center gap-2'
  const inner = (
    <>
      <motion.span
        whileTap={{ scale: 0.94 }}
        transition={spring}
        className="relative flex h-[3.85rem] w-[3.85rem] items-center justify-center overflow-hidden rounded-[1.15rem] shadow-[0_8px_18px_rgba(0,0,0,0.28)]"
        style={{ background: store.bg }}
      >
        <BrandLogo
          domain={store.domain}
          name={store.name}
          logoUrl={store.logoUrl}
          className="flex h-[72%] w-[72%] max-h-11 max-w-11 items-center justify-center"
          imgClassName="h-full w-full object-contain p-[6%]"
        />
        {store.cashback && <CashbackBadge pct={store.cashback} />}
      </motion.span>
      <span className="max-w-[4.6rem] truncate text-center text-[11px] font-medium text-white/88">
        {store.name}
      </span>
    </>
  )

  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        const cue = knownOpen?.affiliate ? knownOpen.openUrl : undefined
        openStore(store.url, userId, {
          title: store.name,
          knownOpenUrl: cue,
        })
      }}
    >
      {inner}
    </button>
  )
}

export function SuperBrowseGrid({ showChrome = true }: { showChrome?: boolean }) {
  const { user } = useSupabase()
  const userId = user?.id || ''
  const openStore = useSuperBrowseOpen()
  const [draft, setDraft] = useState('')
  const [stores, setStores] = useState<SuperBrowseStore[]>(SUPER_BROWSE_STORES)
  const [trackedLinks, setTrackedLinks] = useState<Record<string, TrackedOpen>>({})

  useEffect(() => {
    let cancelled = false
    const loadStores = () => {
      void fetchSuperBrowseStores().then((next) => {
        if (!cancelled && next.length) setStores(next)
      })
    }
    loadStores()
    const stop = onCatalogUpdate(() => loadStores())
    return () => {
      cancelled = true
      stop()
    }
  }, [])

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    const loadLinks = () => {
      void prefetchSuperBrowseLinks(userId).then((links) => {
        if (!cancelled) setTrackedLinks(links)
      })
    }
    loadLinks()
    const stop = onCatalogUpdate(() => loadLinks())
    return () => {
      cancelled = true
      stop()
    }
  }, [userId])

  useEffect(() => {
    // Landing on Browse should keep the Explore brands grid in view after store returns.
    void import('@shared/dashboardScroll').then((m) => {
      m.restoreDashboardPosition({ pathname: '/dashboard/browse' })
    })
  }, [])

  const openDraft = () => {
    const url = sanitizeBrowseUrl(draft.includes('://') ? draft : `https://${draft}`)
    if (!url) return
    openStore(url, userId)
  }

  return (
    <div id={showChrome ? 'explore-brands' : undefined} className="space-y-5 scroll-mt-24">
      {/* Legacy hash anchors from older deep links */}
      {showChrome && <span id="super-browse" className="sr-only" aria-hidden />}
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
            enterKeyHint="go"
          />
        </form>
      )}

      <div>
        <h2 className="text-[1.65rem] font-semibold tracking-[-0.04em] text-white">Super Browse</h2>
        <p className="mt-0.5 text-[13px] text-white/45">Tap a store to open it in a new window.</p>
      </div>

      <div className="grid grid-cols-4 gap-x-2 gap-y-5">
        {stores.map((store) => (
          <StoreTile
            key={store.id}
            store={store}
            userId={userId}
            knownOpen={trackedLinks[store.id]}
            openStore={openStore}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <Link
          to="/dashboard/offers?tab=marketplace"
          className="rounded-2xl bg-clay px-4 py-3 text-center text-[13px] font-semibold text-black"
        >
          View marketplace offers →
        </Link>
        <button
          type="button"
          className="rounded-2xl border border-white/20 bg-transparent px-4 py-3 text-center text-[13px] font-semibold text-white"
          onClick={() => {
            const cue = trackedLinks.flipkart?.affiliate
              ? trackedLinks.flipkart.openUrl
              : undefined
            openStore('https://www.flipkart.com/', userId, {
              title: 'Flipkart',
              knownOpenUrl: cue,
            })
          }}
        >
          Open Flipkart
        </button>
      </div>
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

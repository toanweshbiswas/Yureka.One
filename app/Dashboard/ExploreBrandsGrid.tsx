import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'motion/react'
import { SUPER_BROWSE_STORES, fetchSuperBrowseStores, type SuperBrowseStore } from '@shared/superBrowseStores'
import { BrandLogo } from '@shared/BrandLogo'
import { openStoreBrowse, prefetchStoreLinks, type TrackedOpen } from '@shared/trackedBrowse'
import { onCatalogUpdate } from '@shared/catalogSync'
import { useSupabase } from '@shared/SupabaseProvider'

const spring = { type: 'spring' as const, bounce: 0, duration: 0.35 }
const MotionLink = motion.create(Link)

type Props = {
  /** Cap tiles on the home surface; omit to show the full catalog. */
  limit?: number
  /** Compact mobile home vs roomier desktop home. */
  compact?: boolean
  className?: string
}

/**
 * Everyday Brands grid. Apple-style app-icon layout.
 * Press feedback on pointer-down (whileTap), critically damped springs,
 * translucent material chrome, size-specific type tracking.
 */
export default function ExploreBrandsGrid({ limit = 8, compact = false, className = '' }: Props) {
  const { user } = useSupabase()
  const userId = user?.id || ''
  const reduceMotion = useReducedMotion()
  const [stores, setStores] = useState<SuperBrowseStore[]>(SUPER_BROWSE_STORES)
  const [trackedLinks, setTrackedLinks] = useState<Record<string, TrackedOpen>>({})

  useEffect(() => {
    let cancelled = false
    const load = () => {
      void fetchSuperBrowseStores().then((next) => {
        if (!cancelled && next.length) setStores(next)
      })
    }
    load()
    const stop = onCatalogUpdate(() => load())
    return () => {
      cancelled = true
      stop()
    }
  }, [])

  const visible = useMemo(() => stores.slice(0, limit), [stores, limit])

  useEffect(() => {
    if (!userId || !visible.length) return
    let cancelled = false
    void prefetchStoreLinks(userId, visible).then((links) => {
      if (!cancelled) setTrackedLinks(links)
    })
    return () => {
      cancelled = true
    }
  }, [userId, visible])

  const openStore = (store: SuperBrowseStore) => {
    const cue = trackedLinks[store.id]?.affiliate ? trackedLinks[store.id].openUrl : undefined
    void openStoreBrowse(store.url, userId, {
      title: store.name,
      returnTo: '/dashboard/home#explore-brands',
      forceExternal: true,
      knownOpenUrl: cue,
      storeId: store.id,
      storeName: store.name,
      source: 'explore',
    })
  }

  return (
    <div className={className}>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p
            className={
              compact
                ? 'text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40'
                : 'text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40'
            }
          >
            Everyday Brands
          </p>
          <p className="mt-1 text-[13px] leading-snug tracking-[-0.01em] text-white/50">
            Assured Savings
          </p>
        </div>
        <MotionLink
          to="/dashboard/browse"
          whileTap={{ scale: 0.97 }}
          transition={spring}
          className="shrink-0 text-[12px] font-semibold tracking-[-0.01em] text-clay"
        >
          Explore all →
        </MotionLink>
      </div>

      <div
        className={
          compact
            ? 'mt-3 rounded-[1.5rem] bg-white/[0.045] p-3 backdrop-blur-xl supports-[backdrop-filter]:bg-white/[0.035]'
            : 'mt-3 rounded-[1.75rem] bg-white/[0.04] p-4 backdrop-blur-2xl supports-[backdrop-filter]:bg-white/[0.03] sm:p-5'
        }
        style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)' }}
      >
        <div
          className={
            compact
              ? 'grid grid-cols-4 gap-x-2 gap-y-4'
              : 'grid grid-cols-4 gap-x-3 gap-y-4 sm:grid-cols-6 md:grid-cols-8'
          }
        >
          {visible.map((store, index) => (
            <motion.button
              key={store.id}
              type="button"
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                ...spring,
                delay: reduceMotion ? 0 : Math.min(index * 0.025, 0.2),
              }}
              whileTap={{ scale: 0.92 }}
              onClick={() => openStore(store)}
              className="group flex flex-col items-center gap-2 outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0c0d10]"
            >
              <span
                className={
                  compact
                    ? 'relative flex aspect-square w-full max-w-[3.85rem] items-center justify-center'
                    : 'relative flex aspect-square w-full items-center justify-center'
                }
              >
                <BrandLogo
                  domain={store.domain}
                  name={store.name}
                  logoUrl={store.logoUrl}
                  className="flex h-full w-full items-center justify-center"
                  imgClassName="h-full w-full object-contain drop-shadow-[0_6px_14px_rgba(0,0,0,0.35)]"
                />
                {store.cashback ? (
                  <span className="absolute -right-0.5 -top-0.5 z-10 rounded-full bg-[#10372c] px-1.5 py-0.5 text-[8px] font-bold leading-none tracking-[0.02em] text-white ring-2 ring-[#0c1411]">
                    {store.cashback}
                  </span>
                ) : null}
              </span>
              <span
                className={
                  compact
                    ? 'w-full truncate text-center text-[11px] font-medium tracking-[-0.01em] text-white/80'
                    : 'w-full truncate text-center text-[11px] font-medium tracking-[-0.01em] text-white/75 sm:text-[12px]'
                }
              >
                {store.name}
              </span>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  )
}

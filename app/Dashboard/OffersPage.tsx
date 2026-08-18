import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { ExternalLink, Loader2, Tag, CheckCircle2, Search, Coins, Store, Copy, RefreshCw } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { useSupabase } from '@shared/SupabaseProvider'
import { formatPaise, goldbackApi, goldbackEarnKey } from '@backend/lib/goldback/client'
import type { GoldbackOffer } from '@backend/lib/goldback/types'
import type { CueLinksOffer } from '@backend/lib/cuelinks/types'
import { cacheGet, cacheSet, cacheInvalidate, CACHE_TTL } from '@shared/dashboardCache'
import { notifyGoldbackUpdated } from '@shared/goldbackEvents'

type Tab = 'goldback' | 'marketplace'

const BATCH_SIZE = 24
const MARKET_CACHE_KEY = 'offers:marketplace:v2'
const GB_CACHE_KEY = 'offers:goldback:v2'

const CATEGORY_COLORS: Record<string, string> = {
  beauty: 'from-rose-500/20 to-transparent',
  shopping: 'from-amber-500/15 to-transparent',
  food: 'from-orange-500/20 to-transparent',
  fashion: 'from-fuchsia-500/15 to-transparent',
  electronics: 'from-sky-500/15 to-transparent',
  general: 'from-clay/15 to-transparent',
}

type MarketCache = {
  items: CueLinksOffer[]
  categories: string[]
  catalogTotal: number
}

function OfferMedia({
  src,
  alt,
  fallback = 'store',
}: {
  src?: string | null
  alt: string
  fallback?: 'store' | 'tag'
}) {
  const [broken, setBroken] = useState(false)
  const Icon = fallback === 'tag' ? Tag : Store
  if (!src || broken) {
    return (
      <div className="h-full w-full flex items-center justify-center text-white/20">
        <Icon size={28} />
      </div>
    )
  }
  return (
    <img
      src={src}
      alt={alt}
      className="h-full w-full object-contain p-5 bg-white/[0.04]"
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
    />
  )
}

const OffersPage: React.FC = () => {
  const { user } = useSupabase()
  const userId = user?.id || user?.email || ''
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedTab = searchParams.get('tab') === 'marketplace' ? 'marketplace' : 'goldback'
  const [tab, setTab] = useState<Tab>(requestedTab)

  const [offers, setOffers] = useState<GoldbackOffer[]>(() => {
    const hit = cacheGet<GoldbackOffer[]>(GB_CACHE_KEY, CACHE_TTL.offersGoldback)
    return hit?.data ?? []
  })
  const [gbLoading, setGbLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const [marketAll, setMarketAll] = useState<CueLinksOffer[]>(() => {
    const hit = cacheGet<MarketCache>(MARKET_CACHE_KEY, CACHE_TTL.offersMarketplace)
    return hit?.data.items ?? []
  })
  const [marketCats, setMarketCats] = useState<string[]>(() => {
    const hit = cacheGet<MarketCache>(MARKET_CACHE_KEY, CACHE_TTL.offersMarketplace)
    return hit?.data.categories ?? []
  })
  const [catalogTotal, setCatalogTotal] = useState(() => {
    const hit = cacheGet<MarketCache>(MARKET_CACHE_KEY, CACHE_TTL.offersMarketplace)
    return hit?.data.catalogTotal ?? 0
  })
  const [mLoading, setMLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE)

  const [toast, setToast] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [category, setCategory] = useState('all')
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')

  const marketLoadedRef = useRef(marketAll.length > 0)
  const gbLoadedRef = useRef(offers.length > 0)
  const fetchGen = useRef(0)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), query ? 280 : 0)
    return () => clearTimeout(t)
  }, [query])

  useEffect(() => {
    if (requestedTab !== tab) setTab(requestedTab)
  }, [requestedTab, tab])

  useEffect(() => {
    setVisibleCount(BATCH_SIZE)
  }, [category, debouncedQuery, tab])

  const applyMarketPayload = useCallback((payload: MarketCache) => {
    setMarketAll(payload.items)
    setMarketCats(payload.categories)
    setCatalogTotal(payload.catalogTotal)
    cacheSet(MARKET_CACHE_KEY, payload)
    marketLoadedRef.current = true
  }, [])

  const loadMarketplace = useCallback(async (opts?: { refresh?: boolean; silent?: boolean }) => {
    const gen = ++fetchGen.current
    if (opts?.refresh) setRefreshing(true)
    else if (!opts?.silent && !marketLoadedRef.current) setMLoading(true)
    setError(null)
    try {
      if (opts?.refresh) await fetch('/api/marketplace/refresh', { method: 'POST' })
      // Pull full filtered catalog in one shot (server already caches CueLinks pages).
      // Client then batches UI rendering — avoids N refetch on category / tab switches.
      const res = await fetch('/api/marketplace/offers')
      const json = await res.json()
      if (gen !== fetchGen.current) return
      if (!res.ok || json.error) throw new Error(json.error || 'Could not load marketplace offers')
      applyMarketPayload({
        items: json.data.items || [],
        categories: json.data.categories || [],
        catalogTotal: json.data.catalogTotal || 0,
      })
    } catch (e: any) {
      if (gen !== fetchGen.current) return
      if (!marketLoadedRef.current) {
        setError(e?.message || 'Could not load marketplace offers')
        setMarketAll([])
      }
    } finally {
      if (gen === fetchGen.current) {
        setMLoading(false)
        setRefreshing(false)
      }
    }
  }, [applyMarketPayload])

  const loadGoldback = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent && !gbLoadedRef.current) setGbLoading(true)
    setError(null)
    const res = await goldbackApi.offers(userId)
    if (res.error || !res.data) {
      if (!gbLoadedRef.current) setError(res.error || 'Could not load Goldback offers')
    } else {
      setOffers(res.data)
      cacheSet(GB_CACHE_KEY, res.data)
      gbLoadedRef.current = true
    }
    setGbLoading(false)
  }, [userId])

  // Initial / stale-while-revalidate for marketplace
  useEffect(() => {
    if (tab !== 'marketplace') return
    const hit = cacheGet<MarketCache>(MARKET_CACHE_KEY, CACHE_TTL.offersMarketplace)
    if (hit) {
      applyMarketPayload(hit.data)
      if (hit.stale) void loadMarketplace({ silent: true })
      return
    }
    void loadMarketplace()
  }, [tab, loadMarketplace, applyMarketPayload])

  useEffect(() => {
    if (tab !== 'goldback') return
    const hit = cacheGet<GoldbackOffer[]>(GB_CACHE_KEY, CACHE_TTL.offersGoldback)
    if (hit) {
      setOffers(hit.data)
      gbLoadedRef.current = true
      if (hit.stale) void loadGoldback({ silent: true })
      return
    }
    void loadGoldback()
  }, [tab, loadGoldback])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4200)
    return () => clearTimeout(t)
  }, [toast])

  const filteredMarket = useMemo(() => {
    const q = debouncedQuery.toLowerCase()
    return marketAll.filter((o) => {
      if (category !== 'all' && !o.categories.some((c) => c.toLowerCase() === category.toLowerCase())) {
        return false
      }
      if (!q) return true
      const hay = `${o.title} ${o.merchant} ${o.description} ${o.categories.join(' ')} ${o.couponCode || ''}`.toLowerCase()
      return hay.includes(q)
    })
  }, [marketAll, category, debouncedQuery])

  const visibleMarket = useMemo(
    () => filteredMarket.slice(0, visibleCount),
    [filteredMarket, visibleCount],
  )
  const hasMoreMarket = visibleCount < filteredMarket.length

  const gbCategories = useMemo(() => {
    const set = new Set(offers.map((o) => o.category || 'general'))
    return ['all', ...Array.from(set).sort()]
  }, [offers])

  const filteredGb = useMemo(() => {
    const q = debouncedQuery.toLowerCase()
    return offers.filter((o) => {
      if (category !== 'all' && (o.category || 'general') !== category) return false
      if (!q) return true
      return (
        o.title.toLowerCase().includes(q) ||
        o.merchant.toLowerCase().includes(q) ||
        o.description.toLowerCase().includes(q)
      )
    })
  }, [offers, category, debouncedQuery])

  const visibleGb = useMemo(
    () => filteredGb.slice(0, visibleCount),
    [filteredGb, visibleCount],
  )
  const hasMoreGb = visibleCount < filteredGb.length

  const handleGoldback = async (offer: GoldbackOffer) => {
    setBusyId(offer.id)
    setToast(null)
    await goldbackApi.click(userId, offer.id)
    const earn = await goldbackApi.earn(userId, offer.id, goldbackEarnKey(userId, offer.id))
    window.open(offer.url, '_blank', 'noopener,noreferrer')
    if (earn.error || !earn.data) {
      setToast(earn.error || 'Opened offer — earn credit failed')
    } else if (earn.data.created) {
      setToast(`+${formatPaise(earn.data.entry.amountPaise)} Goldback credited`)
      cacheInvalidate('goldback:home:')
      notifyGoldbackUpdated({
        balancePaise: earn.data.balance.balancePaise,
        userId,
      })
    } else {
      setToast('Offer opened — Goldback already credited for this deal')
      notifyGoldbackUpdated({
        balancePaise: earn.data.balance.balancePaise,
        userId,
      })
    }
    setBusyId(null)
  }

  const handleMarketplace = (offer: CueLinksOffer) => {
    const link = offer.affiliateUrl || offer.url
    if (!link) {
      setToast('No affiliate link for this offer')
      return
    }
    window.open(link, '_blank', 'noopener,noreferrer')
    setToast(`Opened ${offer.merchant}`)
  }

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code)
      setToast(`Copied code ${code}`)
    } catch {
      setToast(code)
    }
  }

  const switchTab = (next: Tab) => {
    if (next === tab) return
    setTab(next)
    setSearchParams((prev) => {
      const nextParams = new URLSearchParams(prev)
      nextParams.set('tab', next)
      return nextParams
    }, { replace: true })
    setCategory('all')
    setQuery('')
    setDebouncedQuery('')
  }

  const loading =
    (tab === 'goldback' && gbLoading && !offers.length) ||
    (tab === 'marketplace' && mLoading && !marketAll.length)
  const chips = tab === 'goldback' ? gbCategories : ['all', ...marketCats]
  const marketTotal = filteredMarket.length

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl">
        <h2 className="text-2xl font-black tracking-tight text-white mb-2">Offers</h2>
        <p className="text-white/45 text-[15px] leading-relaxed">
          Goldback deals credit your balance. Marketplace shows live coupons and discounts
          {catalogTotal ? ` (${catalogTotal.toLocaleString('en-IN')} in catalog)` : ''}.
        </p>
      </motion.div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => switchTab('marketplace')}
          className={`inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-[11px] font-black uppercase tracking-[0.15em] transition active:scale-[0.97] ${
            tab === 'marketplace' ? 'bg-white text-black' : 'bg-white/5 text-white/40 hover:text-white'
          }`}
        >
          <Store size={14} /> Marketplace
          {tab === 'marketplace' && marketTotal > 0 && (
            <span className="rounded-md bg-black/10 px-1.5 py-0.5 text-[9px]">{marketTotal}</span>
          )}
        </button>
        <button
          type="button"
          onClick={() => switchTab('goldback')}
          className={`inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-[11px] font-black uppercase tracking-[0.15em] transition active:scale-[0.97] ${
            tab === 'goldback' ? 'bg-clay text-black' : 'bg-white/5 text-white/40 hover:text-white'
          }`}
        >
          <Coins size={14} /> Earn Goldback
        </button>
        {tab === 'marketplace' && (
          <button
            type="button"
            onClick={() => loadMarketplace({ refresh: true })}
            disabled={refreshing}
            className="ml-auto inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] text-white/40 hover:text-white disabled:opacity-50 active:scale-[0.97]"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} /> Refresh
          </button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tab === 'marketplace' ? 'Search marketplace deals…' : 'Search Goldback offers…'}
            className="w-full rounded-2xl border border-white/10 bg-white/[0.03] pl-11 pr-4 py-3.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-clay/40 focus:ring-1 focus:ring-clay/20 transition"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none max-w-full">
          {chips.slice(0, 24).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`shrink-0 rounded-xl px-3.5 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] transition active:scale-[0.97] ${
                category === c
                  ? 'bg-clay text-black shadow-[0_0_24px_rgba(52,211,153,0.25)]'
                  : 'bg-white/[0.04] text-white/40 border border-white/10 hover:text-white'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] md:bottom-8 left-1/2 z-50 -translate-x-1/2 flex items-center gap-2.5 rounded-2xl border border-clay/40 bg-black/90 backdrop-blur-xl px-5 py-3.5 text-sm text-clay font-bold shadow-2xl"
          >
            <CheckCircle2 size={18} />
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <div className="rounded-2xl border border-red-500/25 bg-red-500/10 px-5 py-3 text-sm text-red-200">{error}</div>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="animate-spin text-clay" size={32} />
          <span className="text-[11px] font-black uppercase tracking-[0.35em] text-white/35">
            Loading {tab === 'marketplace' ? 'marketplace' : 'Goldback'} offers
          </span>
        </div>
      )}

      {!loading && tab === 'goldback' && (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            {visibleGb.map((offer, idx) => {
              const grad = CATEGORY_COLORS[offer.category] || CATEGORY_COLORS.general
              return (
                <motion.article
                  key={offer.id}
                  layout
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(idx * 0.03, 0.25) }}
                  className="group relative overflow-hidden rounded-[1.75rem] border border-white/[0.08] bg-[#0d0d0d] flex flex-col"
                >
                  <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${grad}`} />
                  <div className="relative aspect-[16/9] bg-white/[0.03] border-b border-white/[0.06]">
                    <OfferMedia src={offer.imageUrl} alt={offer.merchant} fallback="tag" />
                  </div>
                  <div className="relative p-6 flex flex-col gap-4 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.28em] text-clay/80 mb-2.5 inline-flex items-center gap-1.5">
                          <Tag size={11} /> {offer.category}
                        </p>
                        <h3 className="text-xl font-black text-white tracking-tight leading-snug">{offer.title}</h3>
                        <p className="text-white/40 text-xs mt-1.5 font-medium">{offer.merchant}</p>
                      </div>
                      <span className="shrink-0 rounded-2xl bg-clay text-black px-3.5 py-2.5 text-[11px] font-black shadow-[0_0_20px_rgba(52,211,153,0.2)]">
                        {offer.rewardLabel || formatPaise(offer.rewardPaise)}
                      </span>
                    </div>
                    <p className="text-white/50 text-sm leading-relaxed flex-1">{offer.description}</p>
                    <button
                      type="button"
                      disabled={busyId === offer.id}
                      onClick={() => handleGoldback(offer)}
                      className="mt-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-white text-black px-5 py-4 text-[11px] font-black uppercase tracking-[0.18em] hover:bg-clay transition disabled:opacity-50 active:scale-[0.98]"
                    >
                      {busyId === offer.id ? <Loader2 size={16} className="animate-spin" /> : <ExternalLink size={16} />}
                      Shop & earn
                    </button>
                  </div>
                </motion.article>
              )
            })}
            {!filteredGb.length && !error && (
              <div className="md:col-span-2 rounded-[1.75rem] border border-white/10 px-8 py-16 text-center text-white/40 text-sm">
                No Goldback offers match that filter.
              </div>
            )}
          </div>
          {hasMoreGb && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={() => setVisibleCount((n) => n + BATCH_SIZE)}
                className="rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-3.5 text-[11px] font-black uppercase tracking-[0.2em] text-white/70 active:scale-[0.97]"
              >
                Load more ({filteredGb.length - visibleCount} left)
              </button>
            </div>
          )}
        </>
      )}

      {!loading && tab === 'marketplace' && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visibleMarket.map((offer, idx) => (
              <motion.article
                key={offer.id}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(idx * 0.012, 0.2) }}
                className="rounded-[1.5rem] border border-white/[0.08] bg-[#0d0d0d] overflow-hidden flex flex-col"
              >
                <div className="aspect-[16/9] bg-white/[0.03] relative">
                  <OfferMedia src={offer.imageUrl} alt={offer.merchant} />
                  {offer.categories[0] && (
                    <span className="absolute left-3 top-3 rounded-lg bg-black/70 backdrop-blur px-2 py-1 text-[9px] font-black uppercase tracking-widest text-white/80">
                      {offer.categories[0]}
                    </span>
                  )}
                  <span className="absolute right-3 top-3 rounded-lg bg-clay/20 border border-clay/30 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-clay">
                    {offer.type}
                  </span>
                </div>
                <div className="p-4 flex flex-col gap-3 flex-1">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/35">{offer.merchant}</p>
                    <h3 className="font-bold text-white tracking-tight mt-1 line-clamp-2 leading-snug">{offer.title}</h3>
                    {offer.description && (
                      <p className="text-white/40 text-xs mt-2 line-clamp-2 leading-relaxed">{offer.description}</p>
                    )}
                  </div>
                  {offer.couponCode && (
                    <button
                      type="button"
                      onClick={() => copyCode(offer.couponCode!)}
                      className="inline-flex items-center gap-2 self-start rounded-xl border border-dashed border-clay/40 bg-clay/10 px-3 py-1.5 text-[11px] font-mono font-bold text-clay active:scale-[0.97]"
                    >
                      <Copy size={12} /> {offer.couponCode}
                    </button>
                  )}
                  {offer.endDate && (
                    <p className="text-[10px] text-white/25 uppercase tracking-wider">Ends {offer.endDate}</p>
                  )}
                  <button
                    type="button"
                    onClick={() => handleMarketplace(offer)}
                    className="mt-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-white text-black px-4 py-3.5 text-[11px] font-black uppercase tracking-[0.18em] hover:bg-clay transition active:scale-[0.98]"
                  >
                    <ExternalLink size={14} /> Shop deal
                  </button>
                </div>
              </motion.article>
            ))}
            {!filteredMarket.length && !error && (
              <div className="sm:col-span-2 lg:col-span-3 rounded-[1.75rem] border border-white/10 px-8 py-16 text-center text-white/40 text-sm">
                No marketplace offers match that filter.
              </div>
            )}
          </div>
          {hasMoreMarket && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={() => setVisibleCount((n) => n + BATCH_SIZE)}
                className="rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-3.5 text-[11px] font-black uppercase tracking-[0.2em] text-white/70 active:scale-[0.97]"
              >
                Load more ({filteredMarket.length - visibleCount} left)
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default OffersPage

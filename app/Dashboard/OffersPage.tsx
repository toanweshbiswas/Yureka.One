import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import { ArrowRight, Loader2, Search, Copy, RefreshCw } from 'lucide-react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useSupabase } from '@shared/SupabaseProvider'
import { formatPaise, goldbackApi, goldbackEarnKey } from '@backend/lib/goldback/client'
import type { GoldbackOffer } from '@backend/lib/goldback/types'
import type { CueLinksOffer } from '@backend/lib/cuelinks/types'
import { cacheGet, cacheSet, cacheInvalidate, CACHE_TTL } from '@shared/dashboardCache'
import { notifyGoldbackUpdated } from '@shared/goldbackEvents'
import { getExploreScene, matchesSceneBrands, sceneBrandNames } from '@shared/exploreScenes'
import Icon3d from '@shared/Icon3d'
import { isAffiliateRedirectUrl, sanitizeBrowseUrl } from '@shared/inAppBrowse'
import { openStoreBrowse } from '@shared/trackedBrowse'

type Tab = 'goldback' | 'marketplace'

const BATCH_SIZE = 24
const MARKET_CACHE_KEY = 'offers:marketplace:v4'
const GB_CACHE_KEY = 'offers:goldback:v2'
const spring = { type: 'spring' as const, bounce: 0, duration: 0.4 }

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

type MarketplaceBrand = {
  id: string
  merchant: string
  host: string | null
  homeUrl: string | null
  offerCount: number
  imageUrl: string | null
  categories: string[]
}

const BRANDS_CACHE_KEY = 'offers:brands:v1'

function prettyLabel(value: string) {
  if (value === 'all') return 'All'
  return value
    .toLowerCase()
    .split(/[_\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
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
  useEffect(() => {
    setBroken(false)
  }, [src])
  const fallbackIcon = fallback === 'tag' ? 'file-text' : 'bag'
  if (!src || broken) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <Icon3d name={fallbackIcon} className="h-10 w-10 object-contain opacity-50" alt="" />
      </div>
    )
  }
  return (
    <img
      key={src}
      src={src}
      alt={alt}
      className="h-full w-full object-contain p-5 bg-white/[0.04]"
      loading="eager"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
    />
  )
}

const OffersPage: React.FC = () => {
  const reduceMotion = useReducedMotion()
  const { user } = useSupabase()
  const location = useLocation()
  const navigate = useNavigate()
  const userId = user?.id || user?.email || ''
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  const scene = location.pathname.startsWith('/dashboard/offers')
    ? getExploreScene(searchParams.get('scene'))
    : null
  const requestedTab: Tab = tabParam === 'goldback' ? 'goldback' : 'marketplace'
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
  const [brands, setBrands] = useState<MarketplaceBrand[]>(() => {
    const hit = cacheGet<MarketplaceBrand[]>(BRANDS_CACHE_KEY, CACHE_TTL.offersMarketplace)
    return hit?.data ?? []
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
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), query ? 220 : 0)
    return () => clearTimeout(t)
  }, [query])

  useEffect(() => {
    if (requestedTab !== tab) setTab(requestedTab)
  }, [requestedTab, tab])

  useEffect(() => {
    setVisibleCount(BATCH_SIZE)
  }, [category, debouncedQuery, tab, scene?.id])

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
      const [offersRes, brandsRes] = await Promise.all([
        fetch('/api/marketplace/offers'),
        fetch('/api/marketplace/brands?limit=80'),
      ])
      const offersJson = await offersRes.json()
      const brandsJson = await brandsRes.json()
      if (gen !== fetchGen.current) return
      if (!offersRes.ok || offersJson.error) {
        throw new Error(offersJson.error || 'Could not load marketplace offers')
      }
      applyMarketPayload({
        items: offersJson.data.items || [],
        categories: offersJson.data.categories || [],
        catalogTotal: offersJson.data.catalogTotal || 0,
      })
      if (brandsRes.ok && !brandsJson.error && Array.isArray(brandsJson.data?.items)) {
        const nextBrands = brandsJson.data.items as MarketplaceBrand[]
        setBrands(nextBrands)
        cacheSet(BRANDS_CACHE_KEY, nextBrands)
      }
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
      if (!matchesSceneBrands(`${o.merchant} ${o.title} ${o.description}`, scene)) return false
      if (category !== 'all' && !o.categories.some((c) => c.toLowerCase() === category.toLowerCase())) {
        return false
      }
      if (!q) return true
      const hay = `${o.title} ${o.merchant} ${o.description} ${o.categories.join(' ')} ${o.couponCode || ''}`.toLowerCase()
      return hay.includes(q)
    })
  }, [marketAll, category, debouncedQuery, scene])

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
      if (!matchesSceneBrands(`${o.merchant} ${o.title} ${o.description}`, scene)) return false
      if (category !== 'all' && (o.category || 'general') !== category) return false
      if (!q) return true
      return (
        o.title.toLowerCase().includes(q) ||
        o.merchant.toLowerCase().includes(q) ||
        o.description.toLowerCase().includes(q)
      )
    })
  }, [offers, category, debouncedQuery, scene])

  const visibleGb = useMemo(
    () => filteredGb.slice(0, visibleCount),
    [filteredGb, visibleCount],
  )
  const hasMoreGb = visibleCount < filteredGb.length

  const filteredBrands = useMemo(() => {
    const q = debouncedQuery.toLowerCase()
    return brands.filter((b) => {
      if (!b.homeUrl) return false
      if (!matchesSceneBrands(`${b.merchant} ${b.host || ''} ${b.categories.join(' ')}`, scene)) {
        return false
      }
      if (category !== 'all' && !b.categories.some((c) => c.toLowerCase() === category.toLowerCase())) {
        return false
      }
      if (!q) return true
      return `${b.merchant} ${b.host || ''}`.toLowerCase().includes(q)
    })
  }, [brands, debouncedQuery, scene, category])

  const offersReturnTo = '/dashboard/offers'

  const openBrandOrOffer = (
    rawUrl: string,
    title?: string,
    affiliateUrl?: string | null,
  ) => {
    const dest = sanitizeBrowseUrl(rawUrl)
    if (!dest) return
    const aff = sanitizeBrowseUrl(affiliateUrl || '')
    const knownOpenUrl =
      aff && aff !== dest && isAffiliateRedirectUrl(aff) ? aff : undefined
    void openStoreBrowse(dest, userId, {
      knownOpenUrl,
      title,
      returnTo: offersReturnTo,
      navigate,
    })
  }

  const handleGoldback = async (offer: GoldbackOffer) => {
    setBusyId(offer.id)
    setToast(null)
    await goldbackApi.click(userId, offer.id)
    const earn = await goldbackApi.earn(userId, offer.id, goldbackEarnKey(userId, offer.id))
    openBrandOrOffer(offer.url, offer.merchant || offer.title)
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
    const merchantUrl = sanitizeBrowseUrl(offer.url)
    const affiliateUrl = sanitizeBrowseUrl(offer.affiliateUrl)
    // If CueLinks only gave an affiliate redirect, fall back to the brand homepage.
    const brandHome =
      brands.find((b) => b.merchant.toLowerCase() === String(offer.merchant || '').toLowerCase())
        ?.homeUrl || null
    const dest =
      (merchantUrl && !isAffiliateRedirectUrl(merchantUrl) ? merchantUrl : null) ||
      sanitizeBrowseUrl(brandHome) ||
      merchantUrl ||
      affiliateUrl
    if (!dest) {
      setToast('No affiliate link for this offer')
      return
    }
    openBrandOrOffer(dest, offer.merchant || offer.title, affiliateUrl)
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
      if (scene) nextParams.set('scene', scene.id)
      return nextParams
    }, { replace: true })
    setCategory('all')
    setQuery('')
    setDebouncedQuery('')
  }

  const clearScene = () => {
    setSearchParams((prev) => {
      const nextParams = new URLSearchParams(prev)
      nextParams.delete('scene')
      return nextParams
    }, { replace: true })
  }

  const loading =
    (tab === 'goldback' && gbLoading && !offers.length) ||
    (tab === 'marketplace' && mLoading && !marketAll.length)
  const chips = tab === 'goldback' ? gbCategories : ['all', ...marketCats]
  const marketTotal = filteredMarket.length
  const enter = reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }

  return (
    <div className="space-y-6">
      <motion.div
        initial={enter}
        animate={{ opacity: 1, y: 0 }}
        transition={spring}
        className="max-w-xl"
      >
        <h2 className="text-[28px] font-semibold tracking-[-0.035em] text-white leading-none">Offers</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-white/55">
          Live coupons in Marketplace. Goldback deals credit your balance
          {catalogTotal ? ` · ${catalogTotal.toLocaleString('en-IN')} in catalog` : ''}.
        </p>
      </motion.div>

      {scene && scene.brands.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.35rem] border border-white/10 bg-white/[0.06] px-4 py-3 backdrop-blur-xl">
          <div>
            <p className="text-[11px] font-semibold tracking-[-0.01em] text-white">{scene.title}</p>
            <p className="mt-0.5 text-[13px] text-white/55">
              {sceneBrandNames(scene).join(', ')}
              {tab === 'goldback' ? ' · Goldback' : ' · coupons'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {scene.giftTo && (
              <Link
                to={scene.giftTo}
                className="rounded-full bg-white px-3.5 py-2 text-[12px] font-semibold text-black active:scale-[0.97]"
              >
                Gift cards
              </Link>
            )}
            {scene.brands.map((brand) => {
              const href = brand.embedUrl || `https://${brand.domain.replace(/^www\./, '')}`
              return (
                <motion.button
                  key={brand.domain}
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  transition={spring}
                  onClick={() => openBrandOrOffer(href, brand.name)}
                  className="rounded-full bg-white/10 px-3.5 py-2 text-[12px] font-semibold text-white/80"
                >
                  {brand.name}
                </motion.button>
              )
            })}
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              transition={spring}
              onClick={clearScene}
              className="rounded-full bg-white/10 px-3.5 py-2 text-[12px] font-semibold text-white/80"
            >
              Clear
            </motion.button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <div className="inline-flex rounded-full bg-white/[0.08] p-1 backdrop-blur-xl">
          {([
            { id: 'marketplace' as const, label: 'Marketplace', icon: 'bag', count: tab === 'marketplace' ? marketTotal : 0 },
            { id: 'goldback' as const, label: 'Goldback', icon: 'dollar', count: 0 },
          ]).map((item) => {
            const active = tab === item.id
            return (
              <motion.button
                key={item.id}
                type="button"
                onClick={() => switchTab(item.id)}
                whileTap={{ scale: 0.97 }}
                transition={spring}
                className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-semibold tracking-[-0.01em] ${
                  active ? 'bg-white text-black' : 'text-white/55'
                }`}
              >
                <Icon3d name={item.icon} className="h-4 w-4 object-contain" alt="" />
                {item.label}
                {active && item.count > 0 && (
                  <span className="rounded-full bg-black/8 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums">
                    {item.count.toLocaleString('en-IN')}
                  </span>
                )}
              </motion.button>
            )
          })}
        </div>

        {tab === 'marketplace' && (
          <motion.button
            type="button"
            onClick={() => loadMarketplace({ refresh: true })}
            disabled={refreshing}
            whileTap={{ scale: 0.94 }}
            transition={spring}
            aria-label="Refresh offers"
            className="ml-auto flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.08] text-white/70 backdrop-blur-xl disabled:opacity-50"
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
          </motion.button>
        )}
      </div>

      {tab === 'marketplace' && filteredBrands.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3 px-0.5">
            <p className="text-[12px] font-semibold tracking-[-0.01em] text-white/55">
              Brands with offers
            </p>
            <p className="text-[11px] text-white/35">{filteredBrands.length} stores</p>
          </div>
          <div
            className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-none"
            style={{
              maskImage: 'linear-gradient(to right, #000 0%, #000 90%, transparent 100%)',
              WebkitMaskImage: 'linear-gradient(to right, #000 0%, #000 90%, transparent 100%)',
            }}
          >
            {filteredBrands.slice(0, 48).map((brand) => (
              <motion.button
                key={brand.id}
                type="button"
                whileTap={{ scale: 0.96 }}
                transition={spring}
                onClick={() => {
                  if (!brand.homeUrl) return
                  openBrandOrOffer(brand.homeUrl, brand.merchant)
                  setToast(`Opening ${brand.merchant}`)
                }}
                className="flex w-[4.6rem] shrink-0 flex-col items-center gap-1.5"
              >
                <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-[1rem] border border-white/10 bg-white/[0.06]">
                  {brand.imageUrl ? (
                    <img
                      src={brand.imageUrl}
                      alt=""
                      className="h-full w-full object-contain p-1.5"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <Icon3d name="bag" className="h-6 w-6 object-contain opacity-50" alt="" />
                  )}
                </span>
                <span className="w-full truncate text-center text-[11px] font-medium text-white/75">
                  {brand.merchant}
                </span>
              </motion.button>
            ))}
          </div>
        </div>
      )}

      <div className="relative">
        <Search size={15} className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-white/35" />
        <input
          ref={searchRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={tab === 'marketplace' ? 'Search coupons' : 'Search Goldback'}
          className="w-full rounded-2xl border border-white/10 bg-white/[0.06] py-3 pl-11 pr-4 text-[15px] text-white placeholder:text-white/35 backdrop-blur-xl outline-none focus:border-white/25"
        />
      </div>

      <div className="relative">
        <div
          className="flex gap-2 overflow-x-auto pb-1 scrollbar-none"
          style={{
            maskImage: 'linear-gradient(to right, #000 0%, #000 88%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to right, #000 0%, #000 88%, transparent 100%)',
          }}
        >
          {chips.slice(0, 24).map((c) => {
            const active = category === c
            return (
              <motion.button
                key={c}
                type="button"
                whileTap={{ scale: 0.96 }}
                transition={spring}
                onClick={() => setCategory(c)}
                className={`shrink-0 rounded-full px-3.5 py-2 text-[13px] font-medium ${
                  active ? 'bg-white text-black' : 'bg-white/[0.08] text-white/60'
                }`}
              >
                {prettyLabel(c)}
              </motion.button>
            )
          })}
        </div>
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={spring}
            className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] md:bottom-8 left-1/2 z-50 -translate-x-1/2 flex items-center gap-2 rounded-full border border-white/10 bg-black/70 px-4 py-2.5 text-[13px] font-semibold text-white backdrop-blur-2xl"
          >
            <Icon3d name="tick" className="h-4 w-4 object-contain" alt="" />
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <div className="rounded-2xl bg-red-500/10 px-4 py-3 text-[13px] text-red-200">{error}</div>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="animate-spin text-white/50" size={28} />
          <span className="text-[13px] text-white/45">Loading offers</span>
        </div>
      )}

      {!loading && tab === 'goldback' && (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            {visibleGb.map((offer, idx) => {
              const grad = CATEGORY_COLORS[offer.category] || CATEGORY_COLORS.general
              return (
                <motion.article
                  key={offer.id}
                  layout
                  initial={enter}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...spring, delay: reduceMotion ? 0 : Math.min(idx * 0.03, 0.2) }}
                  className="group relative flex flex-col overflow-hidden rounded-[1.5rem] border border-white/[0.08] bg-[#101114]"
                >
                  <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${grad}`} />
                  <div className="relative aspect-[16/9] border-b border-white/[0.06] bg-white/[0.03]">
                    <OfferMedia src={offer.imageUrl} alt={offer.merchant} fallback="tag" />
                  </div>
                  <div className="relative flex flex-1 flex-col gap-3 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="mb-1 text-[12px] font-medium text-white/45">{prettyLabel(offer.category)}</p>
                        <h3 className="text-[17px] font-semibold tracking-[-0.02em] text-white leading-snug">{offer.title}</h3>
                        <p className="mt-1 text-[13px] text-white/50">{offer.merchant}</p>
                      </div>
                      <span className="shrink-0 rounded-full bg-white px-3 py-1.5 text-[12px] font-semibold text-black">
                        {offer.rewardLabel || formatPaise(offer.rewardPaise)}
                      </span>
                    </div>
                    <p className="flex-1 text-[14px] leading-relaxed text-white/55">{offer.description}</p>
                    <motion.button
                      type="button"
                      disabled={busyId === offer.id}
                      onClick={() => handleGoldback(offer)}
                      whileTap={{ scale: 0.97 }}
                      transition={spring}
                      className="mt-1 inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-[13px] font-semibold text-black disabled:opacity-50"
                    >
                      {busyId === offer.id ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />}
                      Shop & earn
                    </motion.button>
                  </div>
                </motion.article>
              )
            })}
            {!filteredGb.length && !error && (
              <div className="rounded-[1.5rem] bg-white/[0.04] px-8 py-16 text-center text-[14px] text-white/45 md:col-span-2">
                No Goldback offers match that filter.
              </div>
            )}
          </div>
          {hasMoreGb && (
            <div className="flex justify-center pt-1">
              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                transition={spring}
                onClick={() => setVisibleCount((n) => n + BATCH_SIZE)}
                className="rounded-full bg-white/[0.08] px-5 py-2.5 text-[13px] font-semibold text-white/80"
              >
                Load more · {filteredGb.length - visibleCount} left
              </motion.button>
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
                initial={enter}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...spring, delay: reduceMotion ? 0 : Math.min(idx * 0.012, 0.16) }}
                className="flex flex-col overflow-hidden rounded-[1.4rem] border border-white/[0.08] bg-[#101114]"
              >
                <div className="relative aspect-[16/9] bg-white/[0.03]">
                  <OfferMedia src={offer.imageUrl} alt={offer.merchant} />
                  {offer.categories[0] && (
                    <span className="absolute left-3 top-3 rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-medium text-white/90 backdrop-blur-xl">
                      {prettyLabel(offer.categories[0])}
                    </span>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-2.5 p-4">
                  <div>
                    <p className="text-[12px] font-medium text-white/45">{offer.merchant}</p>
                    <h3 className="mt-0.5 line-clamp-2 text-[15px] font-semibold tracking-[-0.02em] leading-snug text-white">
                      {offer.title}
                    </h3>
                    {offer.description && (
                      <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-white/45">{offer.description}</p>
                    )}
                  </div>
                  {offer.couponCode && (
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.97 }}
                      transition={spring}
                      onClick={() => copyCode(offer.couponCode!)}
                      className="inline-flex items-center gap-1.5 self-start rounded-full bg-white/8 px-3 py-1.5 text-[12px] font-semibold text-white"
                    >
                      <Copy size={12} /> {offer.couponCode}
                    </motion.button>
                  )}
                  {offer.endDate && (
                    <p className="text-[12px] text-white/35">Ends {offer.endDate}</p>
                  )}
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.97 }}
                    transition={spring}
                    onClick={() => handleMarketplace(offer)}
                    className="mt-auto inline-flex items-center justify-center gap-2 rounded-full bg-white px-4 py-2.5 text-[13px] font-semibold text-black"
                  >
                    <ArrowRight size={14} /> Shop
                  </motion.button>
                </div>
              </motion.article>
            ))}
            {!filteredMarket.length && !error && (
              <div className="rounded-[1.5rem] bg-white/[0.04] px-8 py-16 text-center text-[14px] text-white/45 sm:col-span-2 lg:col-span-3">
                No marketplace offers match that filter.
              </div>
            )}
          </div>
          {hasMoreMarket && (
            <div className="flex justify-center pt-1">
              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                transition={spring}
                onClick={() => setVisibleCount((n) => n + BATCH_SIZE)}
                className="rounded-full bg-white/[0.08] px-5 py-2.5 text-[13px] font-semibold text-white/80"
              >
                Load more · {filteredMarket.length - visibleCount} left
              </motion.button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default OffersPage

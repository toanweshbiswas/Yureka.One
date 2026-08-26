import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Loader2, Search, X, RefreshCw, ExternalLink } from 'lucide-react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useSupabase } from '@shared/SupabaseProvider'
import { getAuthAccessToken } from '@shared/auth'
import { cacheGet, cacheSet, CACHE_TTL } from '@shared/dashboardCache'
import type { GiftCard } from '@backend/lib/hubble/types'
import {
  giftCardAmountAllowed,
  normalizeDenominations,
} from '@backend/lib/hubble/denominations'
import { getExploreScene, matchesSceneBrands, sceneBrandNames } from '@shared/exploreScenes'
import { landingUrl } from '@shared/hosts'
import Icon3d from '@shared/Icon3d'

const formatInr = (n: number) =>
  `₹${n.toLocaleString('en-IN')}`

const prettyCategory = (c: string) =>
  c
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')

function cardAmountLabel(card: GiftCard): string | null {
  if (card.minAmount != null && card.maxAmount != null) {
    return `${formatInr(card.minAmount)} to ${formatInr(card.maxAmount)}`
  }
  const denoms = normalizeDenominations(card.denominations)
  if (!denoms.length) return null
  const shown = denoms.slice(0, 3).map(formatInr).join(', ')
  return denoms.length > 3 ? `${shown}…` : shown
}

function flexiblePresets(min: number | null, max: number | null): number[] {
  const round = [100, 250, 500, 1000, 2000, 5000, 10000]
  const inRange = round.filter((n) => (min == null || n >= min) && (max == null || n <= max))
  const extras = [min, max].filter((n): n is number => n != null && Number.isFinite(n) && !inRange.includes(n))
  return [...inRange, ...extras].sort((a, b) => a - b)
}

function GiftCardImg({
  src,
  alt,
  className,
}: {
  src?: string | null
  alt: string
  className?: string
}) {
  const [broken, setBroken] = useState(false)
  if (!src || broken) {
    return (
      <div className="h-full w-full flex items-center justify-center text-clay/40">
        <Icon3d name="gift" className="h-10 w-10 object-contain" alt="" />
      </div>
    )
  }
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
    />
  )
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void }
  }
}

function loadRazorpayScript(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false)
  if (window.Razorpay) return Promise.resolve(true)
  return new Promise((resolve) => {
    const existing = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]')
    if (existing) {
      if (window.Razorpay) return resolve(true)
      existing.addEventListener('load', () => resolve(true))
      existing.addEventListener('error', () => resolve(false))
      return
    }
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.async = true
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })
}

type GiftCache = { items: GiftCard[]; categories: string[]; total: number }

const giftCacheKey = (category: string, query: string) =>
  `giftcards:catalog:${category}:${query.trim().toLowerCase()}`

const GiftCardsPage: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useSupabase()
  const scene = location.pathname.startsWith('/dashboard/giftcards')
    ? getExploreScene(searchParams.get('scene'))
    : null
  const hasSceneBrands = Boolean(scene && (scene.brands.length || scene.giftNeedles?.length))
  const initialCatalog = cacheGet<GiftCache>(giftCacheKey('all', ''), CACHE_TTL.giftcards)
  const [items, setItems] = useState<GiftCard[]>(() => initialCatalog?.data.items ?? [])
  const [categories, setCategories] = useState<string[]>(() => initialCatalog?.data.categories ?? [])
  const [total, setTotal] = useState(() => initialCatalog?.data.total ?? 0)
  const [loading, setLoading] = useState(() => !initialCatalog?.data)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [selected, setSelected] = useState<GiftCard | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [amount, setAmount] = useState<number | null>(null)
  const [buying, setBuying] = useState(false)
  const [buyError, setBuyError] = useState<string | null>(null)
  const [checkoutEnabled, setCheckoutEnabled] = useState(false)
  const [checkoutMode, setCheckoutMode] = useState<'razorpay' | 'direct_wallet' | 'disabled'>('disabled')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [giftForSomeone, setGiftForSomeone] = useState(false)
  const [recipientName, setRecipientName] = useState('')
  const [recipientEmail, setRecipientEmail] = useState('')
  const [giftMessage, setGiftMessage] = useState('')
  const deepLinkApplied = useRef(false)

  const checkoutProduct = searchParams.get('product')
  const checkoutPrice = (() => {
    const raw = searchParams.get('price')
    if (!raw) return null
    const n = Math.ceil(Number(raw))
    return Number.isFinite(n) && n > 0 ? n : null
  })()

  const userId = user?.id || user?.email || ''
  const apiQuery = hasSceneBrands ? '' : query

  useEffect(() => {
    fetch('/api/giftcards/health')
      .then((r) => r.json())
      .then((json) => {
        const mode = (json?.data?.checkout || 'disabled') as 'razorpay' | 'direct_wallet' | 'disabled'
        setCheckoutMode(mode)
        setCheckoutEnabled(Boolean(json?.data?.checkoutEnabled) && mode !== 'disabled')
      })
      .catch(() => {
        setCheckoutEnabled(false)
        setCheckoutMode('disabled')
      })
  }, [])

  const applyCatalog = useCallback((payload: GiftCache) => {
    setItems(payload.items)
    setCategories(payload.categories)
    setTotal(payload.total)
  }, [])

  const load = useCallback(async (opts?: { refresh?: boolean }) => {
    const key = giftCacheKey(category, apiQuery)
    if (!opts?.refresh) {
      const hit = cacheGet<GiftCache>(key, CACHE_TTL.giftcards)
      if (hit) {
        applyCatalog(hit.data)
        setLoading(false)
        if (!hit.stale) return
      }
    }

    if (opts?.refresh) setRefreshing(true)
    else if (items.length === 0) setLoading(true)
    setError(null)
    try {
      // Catalog load only. force Hubble refresh is admin-gated at POST /api/giftcards/refresh
      const params = new URLSearchParams({ status: 'ACTIVE' })
      if (category !== 'all') params.set('category', category)
      if (apiQuery.trim()) params.set('q', apiQuery.trim())
      const res = await fetch(`/api/giftcards?${params}`)
      const json = await res.json()
      if (!res.ok || json.error) throw new Error(json.error || 'Failed to load gift cards')
      const payload: GiftCache = {
        items: json.data.items || [],
        categories: json.data.categories || [],
        total: json.data.total || 0,
      }
      applyCatalog(payload)
      cacheSet(key, payload)
    } catch (e: any) {
      setError(e?.message || 'Could not load gift cards')
      if (!items.length) setItems([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [category, apiQuery, applyCatalog, items.length])

  useEffect(() => {
    const t = setTimeout(() => load(), apiQuery ? 280 : 0)
    return () => clearTimeout(t)
  }, [load, apiQuery])

  useEffect(() => {
    if (scene?.id) setCategory('all')
  }, [scene?.id])

  useEffect(() => {
    const buyId = searchParams.get('buy')
    if (!buyId || !items.length || deepLinkApplied.current) return
    const card = items.find((c) => c.id === buyId)
    if (!card) return
    deepLinkApplied.current = true
    setSelected(card)
  }, [items, searchParams])

  const visibleItems = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter((card) => {
      if (!matchesSceneBrands(`${card.brand} ${card.title} ${card.description} ${card.categories.join(' ')}`, scene)) {
        return false
      }
      if (!hasSceneBrands || !q) return true
      return `${card.title} ${card.brand} ${card.description}`.toLowerCase().includes(q)
    })
  }, [items, scene, query, hasSceneBrands])

  useEffect(() => {
    if (!selected) {
      setAmount(null)
      setBuyError(null)
      setGiftForSomeone(false)
      setRecipientName('')
      setRecipientEmail('')
      setGiftMessage('')
      return
    }

    const prefilled = searchParams.get('amount')
    if (prefilled) {
      const n = Math.ceil(Number(prefilled))
      if (Number.isFinite(n) && giftCardAmountAllowed(selected, n).ok) {
        setAmount(n)
        setBuyError(null)
        setCustomerName(
          String(user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || ''),
        )
        const existingPhone = String(user?.user_metadata?.phone || user?.phone || '').replace(/\D/g, '')
        setCustomerPhone(existingPhone.slice(-10))
        return
      }
    }

    const denoms = normalizeDenominations(selected.denominations)
    if (selected.minAmount != null) {
      setAmount(selected.minAmount)
    } else if (denoms.length) {
      setAmount(denoms[0])
    } else {
      setAmount(null)
    }
    setBuyError(null)
    setCustomerName(
      String(user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || ''),
    )
    const existingPhone = String(user?.user_metadata?.phone || user?.phone || '').replace(/\D/g, '')
    setCustomerPhone(existingPhone.slice(-10))
  }, [selected, user, searchParams])

  const chips = useMemo(() => ['all', ...categories], [categories])

  const selectedDenoms = selected ? normalizeDenominations(selected.denominations) : []
  const amountChips =
    selectedDenoms.length > 0
      ? selectedDenoms
      : selected
        ? flexiblePresets(selected.minAmount, selected.maxAmount)
        : []
  const amountAllowed = Boolean(selected && amount != null && giftCardAmountAllowed(selected, amount).ok)

  const phoneDigits = customerPhone.replace(/\D/g, '').slice(-10)
  const recipientEmailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail.trim())
  const canBuy =
    checkoutEnabled &&
    !!selected &&
    amount != null &&
    amountAllowed &&
    customerName.trim().length >= 2 &&
    phoneDigits.length === 10 &&
    (!giftForSomeone || (recipientName.trim().length >= 2 && recipientEmailOk)) &&
    !buying

  const placeOrder = async () => {
    if (!checkoutEnabled) {
      setBuyError('Gift card checkout is currently disabled.')
      return
    }
    if (!selected || amount == null) return
    if (phoneDigits.length !== 10) {
      setBuyError('Enter a valid 10-digit mobile number.')
      return
    }
    if (giftForSomeone) {
      if (recipientName.trim().length < 2) {
        setBuyError('Enter the recipient’s name.')
        return
      }
      if (!recipientEmailOk) {
        setBuyError('Enter a valid recipient email.')
        return
      }
    }
    setBuying(true)
    setBuyError(null)
    const token = getAuthAccessToken()
    const headers = {
      'Content-Type': 'application/json',
      'x-user-id': userId,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }
    const payload = {
      productId: selected.id,
      denomination: amount,
      quantity: 1,
      customerName: customerName.trim(),
      customerEmail: user?.email || 'noreply@yureka.one',
      customerPhone: phoneDigits,
      isGift: giftForSomeone,
      ...(giftForSomeone
        ? {
            recipientName: recipientName.trim(),
            recipientEmail: recipientEmail.trim().toLowerCase(),
            giftMessage: giftMessage.trim() || undefined,
          }
        : {}),
    }

    const parseJson = async (res: Response) => {
      const text = await res.text()
      let json: any = {}
      try {
        json = text ? JSON.parse(text) : {}
      } catch {
        throw new Error(
          res.status === 401
            ? 'Please sign in again to buy gift cards'
            : `Could not place order (server ${res.status}). Try again in a moment.`,
        )
      }
      if (!res.ok || json.error) throw new Error(json.error || 'Order failed')
      return json
    }

    try {
      if (checkoutMode === 'razorpay') {
        const ready = await loadRazorpayScript()
        if (!ready || !window.Razorpay) {
          throw new Error('Could not load Razorpay checkout. Check your connection and try again.')
        }
        const json = await parseJson(
          await fetch('/api/giftcards/checkout', {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
          }),
        )
        const data = json.data || {}
        await new Promise<void>((resolve, reject) => {
          const rzp = new window.Razorpay!({
            key: data.keyId,
            amount: data.amountPaise,
            currency: data.currency || 'INR',
            name: 'Yureka One',
            description: data.productTitle || selected.title,
            order_id: data.razorpayOrderId,
            prefill: data.prefill || {
              name: customerName.trim(),
              email: user?.email || '',
              contact: phoneDigits,
            },
            theme: { color: '#34d399' },
            handler: async (response: {
              razorpay_payment_id: string
              razorpay_order_id: string
              razorpay_signature: string
            }) => {
              try {
                const verified = await parseJson(
                  await fetch('/api/giftcards/checkout/verify', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                      orderId: data.orderId,
                      razorpay_payment_id: response.razorpay_payment_id,
                      razorpay_order_id: response.razorpay_order_id,
                      razorpay_signature: response.razorpay_signature,
                    }),
                  }),
                )
                const statusUrl =
                  verified.data?.statusUrl || `/dashboard/giftcards/orders/${verified.data?.order?.id || data.orderId}`
                resolve()
                navigate(statusUrl)
              } catch (err: any) {
                reject(err)
              }
            },
            modal: {
              ondismiss: () => reject(new Error('Payment cancelled')),
            },
          })
          rzp.open()
        })
        return
      }

      const json = await parseJson(
        await fetch('/api/giftcards/orders', {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        }),
      )
      const statusUrl = json.data?.statusUrl || `/dashboard/giftcards/orders/${json.data?.order?.id}`
      navigate(statusUrl)
    } catch (e: any) {
      const msg = String(e?.message || 'Could not place order')
      if (msg === 'Payment cancelled') {
        setBuyError('Payment was cancelled. No charge was made.')
      } else {
        setBuyError(
          msg.includes('DOCTYPE') || msg.includes('Unexpected token')
            ? 'Could not place order. the payment service returned an unexpected response. Please try again.'
            : msg,
        )
      }
    } finally {
      setBuying(false)
    }
  }

  if (loading && !items.length) {
    return (
      <div className="flex flex-col items-center justify-center py-28 gap-4">
        <Loader2 className="animate-spin text-clay" size={36} />
        <span className="text-[11px] font-black uppercase tracking-[0.35em] text-white/35">
          Loading gift cards
        </span>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <h2 className="text-2xl font-black tracking-tight text-white mb-2">Gift cards</h2>
          <p className="text-white/45 text-[15px] leading-relaxed">
            {(hasSceneBrands ? visibleItems.length : total).toLocaleString('en-IN')} active brands. pay first, then the gift card code is issued.
          </p>
        </div>
        <button
          type="button"
          onClick={() => load({ refresh: true })}
          disabled={refreshing}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] text-white/45 hover:text-white transition disabled:opacity-50"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </motion.div>

      {scene && (scene.brands.length > 0 || (scene.giftNeedles && scene.giftNeedles.length > 0)) && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#6d5cff]/30 bg-[#6d5cff]/10 px-4 py-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#c8c0ff]">{scene.title}</p>
            <p className="mt-1 text-sm text-white/80">Gift cards for {sceneBrandNames(scene).join(', ')}.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to={scene.to}
              className="rounded-full bg-white px-3.5 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-black"
            >
              Marketplace coupons
            </Link>
            <button
              type="button"
              onClick={() => {
                setSearchParams((prev) => {
                  const next = new URLSearchParams(prev)
                  next.delete('scene')
                  return next
                }, { replace: true })
              }}
              className="rounded-full border border-white/15 px-3.5 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-white/70"
            >
              Clear filter
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search brands…"
            className="w-full rounded-2xl border border-white/10 bg-white/[0.03] pl-11 pr-4 py-3.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-clay/40 focus:ring-1 focus:ring-clay/20 transition"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {chips.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`shrink-0 rounded-xl px-3.5 py-2.5 text-[10px] font-black uppercase tracking-[0.18em] transition ${
                category === c
                  ? 'bg-clay text-black shadow-[0_0_24px_rgba(52,211,153,0.25)]'
                  : 'bg-white/[0.04] text-white/40 border border-white/10 hover:text-white'
              }`}
            >
              {c === 'all' ? 'All' : prettyCategory(c)}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-500/25 bg-red-500/10 px-5 py-3 text-sm text-red-200">{error}</div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visibleItems.map((card, idx) => (
          <motion.button
            key={card.id}
            type="button"
            layout
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(idx * 0.02, 0.3) }}
            onClick={() => setSelected(card)}
            className="group text-left rounded-[1.5rem] border border-white/[0.08] bg-[#0d0d0d] overflow-hidden hover:border-white/20 transition"
          >
            <div className="aspect-[16/10] bg-white/[0.03] relative overflow-hidden">
              <GiftCardImg
                src={card.imageUrl || card.logoUrl}
                alt={card.title}
                className="h-full w-full object-cover group-hover:scale-[1.03] transition duration-500"
              />
              {card.categories[0] && (
                <span className="absolute left-3 top-3 rounded-lg bg-black/70 backdrop-blur px-2 py-1 text-[9px] font-black uppercase tracking-widest text-white/80">
                  {prettyCategory(card.categories[0])}
                </span>
              )}
            </div>
            <div className="p-4 space-y-2">
              <div className="flex items-start gap-3">
                {card.logoUrl && (
                  <img src={card.logoUrl} alt="" className="h-9 w-9 rounded-xl object-cover bg-white/5 shrink-0" />
                )}
                <div className="min-w-0">
                  <h3 className="font-bold text-white tracking-tight truncate">{card.title}</h3>
                  <p className="text-[11px] text-white/35 mt-0.5 truncate">
                    {card.redemptionType.replace(/_/g, ' ').toLowerCase()}
                    {cardAmountLabel(card) ? <> · {cardAmountLabel(card)}</> : null}
                  </p>
                </div>
              </div>
            </div>
          </motion.button>
        ))}
      </div>

      {!visibleItems.length && !error && (
        <div className="rounded-[1.75rem] border border-white/10 px-8 py-16 text-center text-white/40 text-sm">
          No gift cards match that filter.
        </div>
      )}

      <AnimatePresence>
        {selected && (
          <>
            <motion.button
              type="button"
              aria-label="Close"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
              onClick={() => setSelected(null)}
            />
            <motion.aside
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 40 }}
              className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md border-l border-white/10 bg-[#0a0a0a] overflow-y-auto dashboard-scroll shadow-2xl"
            >
              <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-white/10 bg-[#0a0a0a]/95 backdrop-blur px-5 py-4">
                <p className="font-black tracking-tight truncate">{selected.title}</p>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="rounded-xl p-2 text-white/40 hover:text-white hover:bg-white/5"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="p-5 space-y-6">
                {selected.imageUrl && (
                  <GiftCardImg
                    src={selected.imageUrl}
                    alt={selected.title}
                    className="w-full rounded-2xl object-cover aspect-video bg-white/5"
                  />
                )}
                {selected.description && (
                  <p className="text-white/55 text-sm leading-relaxed">{selected.description}</p>
                )}
                {(checkoutProduct || checkoutPrice != null) && (
                  <div className="rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 space-y-1.5">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300/80">
                      Checkout helper
                    </p>
                    {checkoutPrice != null && (
                      <p className="text-sm text-white/85">
                        Product price detected: <span className="font-semibold text-white">{formatInr(checkoutPrice)}</span>
                      </p>
                    )}
                    <p className="text-xs text-white/55 leading-relaxed">
                      Buy this gift card, redeem it on the store, then complete your purchase with the balance.
                    </p>
                    {checkoutProduct && (
                      <a
                        href={checkoutProduct}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-300 hover:text-emerald-200"
                      >
                        View product <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  {selected.categories.map((c) => (
                    <span key={c} className="rounded-lg border border-white/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-white/45">
                      {prettyCategory(c)}
                    </span>
                  ))}
                </div>

                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-white/35 mb-2">Amount</p>
                  <div className="space-y-2">
                    {amountChips.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {amountChips.map((d) => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => setAmount(d)}
                            className={`rounded-xl px-3 py-2 text-xs font-bold tabular-nums border transition ${
                              amount === d
                                ? 'bg-clay/20 border-clay/40 text-clay'
                                : 'bg-white/[0.03] border-white/10 text-white/55 hover:text-white'
                            }`}
                          >
                            {formatInr(d)}
                          </button>
                        ))}
                      </div>
                    )}
                    <input
                      type="number"
                      min={selected.minAmount ?? 1}
                      max={selected.maxAmount ?? undefined}
                      step={1}
                      value={amount ?? ''}
                      onChange={(e) => {
                        const raw = e.target.value
                        if (raw === '') {
                          setAmount(null)
                          return
                        }
                        const n = Number(raw)
                        setAmount(Number.isFinite(n) ? n : null)
                      }}
                      className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white focus:outline-none focus:border-clay/40"
                      placeholder="Enter a custom amount"
                    />
                    <p className="text-[11px] text-white/35">
                      {selected.minAmount != null && selected.maxAmount != null
                        ? `Pick a value or enter any amount from ${formatInr(selected.minAmount)} to ${formatInr(selected.maxAmount)}`
                        : 'Pick a value or enter a custom amount'}
                    </p>
                  </div>
                </div>

                {!!selected.redeemSites?.length && (
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.25em] text-white/35 mb-2">Redeem at</p>
                    <div className="flex flex-col gap-2">
                      {selected.redeemSites.map((site) => (
                        <a
                          key={site.url}
                          href={site.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 text-clay text-sm font-bold hover:underline break-all"
                        >
                          {site.label} <ExternalLink size={14} className="shrink-0" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
                {!!selected.howToUse.length && (
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.25em] text-white/35 mb-2">How to use</p>
                    <ol className="space-y-2 text-sm text-white/50 list-decimal list-inside">
                      {selected.howToUse.slice(0, 6).map((step, i) => (
                        <li key={i}>{step}</li>
                      ))}
                    </ol>
                  </div>
                )}
                <a
                  href={landingUrl('/terms-of-service')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-clay text-sm font-bold hover:underline"
                >
                  Terms & conditions <ExternalLink size={14} />
                </a>

                <div className="space-y-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.25em] text-white/35 mb-2">Your name</p>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white focus:outline-none focus:border-clay/40"
                      placeholder="Name on the receipt"
                      autoComplete="name"
                    />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.25em] text-white/35 mb-2">Mobile number</p>
                    <input
                      type="tel"
                      inputMode="numeric"
                      maxLength={10}
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white focus:outline-none focus:border-clay/40"
                      placeholder="10-digit mobile"
                      autoComplete="tel"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => setGiftForSomeone((v) => !v)}
                    className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition active:scale-[0.99] ${
                      giftForSomeone
                        ? 'border-clay/40 bg-clay/10'
                        : 'border-white/10 bg-white/[0.03]'
                    }`}
                  >
                    <div>
                      <p className="text-[13px] font-semibold tracking-[-0.02em] text-white">Gift someone</p>
                      <p className="mt-0.5 text-[11px] text-white/45">
                        We’ll email the voucher codes to them
                      </p>
                    </div>
                    <span
                      className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                        giftForSomeone ? 'bg-clay' : 'bg-white/15'
                      }`}
                      aria-hidden
                    >
                      <span
                        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
                          giftForSomeone ? 'left-[1.375rem]' : 'left-0.5'
                        }`}
                      />
                    </span>
                  </button>

                  {giftForSomeone && (
                    <div className="space-y-3 rounded-xl border border-clay/20 bg-clay/[0.06] p-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-white/35 mb-2">
                          Recipient name
                        </p>
                        <input
                          type="text"
                          value={recipientName}
                          onChange={(e) => setRecipientName(e.target.value)}
                          className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white focus:outline-none focus:border-clay/40"
                          placeholder="Who is this for?"
                          autoComplete="off"
                        />
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-white/35 mb-2">
                          Recipient email
                        </p>
                        <input
                          type="email"
                          value={recipientEmail}
                          onChange={(e) => setRecipientEmail(e.target.value)}
                          className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white focus:outline-none focus:border-clay/40"
                          placeholder="friend@email.com"
                          autoComplete="off"
                        />
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-white/35 mb-2">
                          Message <span className="normal-case tracking-normal text-white/25">(optional)</span>
                        </p>
                        <textarea
                          value={giftMessage}
                          onChange={(e) => setGiftMessage(e.target.value.slice(0, 280))}
                          rows={3}
                          className="w-full resize-none rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white focus:outline-none focus:border-clay/40"
                          placeholder="Happy birthday. enjoy this on me"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {buyError && (
                  <div className="rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                    {buyError}
                  </div>
                )}

                {!checkoutEnabled && (
                  <div className="rounded-xl border border-amber-400/25 bg-amber-400/10 px-3 py-2.5 text-xs text-amber-100/90 leading-relaxed">
                    Gift card checkout is temporarily disabled.
                  </div>
                )}

                <button
                  type="button"
                  disabled={!canBuy}
                  onClick={() => void placeOrder()}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-clay text-black font-black uppercase tracking-[0.18em] text-[11px] py-3.5 disabled:opacity-40 hover:brightness-110 transition active:scale-[0.98]"
                >
                  {buying ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />{' '}
                      {checkoutMode === 'razorpay' ? 'Opening payment…' : 'Placing order…'}
                    </>
                  ) : giftForSomeone ? (
                    <>Gift {amount != null ? formatInr(amount) : ''}</>
                  ) : (
                    <>Pay {amount != null ? formatInr(amount) : ''}</>
                  )}
                </button>
                <p className="text-[11px] text-white/30 leading-relaxed">
                  {giftForSomeone
                    ? 'You pay on Razorpay first. After payment succeeds, we email the voucher codes to your recipient and confirm to you.'
                    : 'You pay on Razorpay first. After the payment succeeds, the gift card code appears on the next page.'}
                </p>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

export default GiftCardsPage

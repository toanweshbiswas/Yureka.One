import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  ArrowRight,
  Loader2,
  RefreshCw,
  Search,
  TrendingUp,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useSupabase } from '@shared/SupabaseProvider'
import { formatPaise, goldbackApi } from '@backend/lib/goldback/client'
import type { GoldbackBalance, GoldbackLedgerEntry, GoldbackOffer } from '@backend/lib/goldback/types'
import { cacheGet, cacheSet, CACHE_TTL, getLastAuthEmail } from '@shared/dashboardCache'
import { onGoldbackUpdated } from '@shared/goldbackEvents'
import { api, isApiError } from '@backend/lib/api/client'
import type { Waitlist as ApiWaitlist } from '@backend/lib/api/types'
import ExploreBrandScenes from './ExploreBrandScenes'
import Icon3d from '@shared/Icon3d'
import YurekaBrandMark from '@shared/YurekaBrandMark'
// import { SuperBrowseGrid } from './SuperBrowse'

type HomeCache = {
  balance: GoldbackBalance | null
  ledger: GoldbackLedgerEntry[]
  offers: GoldbackOffer[]
  yurekaScore: number | null
  scoreDecision: string | null
}

const cacheKey = (userId: string) => `goldback:home:${userId}`

const QUICK_ACTIONS = [
  { label: 'Offers', icon: 'bag', path: '/dashboard/offers?tab=marketplace' },
  { label: 'Expenses', icon: 'chart', path: '/dashboard/expenses' },
  { label: 'Planning', icon: 'calender', path: '/dashboard/planning' },
  { label: 'Bills', icon: 'wallet', path: '/dashboard/bills' },
  { label: 'Gift cards', icon: 'gift', path: '/dashboard/giftcards' },
  { label: 'Referrals', icon: 'heart', path: '/dashboard/referrals' },
  { label: 'Profile', icon: 'boy', path: '/dashboard/profile' },
] as const

function firstName(user: ReturnType<typeof useSupabase>['user']) {
  const full =
    String(user?.user_metadata?.full_name || user?.user_metadata?.name || '').trim() ||
    String(user?.email || '').split('@')[0]
  return full ? full.split(/\s+/)[0] : 'there'
}

const GoldbackHome: React.FC = () => {
  const { user } = useSupabase()
  const userId = user?.id || user?.email || getLastAuthEmail() || ''
  const cached = userId ? cacheGet<HomeCache>(cacheKey(userId), CACHE_TTL.goldbackHome) : null
  const [balance, setBalance] = useState<GoldbackBalance | null>(cached?.data.balance ?? null)
  const [ledger, setLedger] = useState<GoldbackLedgerEntry[]>(cached?.data.ledger ?? [])
  const [offers, setOffers] = useState<GoldbackOffer[]>(cached?.data.offers ?? [])
  const [yurekaScore, setYurekaScore] = useState<number | null>(cached?.data.yurekaScore ?? null)
  const [scoreDecision, setScoreDecision] = useState<string | null>(cached?.data.scoreDecision ?? null)
  const [loading, setLoading] = useState(!cached?.data)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!userId) {
      setError('Sign in required')
      setLoading(false)
      return
    }
    if (!opts?.silent && !balance && ledger.length === 0) setLoading(true)
    setError(null)
    const [b, l, o, waitlist] = await Promise.all([
      goldbackApi.balance(userId),
      goldbackApi.ledger(userId),
      goldbackApi.offers(userId),
      user?.email
        ? api.get<ApiWaitlist>(`/api/v1/waitlist/entry?email=${encodeURIComponent(user.email)}`)
        : Promise.resolve(null),
    ])
    const nextBalance = !b.error && b.data ? b.data : null
    const nextLedger = !l.error && l.data ? l.data : []
    const nextOffers = !o.error && o.data ? o.data.filter((item) => item.active !== false) : []
    let nextScore: number | null = null
    let nextDecision: string | null = null
    if (waitlist && !isApiError(waitlist) && waitlist.data) {
      nextScore = waitlist.data.yurekaScore ?? null
      nextDecision = waitlist.data.scoreDecision ?? null
      setYurekaScore(nextScore)
      setScoreDecision(nextDecision)
    }
    if (b.error || !b.data) {
      if (!opts?.silent) setError(b.error || 'Could not load balance')
    } else {
      setBalance(b.data)
    }
    if (!l.error && l.data) setLedger(l.data)
    if (!o.error && o.data) setOffers(nextOffers)
    if (nextBalance) {
      cacheSet(cacheKey(userId), {
        balance: nextBalance,
        ledger: nextLedger,
        offers: nextOffers,
        yurekaScore: nextScore,
        scoreDecision: nextDecision,
      })
    }
    setLoading(false)
  }, [userId, user?.email, balance, ledger.length])

  useEffect(() => {
    if (!userId) return
    const hit = cacheGet<HomeCache>(cacheKey(userId), CACHE_TTL.goldbackHome)
    if (hit) {
      setBalance(hit.data.balance)
      setLedger(hit.data.ledger)
      setOffers(hit.data.offers ?? [])
      setYurekaScore(hit.data.yurekaScore ?? null)
      setScoreDecision(hit.data.scoreDecision ?? null)
      setLoading(false)
      if (hit.stale) void load({ silent: true })
      return
    }
    void load()
  }, [userId, load])

  useEffect(() => {
    return onGoldbackUpdated((detail) => {
      if (detail.balancePaise != null) {
        setBalance((prev) => ({
          userId: detail.userId || prev?.userId || userId,
          balancePaise: detail.balancePaise!,
          updatedAt: new Date().toISOString(),
        }))
      }
      void load({ silent: true })
    })
  }, [load, userId])

  useEffect(() => {
    const onScore = (event: Event) => {
      const detail = (event as CustomEvent).detail || {}
      const next = Number(detail.score)
      if (!Number.isFinite(next)) return
      setYurekaScore(next)
      setScoreDecision(typeof detail.decision === 'string' ? detail.decision : null)
      if (userId) {
        const hit = cacheGet<HomeCache>(cacheKey(userId), CACHE_TTL.goldbackHome)
        cacheSet(cacheKey(userId), {
          balance: hit?.data.balance ?? balance,
          ledger: hit?.data.ledger ?? ledger,
          offers: hit?.data.offers ?? offers,
          yurekaScore: next,
          scoreDecision: typeof detail.decision === 'string' ? detail.decision : null,
        })
      }
    }
    window.addEventListener('yureka-score-updated', onScore)
    return () => window.removeEventListener('yureka-score-updated', onScore)
  }, [userId, balance, ledger, offers])

  const earnedToday = useMemo(() => {
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    return ledger
      .filter((e) => e.status === 'earned' && new Date(e.createdAt) >= start)
      .reduce((sum, e) => sum + e.amountPaise, 0)
  }, [ledger])

  const topCategories = useMemo(() => {
    const ranked = new Map<string, number>()
    for (const offer of offers) {
      const key = String(offer.category || 'marketplace').trim() || 'marketplace'
      ranked.set(key, (ranked.get(key) || 0) + 1)
    }
    return [...ranked.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([key]) => key)
  }, [offers])

  const greetingName = firstName(user)
  const balancePaise = balance?.balancePaise ?? 0

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-28 gap-4">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-clay/30 blur-xl animate-pulse" />
          <Loader2 className="relative animate-spin text-clay" size={36} />
        </div>
        <span className="text-[11px] font-black uppercase tracking-[0.35em] text-white/35">Loading home</span>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-2xl border border-red-500/25 bg-red-500/10 px-5 py-4 text-sm text-red-200"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', bounce: 0, duration: 0.45 }}
        className="relative overflow-hidden rounded-[2rem] border border-white/[0.08] bg-[#0b0d0c] text-white"
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at top left, rgba(52,211,153,0.18), transparent 28%), radial-gradient(circle at bottom right, rgba(255,255,255,0.05), transparent 28%)',
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
        <div className="relative p-5 sm:p-6 space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] shadow-[0_8px_24px_rgba(0,0,0,0.28)] backdrop-blur-xl overflow-hidden">
                <YurekaBrandMark className="h-12 w-12 rounded-2xl object-cover" />
              </div>
              <div className="min-w-0">
                <p className="text-sm text-white/48">Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}</p>
                <h1 className="text-[clamp(1.5rem,4vw,2.2rem)] font-black tracking-[-0.04em] leading-none truncate">
                  {greetingName}
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => void load()}
                className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-white/60 backdrop-blur-xl transition hover:text-white active:scale-[0.98]"
                aria-label="Refresh home"
              >
                <RefreshCw size={18} />
              </button>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] backdrop-blur-xl">
                <Icon3d name="megaphone" className="h-6 w-6 object-contain" alt="" />
              </div>
            </div>
          </div>

          <Link
            to="/dashboard/offers?tab=marketplace"
            className="group flex items-center gap-3 rounded-2xl bg-[#101114] px-4 py-3 text-white transition hover:bg-black"
          >
            <Search size={17} className="text-white/45" />
            <span className="flex-1 text-sm text-white/40">Search across all stores</span>
            <ArrowRight size={16} className="text-white/35 transition-transform group-hover:translate-x-0.5" />
          </Link>

          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-white/40 mb-3">Everything that matters to you</p>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-[1.6rem] border border-clay/20 bg-[linear-gradient(135deg,rgba(52,211,153,0.18)_0%,rgba(52,211,153,0.08)_60%,rgba(255,255,255,0.03)_100%)] p-4 shadow-[0_18px_40px_rgba(0,0,0,0.24)]">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-clay/75">Savings in Gold</p>
                <p className="mt-2 text-3xl font-black tracking-[-0.04em] text-white">{formatPaise(balancePaise)}</p>
                <p className="mt-1 text-xs text-white/60">Live balance redeemable at face value</p>
                <div className="mt-4 flex items-center justify-between gap-2">
                  <Link
                    to="/dashboard/offers?tab=marketplace"
                    className="inline-flex items-center gap-2 rounded-full bg-clay px-4 py-2 text-[11px] font-black uppercase tracking-[0.12em] text-black"
                  >
                    Explore offers
                  </Link>
                  <span className="text-[11px] font-semibold text-white/58">Earned today {formatPaise(earnedToday)}</span>
                </div>
              </div>

              <div className="rounded-[1.6rem] border border-white/10 bg-[linear-gradient(135deg,#111614_0%,#0c2119_100%)] p-4 text-white shadow-[0_18px_40px_rgba(0,0,0,0.28)]">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-clay/70">Yureka score</p>
                {yurekaScore != null ? (
                  <>
                    <p className="mt-2 text-3xl font-black tracking-[-0.04em]">
                      {yurekaScore}
                      <span className="text-lg text-white/40">/100</span>
                    </p>
                    <p className="mt-1 text-xs text-white/65 capitalize">
                      {scoreDecision || 'Updated after inbox analysis'}
                    </p>
                  </>
                ) : (
                  <p className="mt-3 text-sm text-white/60 max-w-xs">Complete inbox analysis to unlock your personalised Yureka Score.</p>
                )}
                <div className="mt-4 flex items-center justify-between gap-2">
                  <Link
                    to="/dashboard/expenses"
                    className="inline-flex items-center gap-2 rounded-full bg-clay px-4 py-2 text-[11px] font-black uppercase tracking-[0.12em] text-black"
                  >
                    View expenses
                  </Link>
                  <span className="text-[11px] font-semibold text-white/55">{ledger.length} earn events</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <div className="space-y-3">
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-white/40">For you</p>
              <div className="grid gap-3">
                {[
                  {
                    title: topCategories[0] || 'Marketplace deals',
                    subtitle: 'Quick commerce, shopping, and brand rewards',
                    path: '/dashboard/offers?tab=marketplace',
                  },
                  {
                    title: topCategories[1] || 'Spend analysis',
                    subtitle: 'Travel, cabs, subscriptions, and utility insight',
                    path: '/dashboard/expenses',
                  },
                ].map((item, index) => (
                  <Link
                    key={item.title}
                    to={item.path}
                    className={`group rounded-[1.35rem] border px-4 py-4 transition hover:border-clay/30 ${
                      index === 0
                        ? 'border-clay/20 bg-[linear-gradient(135deg,rgba(52,211,153,0.18)_0%,rgba(52,211,153,0.08)_100%)]'
                        : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.06]'
                    }`}
                  >
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/38">For you</p>
                    <div className="mt-1 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-lg font-black tracking-[-0.03em] capitalize text-white">{item.title}</p>
                        <p className="mt-1 text-xs text-white/55">{item.subtitle}</p>
                      </div>
                      <ArrowRight size={18} className="shrink-0 text-white/45 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-white/40">Quick actions</p>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-4">
                {QUICK_ACTIONS.map((item) => (
                  <Link
                    key={item.label}
                    to={item.path}
                    className="group rounded-[1.35rem] border border-white/10 bg-white/[0.05] p-3 text-center shadow-[0_8px_20px_rgba(0,0,0,0.18)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-clay/25"
                  >
                    <div className="mx-auto flex h-14 w-14 items-center justify-center">
                      <Icon3d name={item.icon} className="h-12 w-12 object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.35)] transition group-hover:scale-[1.06]" />
                    </div>
                    <p className="mt-2 text-[10px] font-black uppercase tracking-[0.12em] text-white/68">{item.label}</p>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-white/40">Explore offers</p>
                <p className="text-xs text-white/50 mt-1">Coupons, gift cards, and partner brands by category.</p>
              </div>
              <Link
                to="/dashboard/offers?tab=marketplace"
                className="hidden sm:inline-flex items-center gap-2 rounded-full bg-[#10372c] px-4 py-2 text-[11px] font-black uppercase tracking-[0.12em] text-white"
              >
                See all <ArrowRight size={14} />
              </Link>
            </div>
            <ExploreBrandScenes />
          </div>

          {/* Super Browse paused — keep the module, hide it from Home for now.
          <div className="space-y-3">
            <SuperBrowseGrid showChrome={false} />
          </div>
          */}
        </div>
      </motion.section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-[11px] font-black uppercase tracking-[0.22em] text-white/70">Recent activity</h3>
            <p className="text-white/30 text-xs mt-1">Latest Goldback credits and tracked earn events.</p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[10px] font-black uppercase tracking-[0.25em] text-white/40 hover:text-clay hover:border-clay/30 transition active:scale-[0.97]"
          >
            <RefreshCw size={12} /> Refresh
          </button>
        </div>

        {ledger.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-[1.75rem] border border-dashed border-white/15 bg-gradient-to-b from-white/[0.04] to-transparent px-8 py-16 text-center"
          >
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-clay/10 border border-clay/20 overflow-hidden">
              <YurekaBrandMark className="h-16 w-16 rounded-3xl object-cover" />
            </div>
            <p className="text-white font-bold text-lg mb-2">Your vault is empty</p>
            <p className="text-white/45 text-sm mb-8 max-w-sm mx-auto leading-relaxed">
              Open a tracked offer, shop the deal, and Goldback lands here at face value.
            </p>
            <Link
              to="/dashboard/offers?tab=marketplace"
              className="inline-flex items-center gap-2 text-clay text-xs font-black uppercase tracking-[0.25em] hover:brightness-125"
            >
              Browse offers <ArrowRight size={14} />
            </Link>
          </motion.div>
        ) : (
          <ul className="space-y-2.5">
            {ledger.slice(0, 6).map((entry, idx) => (
              <motion.li
                key={entry.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(idx * 0.04, 0.25) }}
                className="group flex items-center justify-between gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/10 px-5 py-4 transition"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-clay/10 border border-clay/20 text-clay group-hover:scale-105 transition">
                    <TrendingUp size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-white font-bold truncate">
                      {String(entry.meta?.title || entry.meta?.merchant || entry.type)}
                    </p>
                    <p className="text-[10px] uppercase tracking-[0.22em] text-white/30 mt-1">
                      <span className="text-clay/80">{entry.status}</span>
                      {' · '}
                      {new Date(entry.createdAt).toLocaleString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
                <div className="text-clay font-black text-lg tabular-nums shrink-0">
                  +{formatPaise(entry.amountPaise)}
                </div>
              </motion.li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

export default GoldbackHome

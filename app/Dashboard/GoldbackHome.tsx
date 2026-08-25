import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import {
  ArrowRight,
  Loader2,
  RefreshCw,
  Search,
  TrendingUp,
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useSupabase } from '@shared/SupabaseProvider'
import { formatPaise, goldbackApi } from '@backend/lib/goldback/client'
import type { GoldbackBalance, GoldbackLedgerEntry, GoldbackOffer } from '@backend/lib/goldback/types'
import { cacheGet, cacheSet, CACHE_TTL, getLastAuthEmail } from '@shared/dashboardCache'
import { onGoldbackUpdated } from '@shared/goldbackEvents'
import { api, isApiError } from '@backend/lib/api/client'
import type { Waitlist as ApiWaitlist } from '@backend/lib/api/types'
import Icon3d from '@shared/Icon3d'
import YurekaBrandMark from '@shared/YurekaBrandMark'
import { googleAvatarUrl } from '@shared/userProfile'
import { SUPER_BROWSE_STORES, fetchSuperBrowseStores, type SuperBrowseStore } from '@shared/superBrowseStores'
import { BrandLogo } from '@shared/BrandLogo'
import { openStoreBrowse, prefetchSuperBrowseLinks, type TrackedOpen } from '@shared/trackedBrowse'
import { onCatalogUpdate } from '@shared/catalogSync'
import { canUseInAppBrowse, isLikelyMobile } from '@shared/pwaDisplay'
import ExploreBrandScenes from './ExploreBrandScenes'
import { SuperBrowseGrid } from './SuperBrowse'
import NotificationBell from './NotificationBell'

type HomeCache = {
  balance: GoldbackBalance | null
  ledger: GoldbackLedgerEntry[]
  offers: GoldbackOffer[]
  yurekaScore: number | null
  scoreDecision: string | null
  /** Waitlist / membership status — drives the score-card label (not underwriting band). */
  memberStatus?: string | null
}

const cacheKey = (userId: string) => `goldback:home:v2:${userId}`
const spring = { type: 'spring' as const, bounce: 0, duration: 0.4 }
const springSnappy = { type: 'spring' as const, bounce: 0, duration: 0.3 }
const MotionLink = motion.create(Link)

/** Application / membership status shown on the home score card. */
function membershipLabel(status: string | null | undefined): string | null {
  const s = String(status || '')
    .trim()
    .toLowerCase()
    .replace(/_/g, '-')
  if (s === 'accepted' || s === 'admin') return 'Accepted'
  if (s === 'pending') return 'Pending'
  if (s === 'on-hold') return 'On hold'
  if (s === 'rejected') return 'Rejected'
  return null
}

/** Underwriting band from numeric score (stale "Rejected" meta is ignored when score says otherwise). */
function scoreBandFromNumber(score: number | null | undefined): string | null {
  if (score == null || !Number.isFinite(score)) return null
  if (score >= 70) return 'Approved'
  if (score >= 40) return 'Review'
  if (score >= 20) return 'Conditional'
  return 'Rejected'
}

/** Prefer membership (Accepted) over Gmail scoreDecision — those were getting mixed on the card. */
function scoreCardLabel(opts: {
  memberStatus?: string | null
  yurekaScore?: number | null
  scoreDecision?: string | null
}): string {
  const member = membershipLabel(opts.memberStatus)
  if (member) return member
  const band = scoreBandFromNumber(opts.yurekaScore)
  if (band) return band
  const stored = String(opts.scoreDecision || '').trim()
  return stored || 'Score ready'
}

const QUICK_ACTIONS = [
  { label: 'Offers', icon: 'bag', path: '/dashboard/offers?tab=marketplace' },
  { label: 'Expenses', icon: 'chart', path: '/dashboard/expenses' },
  { label: 'Yureka AI', icon: 'flash', path: '/dashboard/planning' },
  { label: 'Gift cards', icon: 'gift', path: '/dashboard/giftcards' },
  { label: 'Getaway', icon: 'flash', path: '/dashboard/getaway' },
  { label: 'Bills', icon: 'wallet', path: '/dashboard/bills' },
  { label: 'Referrals', icon: 'heart', path: '/dashboard/referrals' },
  { label: 'Profile', icon: 'boy', path: '/dashboard/profile' },
] as const

const DESKTOP_QUICK = [
  { label: 'Offers', icon: 'bag', path: '/dashboard/offers?tab=marketplace' },
  { label: 'Expenses', icon: 'chart', path: '/dashboard/expenses' },
  { label: 'Planning', icon: 'calender', path: '/dashboard/planning' },
  { label: 'Bills', icon: 'wallet', path: '/dashboard/bills' },
  { label: 'Gift Cards', icon: 'gift', path: '/dashboard/giftcards' },
  { label: 'Getaway', icon: 'flash', path: '/dashboard/getaway' },
  { label: 'Referrals', icon: 'heart', path: '/dashboard/referrals' },
  { label: 'Profile', icon: 'boy', path: '/dashboard/profile' },
] as const

function firstName(user: ReturnType<typeof useSupabase>['user']) {
  const full =
    String(user?.user_metadata?.full_name || user?.user_metadata?.name || '').trim() ||
    String(user?.email || '').split('@')[0]
  return full ? full.split(/\s+/)[0] : 'there'
}

/** Local-time greeting. Late night (before 5am) is evening — not morning. */
function dayGreeting(now = new Date()) {
  const h = now.getHours()
  if (h >= 5 && h < 12) return 'Good Morning'
  if (h >= 12 && h < 17) return 'Good Afternoon'
  return 'Good Evening'
}

type HomeViewProps = {
  reduceMotion: boolean | null
  userId: string
  greetingName: string
  balancePaise: number
  earnedToday: number
  yurekaScore: number | null
  /** Membership-first label for the score card (Accepted, not underwriting "Rejected"). */
  scoreLabel: string
  scorePct: number
  avatarUrl: string | null
  ledger: GoldbackLedgerEntry[]
  exploreStores: SuperBrowseStore[]
  onRefresh: () => void
  openStore: (url: string, title: string, storeId?: string) => void
  enter: { opacity: number; y?: number }
  settle: { opacity: number; y?: number }
}

function MobileHome({
  reduceMotion,
  greetingName,
  balancePaise,
  earnedToday,
  yurekaScore,
  scoreLabel,
  scorePct,
  avatarUrl,
  ledger,
  onRefresh,
  enter,
  settle,
}: HomeViewProps) {
  return (
    <div className="space-y-5 pb-2 md:hidden">
      <motion.header
        initial={enter}
        animate={settle}
        transition={spring}
        className="flex items-center justify-between gap-3"
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-[#10372c] shadow-[0_8px_20px_rgba(0,0,0,0.25)]">
            <YurekaBrandMark className="h-11 w-11 rounded-full object-cover" />
          </div>
          <div className="min-w-0 py-0.5">
            <p className="truncate text-[17px] font-semibold leading-tight tracking-[-0.03em] text-white">
              {dayGreeting()}, {greetingName}
            </p>
            {yurekaScore != null ? (
              <p className="mt-1 truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-clay/85">
                Yu score {yurekaScore}
                {scoreLabel ? ` · ${scoreLabel}` : ''}
              </p>
            ) : (
              <p className="mt-1 text-[10px] font-medium tracking-[0.02em] text-white/35">
                Your rewards home
              </p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <NotificationBell />
          <MotionLink
            to="/dashboard/profile"
            whileTap={{ scale: 0.96 }}
            transition={springSnappy}
            className="relative flex h-11 w-11 items-center justify-center"
            aria-label="Profile and Yureka Score"
          >
            <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 44 44" aria-hidden>
              <circle cx="22" cy="22" r="18.5" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
              <circle
                cx="22"
                cy="22"
                r="18.5"
                fill="none"
                stroke="rgb(52,211,153)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={`${(scorePct / 100) * 116.2} 116.2`}
              />
            </svg>
            <span className="relative flex h-8 w-8 overflow-hidden rounded-full bg-[#10372c] text-[11px] font-semibold text-clay">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <span className="m-auto">{greetingName.slice(0, 1).toUpperCase()}</span>
              )}
            </span>
          </MotionLink>
        </div>
      </motion.header>

      <MotionLink
        to="/dashboard/browse"
        initial={enter}
        animate={settle}
        transition={{ ...spring, delay: reduceMotion ? 0 : 0.03 }}
        whileTap={{ scale: 0.985 }}
        className="flex items-center gap-3 rounded-full bg-[#16181d] px-4 py-3.5 shadow-[0_8px_24px_rgba(0,0,0,0.25)]"
      >
        <Search size={16} className="shrink-0 text-white/40" />
        <span className="min-w-0 flex-1 text-[14px] tracking-[-0.01em] text-white/40">
          Search or open any store
        </span>
      </MotionLink>

      <motion.section
        initial={enter}
        animate={settle}
        transition={{ ...spring, delay: reduceMotion ? 0 : 0.05 }}
        className="space-y-3"
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">
          Everything that matters to you
        </p>
        <div className="grid grid-cols-2 gap-2.5">
          <div className="flex min-h-[8.5rem] flex-col justify-between overflow-hidden rounded-[1.4rem] border border-clay/30 bg-[linear-gradient(165deg,#34d399_0%,#1faa74_48%,#0f1a15_48.2%,#0c1411_100%)] p-3.5 shadow-[0_12px_28px_rgba(0,0,0,0.28)]">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-black/55">
                Savings in Gold
              </p>
              <p className="mt-1.5 text-[1.7rem] font-semibold tracking-[-0.045em] text-black tabular-nums leading-none">
                {formatPaise(balancePaise)}
              </p>
              <p className="mt-1.5 text-[11px] font-medium text-black/50">
                {earnedToday > 0 ? `Today ${formatPaise(earnedToday)}` : 'Live · face value'}
              </p>
            </div>
            <p className="text-[10px] text-white/40">Vault updates as you shop</p>
          </div>

          <div className="flex min-h-[8.5rem] flex-col justify-between overflow-hidden rounded-[1.4rem] border border-white/10 bg-[linear-gradient(165deg,#14352a_0%,#0b1210_100%)] p-3.5 shadow-[0_12px_28px_rgba(0,0,0,0.28)]">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
                Yu Points
              </p>
              {yurekaScore != null ? (
                <>
                  <p className="mt-1.5 text-[1.7rem] font-semibold tracking-[-0.045em] text-clay tabular-nums leading-none">
                    {yurekaScore}
                    <span className="text-[14px] font-medium text-white/30">/100</span>
                  </p>
                  <p className="mt-1.5 text-[11px] capitalize text-white/50">{scoreLabel}</p>
                </>
              ) : (
                <>
                  <p className="mt-1.5 text-[1.7rem] font-semibold tracking-[-0.045em] text-white/30 leading-none">
                    —
                  </p>
                  <p className="mt-1.5 text-[11px] text-white/40">Unlock via inbox</p>
                </>
              )}
            </div>
            <MotionLink
              to="/dashboard/expenses"
              whileTap={{ scale: 0.97 }}
              transition={springSnappy}
              className="inline-flex min-h-10 items-center justify-center rounded-full bg-clay px-3 text-[12px] font-semibold text-black"
            >
              View spend
            </MotionLink>
          </div>
        </div>

        <MotionLink
          to="/dashboard/browse"
          whileTap={{ scale: 0.985 }}
          transition={springSnappy}
          className="flex min-h-12 w-full items-center justify-between gap-3 rounded-[1.25rem] bg-white px-4 py-3.5 text-black shadow-[0_12px_28px_rgba(0,0,0,0.22)]"
        >
          <span className="text-[15px] font-semibold tracking-[-0.02em]">Open Super Browser</span>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black text-white">
            <ArrowRight size={15} />
          </span>
        </MotionLink>
      </motion.section>

      <motion.section
        id="explore-brands"
        initial={enter}
        animate={settle}
        transition={{ ...spring, delay: reduceMotion ? 0 : 0.07 }}
        className="scroll-mt-24 space-y-3"
      >
        <span id="super-browse" className="sr-only" aria-hidden />
        {/* Mobile Explore brands = Super Browse (store grid + in-app browser) */}
        <SuperBrowseGrid showChrome={false} />
      </motion.section>

      <motion.section
        initial={enter}
        animate={settle}
        transition={{ ...spring, delay: reduceMotion ? 0 : 0.09 }}
      >
        <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 snap-x snap-mandatory scrollbar-none">
          {QUICK_ACTIONS.map((item) => (
            <MotionLink
              key={item.label}
              to={item.path}
              whileTap={{ scale: 0.94 }}
              transition={springSnappy}
              className="flex w-[4.5rem] shrink-0 snap-start flex-col items-center gap-2"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#10372c] shadow-[0_10px_22px_rgba(0,0,0,0.3)]">
                <Icon3d name={item.icon} className="h-8 w-8 object-contain" alt="" />
              </span>
              <span className="w-full truncate text-center text-[10px] font-semibold tracking-[-0.01em] text-white/65">
                {item.label}
              </span>
            </MotionLink>
          ))}
        </div>
      </motion.section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-[12px] font-semibold tracking-[-0.01em] text-white/70">Recent activity</h3>
            <p className="mt-0.5 text-[12px] text-white/35">Latest Goldback credits</p>
          </div>
          <motion.button
            type="button"
            whileTap={{ scale: 0.96 }}
            transition={springSnappy}
            onClick={onRefresh}
            className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1.5 text-[11px] font-semibold text-white/45"
          >
            <RefreshCw size={12} /> Refresh
          </motion.button>
        </div>

        {ledger.length === 0 ? (
          <div className="rounded-[1.5rem] border border-dashed border-white/12 bg-white/[0.02] px-6 py-10 text-center">
            <p className="text-[15px] font-semibold tracking-[-0.02em] text-white">Your vault is empty</p>
            <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-white/45">
              Open a tracked offer, shop the deal, and Goldback lands here at face value.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {ledger.slice(0, 4).map((entry) => (
              <li
                key={entry.id}
                className="flex items-center justify-between gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-3.5"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-clay/10 text-clay">
                    <TrendingUp size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-semibold tracking-[-0.015em] text-white">
                      {String(entry.meta?.title || entry.meta?.merchant || entry.type)}
                    </p>
                    <p className="mt-0.5 text-[11px] text-white/35">
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
                <div className="shrink-0 text-[15px] font-semibold tabular-nums text-clay">
                  +{formatPaise(entry.amountPaise)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function DesktopHome({
  reduceMotion,
  greetingName,
  balancePaise,
  earnedToday,
  yurekaScore,
  scoreLabel,
  ledger,
  exploreStores,
  openStore,
  onRefresh,
  enter,
  settle,
}: HomeViewProps) {
  return (
    <div className="hidden space-y-7 md:block">
      <motion.header
        initial={enter}
        animate={settle}
        transition={spring}
        className="flex items-center justify-between gap-4"
      >
        <div className="flex min-w-0 items-center gap-3">
          <YurekaBrandMark className="h-9 w-9 rounded-xl object-cover" />
          <p className="truncate text-[1.15rem] font-semibold tracking-[-0.03em] text-white">
            {dayGreeting()} {greetingName.toUpperCase()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <motion.button
            type="button"
            whileTap={{ scale: 0.96 }}
            transition={springSnappy}
            onClick={onRefresh}
            aria-label="Refresh"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.06] text-white/55"
          >
            <RefreshCw size={15} />
          </motion.button>
        </div>
      </motion.header>

      <MotionLink
        to="/dashboard/offers?tab=marketplace"
        initial={enter}
        animate={settle}
        transition={{ ...spring, delay: reduceMotion ? 0 : 0.03 }}
        whileTap={{ scale: 0.99 }}
        className="flex items-center gap-3 rounded-2xl bg-[#12151a] px-5 py-3.5"
      >
        <Search size={16} className="shrink-0 text-white/40" />
        <span className="min-w-0 flex-1 text-[14px] text-white/40">Search across all stores</span>
        <ArrowRight size={15} className="shrink-0 text-white/30" />
      </MotionLink>

      <motion.section
        initial={enter}
        animate={settle}
        transition={{ ...spring, delay: reduceMotion ? 0 : 0.05 }}
        className="space-y-3"
      >
        <p className="text-[12px] font-semibold tracking-[-0.01em] text-white/50">
          Everything that matters to you
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-[1.4rem] border border-clay/20 bg-[linear-gradient(135deg,rgba(52,211,153,0.16)_0%,rgba(255,255,255,0.03)_55%)] p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-clay/85">
              Savings in Gold
            </p>
            <p className="mt-2.5 text-[2.25rem] font-semibold tracking-[-0.045em] text-white tabular-nums leading-none">
              {formatPaise(balancePaise)}
            </p>
            <p className="mt-2 text-[13px] text-white/50">Live balance redeemable at face value</p>
            <div className="mt-5 flex items-end justify-between gap-3">
              <MotionLink
                to="/dashboard/offers?tab=marketplace"
                whileTap={{ scale: 0.98 }}
                transition={springSnappy}
                className="rounded-full bg-clay px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-black"
              >
                Explore offers
              </MotionLink>
              <p className="text-[12px] text-white/40">
                {earnedToday > 0 ? `Earned today ${formatPaise(earnedToday)}` : 'Offer cashback lands here'}
              </p>
            </div>
          </div>

          <div className="rounded-[1.4rem] border border-white/10 bg-[linear-gradient(135deg,#13241c_0%,#0b1210_100%)] p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">
              Yureka Score
            </p>
            {yurekaScore != null ? (
              <>
                <p className="mt-2.5 text-[2.25rem] font-semibold tracking-[-0.045em] text-clay tabular-nums leading-none">
                  {yurekaScore}
                  <span className="text-[1rem] font-medium text-white/35">/100</span>
                </p>
                <p className="mt-2 text-[13px] capitalize text-white/50">
                  {scoreLabel}
                </p>
              </>
            ) : (
              <>
                <p className="mt-2.5 text-[2.25rem] font-semibold tracking-[-0.045em] text-white/30 leading-none">
                  —
                </p>
                <p className="mt-2 text-[13px] text-white/45">Complete inbox analysis to unlock</p>
              </>
            )}
            <div className="mt-5 flex items-end justify-between gap-3">
              <MotionLink
                to="/dashboard/expenses"
                whileTap={{ scale: 0.98 }}
                transition={springSnappy}
                className="rounded-full bg-clay px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-black"
              >
                View expenses
              </MotionLink>
              <p className="text-[12px] text-white/40">{ledger.length} earn events</p>
            </div>
          </div>
        </div>
      </motion.section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_1fr]">
        <motion.section
          initial={enter}
          animate={settle}
          transition={{ ...spring, delay: reduceMotion ? 0 : 0.07 }}
          className="space-y-3"
        >
          <p className="text-[12px] font-semibold tracking-[-0.01em] text-white/50">For you</p>
          <div className="space-y-2.5">
            <MotionLink
              to="/dashboard/offers?tab=marketplace"
              whileTap={{ scale: 0.99 }}
              transition={springSnappy}
              className="flex items-center justify-between gap-4 rounded-[1.25rem] border border-white/10 bg-[#12151a] px-5 py-4"
            >
              <div>
                <p className="text-[15px] font-semibold tracking-[-0.02em] text-white">Marketplace Deals</p>
                <p className="mt-1 text-[13px] text-white/45">
                  Quick commerce, shopping, and brand rewards
                </p>
              </div>
              <ArrowRight size={17} className="shrink-0 text-white/35" />
            </MotionLink>
            <MotionLink
              to="/dashboard/planning"
              whileTap={{ scale: 0.99 }}
              transition={springSnappy}
              className="flex items-center justify-between gap-4 rounded-[1.25rem] border border-white/10 bg-[#12151a] px-5 py-4"
            >
              <div>
                <p className="text-[15px] font-semibold tracking-[-0.02em] text-white">Spend Analysis</p>
                <p className="mt-1 text-[13px] text-white/45">
                  Travel, cabs, subscriptions, and utility insight
                </p>
              </div>
              <ArrowRight size={17} className="shrink-0 text-white/35" />
            </MotionLink>
          </div>
        </motion.section>

        <motion.section
          initial={enter}
          animate={settle}
          transition={{ ...spring, delay: reduceMotion ? 0 : 0.08 }}
          className="space-y-3"
        >
          <p className="text-[12px] font-semibold tracking-[-0.01em] text-white/50">Quick Actions</p>
          <div className="grid grid-cols-4 gap-2">
            {DESKTOP_QUICK.map((item) => (
              <MotionLink
                key={item.label}
                to={item.path}
                whileTap={{ scale: 0.96 }}
                transition={springSnappy}
                className="flex min-h-[5.25rem] flex-col items-center justify-center gap-1.5 rounded-[1.1rem] border border-white/10 bg-[#12151a] px-2 py-3 text-center"
              >
                <Icon3d name={item.icon} className="h-8 w-8 object-contain" alt="" />
                <span className="text-[9px] font-semibold uppercase tracking-[0.06em] text-white/65">
                  {item.label}
                </span>
              </MotionLink>
            ))}
          </div>
        </motion.section>
      </div>

      <motion.section
        id="explore-brands"
        initial={enter}
        animate={settle}
        transition={{ ...spring, delay: reduceMotion ? 0 : 0.09 }}
        className="scroll-mt-24 space-y-3"
      >
        <span id="super-browse" className="sr-only" aria-hidden />
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
              Explore brands
            </p>
            <p className="mt-1 text-[13px] text-white/50">Tap a store to shop with Goldback</p>
          </div>
          <MotionLink
            to="/dashboard/browse"
            whileTap={{ scale: 0.98 }}
            transition={springSnappy}
            className="text-[12px] font-semibold text-clay"
          >
            Explore all brands →
          </MotionLink>
        </div>
        <div className="grid grid-cols-8 gap-3 rounded-[1.5rem] border border-clay/20 bg-[linear-gradient(165deg,rgba(52,211,153,0.14)_0%,rgba(16,55,44,0.4)_55%,rgba(12,20,17,0.85)_100%)] p-4">
          {exploreStores.slice(0, 8).map((store) => (
            <motion.button
              key={store.id}
              type="button"
              whileTap={{ scale: 0.94 }}
              transition={springSnappy}
              onClick={() => openStore(store.url, store.name, store.id)}
              className="relative flex flex-col items-center gap-2"
            >
              <span
                className="relative flex aspect-square w-full items-center justify-center rounded-[1.1rem] shadow-[0_8px_18px_rgba(0,0,0,0.2)]"
                style={{ background: store.bg }}
              >
                <BrandLogo
                  domain={store.domain}
                  name={store.name}
                  logoUrl={store.logoUrl}
                  className="flex h-[68%] w-[68%] max-h-11 max-w-11 items-center justify-center"
                  imgClassName="h-full w-full object-contain p-[6%]"
                />
                {store.cashback && (
                  <span className="absolute -right-0.5 -top-0.5 z-10 rounded-full bg-[#10372c] px-1.5 py-0.5 text-[8px] font-bold leading-none text-white ring-2 ring-[#0c1411]">
                    {store.cashback}
                  </span>
                )}
              </span>
              <span className="w-full truncate text-center text-[11px] font-medium text-white/70">
                {store.name}
              </span>
            </motion.button>
          ))}
        </div>
      </motion.section>

      <motion.section
        initial={enter}
        animate={settle}
        transition={{ ...spring, delay: reduceMotion ? 0 : 0.1 }}
        className="space-y-3"
      >
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
            Explore offers
          </p>
          <p className="mt-1 text-[13px] text-white/50">
            Coupons, gift cards, and partner brands by category.
          </p>
        </div>
        <ExploreBrandScenes />
      </motion.section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-[12px] font-semibold tracking-[-0.01em] text-white/70">Recent activity</h3>
            <p className="mt-0.5 text-[12px] text-white/35">Latest Goldback credits</p>
          </div>
          <motion.button
            type="button"
            whileTap={{ scale: 0.96 }}
            transition={springSnappy}
            onClick={onRefresh}
            className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1.5 text-[11px] font-semibold text-white/45"
          >
            <RefreshCw size={12} /> Refresh
          </motion.button>
        </div>

        {ledger.length === 0 ? (
          <div className="rounded-[1.4rem] border border-dashed border-white/12 bg-white/[0.02] px-6 py-10 text-center">
            <p className="text-[15px] font-semibold tracking-[-0.02em] text-white">Your vault is empty</p>
            <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-white/45">
              Open a tracked offer, shop the deal, and Goldback lands here at face value.
            </p>
            <MotionLink
              to="/dashboard/offers?tab=marketplace"
              whileTap={{ scale: 0.97 }}
              transition={springSnappy}
              className="mt-5 inline-flex items-center gap-2 text-[12px] font-semibold text-clay"
            >
              Browse offers <ArrowRight size={14} />
            </MotionLink>
          </div>
        ) : (
          <ul className="space-y-2">
            {ledger.slice(0, 6).map((entry, idx) => (
              <motion.li
                key={entry.id}
                initial={enter}
                animate={settle}
                transition={{ ...spring, delay: reduceMotion ? 0 : Math.min(idx * 0.03, 0.18) }}
                className="flex items-center justify-between gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-3.5"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-clay/10 text-clay">
                    <TrendingUp size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-semibold tracking-[-0.015em] text-white">
                      {String(entry.meta?.title || entry.meta?.merchant || entry.type)}
                    </p>
                    <p className="mt-0.5 text-[11px] text-white/35">
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
                <div className="shrink-0 text-[15px] font-semibold tabular-nums text-clay">
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

const GoldbackHome: React.FC = () => {
  const reduceMotion = useReducedMotion()
  const { user, currentUserStatus } = useSupabase()
  const userId = user?.id || user?.email || getLastAuthEmail() || ''
  const cached = userId ? cacheGet<HomeCache>(cacheKey(userId), CACHE_TTL.goldbackHome) : null
  const [balance, setBalance] = useState<GoldbackBalance | null>(cached?.data.balance ?? null)
  const [ledger, setLedger] = useState<GoldbackLedgerEntry[]>(cached?.data.ledger ?? [])
  const [offers, setOffers] = useState<GoldbackOffer[]>(cached?.data.offers ?? [])
  const [yurekaScore, setYurekaScore] = useState<number | null>(cached?.data.yurekaScore ?? null)
  const [scoreDecision, setScoreDecision] = useState<string | null>(cached?.data.scoreDecision ?? null)
  const [memberStatus, setMemberStatus] = useState<string | null>(
    cached?.data.memberStatus ?? currentUserStatus ?? null,
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exploreStores, setExploreStores] = useState<SuperBrowseStore[]>(SUPER_BROWSE_STORES.slice(0, 10))
  const [trackedLinks, setTrackedLinks] = useState<Record<string, TrackedOpen>>({})

  const enter = reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }
  const settle = { opacity: 1, y: 0 }

  useEffect(() => {
    let cancelled = false
    const loadStores = () => {
      void fetchSuperBrowseStores().then((next) => {
        if (!cancelled && next.length) setExploreStores(next.slice(0, 10))
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
    if (typeof window === 'undefined') return
    const hash = window.location.hash
    if (hash !== '#explore-brands' && hash !== '#super-browse') return
    void import('@shared/dashboardScroll').then((m) => {
      m.restoreDashboardPosition({
        pathname: '/dashboard/home',
        hash: '#explore-brands',
      })
    })
  }, [])

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!userId) {
      setError('Sign in required')
      setLoading(false)
      return
    }
    if (!opts?.silent && !balance && ledger.length === 0 && !cached?.data) setLoading(true)
    setError(null)
    const [b, l, o] = await Promise.all([
      goldbackApi.balance(userId),
      goldbackApi.ledger(userId),
      goldbackApi.offers(userId),
    ])
    const nextBalance = !b.error && b.data ? b.data : null
    const nextLedger = !l.error && l.data ? l.data : []
    const nextOffers = !o.error && o.data ? o.data.filter((item) => item.active !== false) : []
    if (b.error || !b.data) {
      if (!opts?.silent) setError(b.error || 'Could not load balance')
    } else {
      setBalance(b.data)
    }
    if (!l.error && l.data) setLedger(l.data)
    if (!o.error && o.data) setOffers(nextOffers)
    setLoading(false)
    if (!user?.email) {
      if (nextBalance) {
        cacheSet(cacheKey(userId), {
          balance: nextBalance,
          ledger: nextLedger,
          offers: nextOffers,
          yurekaScore: null,
          scoreDecision: null,
          memberStatus: currentUserStatus ?? null,
        })
      }
      return
    }
    const waitlist = await api.get<ApiWaitlist>(`/api/v1/waitlist/entry?email=${encodeURIComponent(user.email)}`)
    let nextScore: number | null = null
    let nextDecision: string | null = null
    let nextMember: string | null = currentUserStatus ?? null
    if (!isApiError(waitlist) && waitlist.data) {
      nextScore = waitlist.data.yurekaScore ?? null
      nextDecision = waitlist.data.scoreDecision ?? null
      nextMember = waitlist.data.status || nextMember
      setYurekaScore(nextScore)
      setScoreDecision(nextDecision)
      setMemberStatus(nextMember)
    } else if (currentUserStatus) {
      setMemberStatus(currentUserStatus)
    }
    if (nextBalance) {
      cacheSet(cacheKey(userId), {
        balance: nextBalance,
        ledger: nextLedger,
        offers: nextOffers,
        yurekaScore: nextScore,
        scoreDecision: nextDecision,
        memberStatus: nextMember,
      })
    }
  }, [userId, user?.email, balance, ledger.length, currentUserStatus])

  useEffect(() => {
    if (!userId) return
    const hit = cacheGet<HomeCache>(cacheKey(userId), CACHE_TTL.goldbackHome)
    if (hit) {
      setBalance(hit.data.balance)
      setLedger(hit.data.ledger)
      setOffers(hit.data.offers ?? [])
      setYurekaScore(hit.data.yurekaScore ?? null)
      setScoreDecision(hit.data.scoreDecision ?? null)
      setMemberStatus(hit.data.memberStatus ?? currentUserStatus ?? null)
      setLoading(false)
      if (hit.stale) void load({ silent: true })
      return
    }
    void load()
  }, [userId, load, currentUserStatus])

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
    return onCatalogUpdate(() => {
      void load({ silent: true })
    })
  }, [load])

  useEffect(() => {
    if (currentUserStatus && currentUserStatus !== 'loading' && currentUserStatus !== 'none') {
      setMemberStatus((prev) => prev || currentUserStatus)
    }
  }, [currentUserStatus])

  useEffect(() => {
    const onScore = (event: Event) => {
      const detail = (event as CustomEvent).detail || {}
      // scan returns { score, decision, metrics } — accept either shape
      const next = Number(
        typeof detail === 'number'
          ? detail
          : detail.score != null
            ? detail.score
            : detail.yurekaScore,
      )
      if (!Number.isFinite(next)) return
      const nextDecision =
        typeof detail.decision === 'string'
          ? detail.decision
          : typeof detail.scoreDecision === 'string'
            ? detail.scoreDecision
            : scoreBandFromNumber(next)
      setYurekaScore(next)
      setScoreDecision(nextDecision)
      if (userId) {
        const hit = cacheGet<HomeCache>(cacheKey(userId), CACHE_TTL.goldbackHome)
        cacheSet(cacheKey(userId), {
          balance: hit?.data.balance ?? balance,
          ledger: hit?.data.ledger ?? ledger,
          offers: hit?.data.offers ?? offers,
          yurekaScore: next,
          scoreDecision: nextDecision,
          memberStatus: hit?.data.memberStatus ?? memberStatus,
        })
      }
    }
    window.addEventListener('yureka-score-updated', onScore)
    return () => window.removeEventListener('yureka-score-updated', onScore)
  }, [userId, balance, ledger, offers, memberStatus])

  const earnedToday = useMemo(() => {
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    // Only real offer earnings — admin balance adjusts use status "earned"/"redeemed"
    // and were inflating this (e.g. set ₹500 then ₹50 → still showed ₹500 earned today).
    return ledger
      .filter(
        (e) =>
          e.type === 'earn' &&
          e.status === 'earned' &&
          e.amountPaise > 0 &&
          new Date(e.createdAt) >= start,
      )
      .reduce((sum, e) => sum + e.amountPaise, 0)
  }, [ledger])

  const greetingName = firstName(user)
  const balancePaise = balance?.balancePaise ?? 0
  const avatarUrl = googleAvatarUrl(user)
  const scorePct = yurekaScore != null ? Math.max(8, Math.min(100, yurekaScore)) : 8
  const scoreLabel = scoreCardLabel({
    memberStatus: memberStatus || currentUserStatus,
    yurekaScore,
    scoreDecision,
  })

  const navigate = useNavigate()

  const openStore = (url: string, title: string, storeId?: string) => {
    const known = storeId ? trackedLinks[storeId] : undefined
    const cue = known?.affiliate ? known.openUrl : undefined
    const cueOk = Boolean(cue)
    const preferInApp = canUseInAppBrowse() || isLikelyMobile()
    void openStoreBrowse(url, userId, {
      title,
      returnTo: '/dashboard/home#explore-brands',
      forceExternal: !preferInApp,
      navigate: preferInApp ? (path) => navigate(path) : undefined,
      knownOpenUrl: cueOk ? cue : undefined,
      preferWeb: !cueOk,
    })
  }

  const viewProps: HomeViewProps = {
    reduceMotion,
    userId,
    greetingName,
    balancePaise,
    earnedToday,
    yurekaScore,
    scoreLabel,
    scorePct,
    avatarUrl,
    ledger,
    exploreStores,
    onRefresh: () => void load(),
    openStore,
    enter,
    settle,
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-28">
        <Loader2 className="animate-spin text-clay" size={36} />
        <span className="text-[13px] font-medium tracking-[-0.01em] text-white/40">Loading home…</span>
      </div>
    )
  }

  return (
    <>
      <AnimatePresence>
        {error && (
          <motion.div
            initial={enter}
            animate={settle}
            exit={{ opacity: 0 }}
            transition={springSnappy}
            className="mb-4 rounded-2xl border border-red-500/25 bg-red-500/10 px-5 py-4 text-sm text-red-200"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>
      <MobileHome {...viewProps} />
      <DesktopHome {...viewProps} />
    </>
  )
}

export default GoldbackHome

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import {
  ArrowRight,
  Bell,
  Loader2,
  Mic,
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
import { getExploreScene } from '@shared/exploreScenes'
import { SUPER_BROWSE_STORES, fetchSuperBrowseStores, type SuperBrowseStore } from '@shared/superBrowseStores'
import { BrandLogo } from '@shared/BrandLogo'
import { openStoreBrowse } from '@shared/trackedBrowse'
import ExploreBrandScenes from './ExploreBrandScenes'

type HomeCache = {
  balance: GoldbackBalance | null
  ledger: GoldbackLedgerEntry[]
  offers: GoldbackOffer[]
  yurekaScore: number | null
  scoreDecision: string | null
}

const cacheKey = (userId: string) => `goldback:home:${userId}`
const spring = { type: 'spring' as const, bounce: 0, duration: 0.4 }
const springSnappy = { type: 'spring' as const, bounce: 0, duration: 0.3 }
const MotionLink = motion.create(Link)

const QUICK_ACTIONS = [
  { label: 'Offers', icon: 'bag', path: '/dashboard/offers?tab=marketplace' },
  { label: 'Expenses', icon: 'chart', path: '/dashboard/expenses' },
  { label: 'Yureka AI', icon: 'flash', path: '/dashboard/planning' },
  { label: 'Gift cards', icon: 'gift', path: '/dashboard/giftcards' },
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
  { label: 'Referrals', icon: 'heart', path: '/dashboard/referrals' },
  { label: 'Profile', icon: 'boy', path: '/dashboard/profile' },
] as const

const FOR_YOU_LEFT = [
  {
    id: 'qcommerce',
    title: 'Quick Commerce',
    path: '/dashboard/offers?tab=marketplace&scene=qcommerce',
    brands: ['blinkit.com', 'zeptonow.com', 'swiggy.com'],
  },
  {
    id: 'giftcards',
    title: 'Gift Cards',
    path: '/dashboard/giftcards',
    brands: ['amazon.in', 'flipkart.com', 'myntra.com'],
  },
] as const

const FOR_YOU_RIGHT = [
  {
    id: 'rides',
    title: 'Travel Cabs',
    path: '/dashboard/offers?tab=marketplace&scene=rides',
    brands: ['uber.com'],
  },
  {
    id: 'flights',
    title: 'Travel Flights | Hotels',
    path: '/dashboard/offers?tab=marketplace&scene=flights',
    brands: ['makemytrip.com', 'goibibo.com'],
  },
  {
    id: 'shopping',
    title: 'Shop India',
    path: '/dashboard/offers?tab=marketplace&scene=shopping',
    brands: ['amazon.in', 'flipkart.com', 'ajio.com'],
  },
] as const

function firstName(user: ReturnType<typeof useSupabase>['user']) {
  const full =
    String(user?.user_metadata?.full_name || user?.user_metadata?.name || '').trim() ||
    String(user?.email || '').split('@')[0]
  return full ? full.split(/\s+/)[0] : 'there'
}

function dayGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good Morning'
  if (h < 18) return 'Good Afternoon'
  return 'Good Evening'
}

type HomeViewProps = {
  reduceMotion: boolean | null
  userId: string
  greetingName: string
  balancePaise: number
  earnedToday: number
  yurekaScore: number | null
  scoreDecision: string | null
  scorePct: number
  avatarUrl: string | null
  ledger: GoldbackLedgerEntry[]
  exploreStores: SuperBrowseStore[]
  onRefresh: () => void
  openStore: (url: string, title: string) => void
  enter: { opacity: number; y?: number }
  settle: { opacity: number; y?: number }
}

function MobileHome({
  reduceMotion,
  greetingName,
  balancePaise,
  earnedToday,
  yurekaScore,
  scoreDecision,
  scorePct,
  avatarUrl,
  ledger,
  exploreStores,
  onRefresh,
  openStore,
  enter,
  settle,
}: HomeViewProps) {
  return (
    <div
      className="space-y-5 pb-2 md:hidden"
      style={{ paddingTop: 'max(0.25rem, env(safe-area-inset-top, 0px))' }}
    >
      <motion.header
        initial={enter}
        animate={settle}
        transition={spring}
        className="flex items-center justify-between gap-3"
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-[#10372c] shadow-[0_8px_20px_rgba(0,0,0,0.25)]">
            <YurekaBrandMark className="h-11 w-11 rounded-full object-cover" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-[17px] font-semibold tracking-[-0.03em] text-white">
              {dayGreeting()}, {greetingName}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <motion.button
            type="button"
            whileTap={{ scale: 0.94 }}
            transition={springSnappy}
            aria-label="Notifications"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.06] text-white/55"
          >
            <Bell size={16} />
          </motion.button>
          <MotionLink
            to="/dashboard/profile"
            whileTap={{ scale: 0.96 }}
            transition={springSnappy}
            className="relative flex h-[3.25rem] w-[3.25rem] items-center justify-center"
            aria-label="Profile and Yureka Score"
          >
            <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 52 52" aria-hidden>
              <circle cx="26" cy="26" r="22" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3.5" />
              <circle
                cx="26"
                cy="26"
                r="22"
                fill="none"
                stroke="rgb(52,211,153)"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeDasharray={`${(scorePct / 100) * 138.2} 138.2`}
              />
            </svg>
            <span className="relative flex h-10 w-10 overflow-hidden rounded-full bg-[#10372c] text-[12px] font-semibold text-clay">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <span className="m-auto">{greetingName.slice(0, 1).toUpperCase()}</span>
              )}
            </span>
          </MotionLink>
        </div>
      </motion.header>

      {yurekaScore != null && (
        <p className="-mt-3 text-right text-[10px] font-semibold uppercase tracking-[0.12em] text-clay/85">
          Yu score is {yurekaScore}
          {scoreDecision ? ` · ${scoreDecision}` : ''}
        </p>
      )}

      <MotionLink
        to="/dashboard/offers?tab=marketplace"
        initial={enter}
        animate={settle}
        transition={{ ...spring, delay: reduceMotion ? 0 : 0.03 }}
        whileTap={{ scale: 0.985 }}
        className="flex items-center gap-3 rounded-full bg-[#16181d] px-4 py-3.5 shadow-[0_8px_24px_rgba(0,0,0,0.25)]"
      >
        <Search size={16} className="shrink-0 text-white/40" />
        <span className="min-w-0 flex-1 text-[14px] tracking-[-0.01em] text-white/40">
          Search across all stores
        </span>
        <Mic size={15} className="shrink-0 text-white/28" aria-hidden />
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
          <div className="overflow-hidden rounded-[1.4rem] border border-clay/30 bg-[linear-gradient(165deg,#34d399_0%,#1faa74_42%,#0f1a15_42.2%,#0c1411_100%)] shadow-[0_12px_28px_rgba(0,0,0,0.28)]">
            <div className="px-3.5 pb-2 pt-3.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-black/55">
                Savings in Gold
              </p>
              <p className="mt-1.5 text-[1.75rem] font-semibold tracking-[-0.045em] text-black tabular-nums leading-none">
                {formatPaise(balancePaise)}
              </p>
              <p className="mt-1 text-[11px] font-medium text-black/50">
                Today {formatPaise(earnedToday)}
              </p>
            </div>
            <div className="bg-[#0c1411]/90 px-3.5 pb-3.5 pt-3">
              <MotionLink
                to="/dashboard/offers?tab=marketplace"
                whileTap={{ scale: 0.98 }}
                transition={springSnappy}
                className="flex items-center justify-center rounded-full bg-white px-3 py-2 text-[12px] font-semibold text-black"
              >
                Explore offers
              </MotionLink>
              <p className="mt-2 text-center text-[10px] text-white/35">Live vault · face value</p>
            </div>
          </div>

          <div className="flex flex-col justify-between overflow-hidden rounded-[1.4rem] border border-white/10 bg-[linear-gradient(165deg,#14352a_0%,#0b1210_100%)] p-3.5 shadow-[0_12px_28px_rgba(0,0,0,0.28)]">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
                Yu Points
              </p>
              {yurekaScore != null ? (
                <>
                  <p className="mt-1.5 text-[1.75rem] font-semibold tracking-[-0.045em] text-clay tabular-nums leading-none">
                    {yurekaScore}
                    <span className="text-[14px] font-medium text-white/30">/100</span>
                  </p>
                  <p className="mt-1 text-[11px] capitalize text-white/50">
                    {scoreDecision || 'Score ready'}
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-1.5 text-[1.75rem] font-semibold tracking-[-0.045em] text-white/30 leading-none">
                    —
                  </p>
                  <p className="mt-1 text-[11px] text-white/40">Unlock via inbox</p>
                </>
              )}
            </div>
            <MotionLink
              to="/dashboard/expenses"
              whileTap={{ scale: 0.98 }}
              transition={springSnappy}
              className="mt-3 flex items-center justify-center rounded-full bg-clay px-3 py-2 text-[12px] font-semibold text-black"
            >
              View spend
            </MotionLink>
          </div>
        </div>
      </motion.section>

      <motion.section
        initial={enter}
        animate={settle}
        transition={{ ...spring, delay: reduceMotion ? 0 : 0.07 }}
        className="space-y-3"
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">For you</p>
        <div className="grid grid-cols-2 gap-2.5">
          <div className="flex flex-col gap-2.5">
            {FOR_YOU_LEFT.map((card) => (
              <MotionLink
                key={card.id}
                to={card.path}
                whileTap={{ scale: 0.98 }}
                transition={springSnappy}
                className="flex min-h-[7.75rem] flex-1 flex-col justify-between rounded-[1.35rem] border border-white/10 bg-[linear-gradient(160deg,#14241c_0%,#0e1512_100%)] p-3.5 shadow-[0_10px_24px_rgba(0,0,0,0.22)]"
              >
                <p className="text-[14px] font-semibold tracking-[-0.025em] text-white">{card.title}</p>
                <div className="flex items-center">
                  {card.brands.map((domain, i) => (
                    <span
                      key={domain}
                      className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-white"
                      style={{ marginLeft: i === 0 ? 0 : -6, zIndex: card.brands.length - i }}
                    >
                      <BrandLogo
                        domain={domain}
                        className="flex h-4 w-4 items-center justify-center"
                        imgClassName="h-4 w-4 object-contain"
                      />
                    </span>
                  ))}
                  <span className="ml-2 text-[10px] font-medium text-white/40">& many more</span>
                </div>
              </MotionLink>
            ))}
          </div>
          <div className="flex flex-col gap-2">
            {FOR_YOU_RIGHT.map((card) => {
              const scene = getExploreScene(card.id)
              return (
                <MotionLink
                  key={card.id}
                  to={card.path}
                  whileTap={{ scale: 0.98 }}
                  transition={springSnappy}
                  className="flex min-h-[3.45rem] items-center justify-between gap-2 rounded-[1.15rem] border border-clay/25 bg-clay/15 px-3 py-2.5 shadow-[0_8px_18px_rgba(0,0,0,0.18)]"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[12px] font-semibold tracking-[-0.02em] text-white">
                      {card.title}
                    </p>
                    {scene?.brands?.length ? (
                      <div className="mt-1 flex items-center">
                        {card.brands.map((domain, i) => (
                          <span
                            key={domain}
                            className="flex h-5 w-5 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-white"
                            style={{ marginLeft: i === 0 ? 0 : -4 }}
                          >
                            <BrandLogo
                              domain={domain}
                              className="flex h-3.5 w-3.5 items-center justify-center"
                              imgClassName="h-3.5 w-3.5 object-contain"
                            />
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <ArrowRight size={14} className="shrink-0 text-clay/85" />
                </MotionLink>
              )
            })}
          </div>
        </div>
      </motion.section>

      <motion.section
        initial={enter}
        animate={settle}
        transition={{ ...spring, delay: reduceMotion ? 0 : 0.09 }}
      >
        <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none">
          {QUICK_ACTIONS.map((item) => (
            <MotionLink
              key={item.label}
              to={item.path}
              whileTap={{ scale: 0.94 }}
              transition={springSnappy}
              className="flex w-[4.4rem] shrink-0 flex-col items-center gap-2"
            >
              <span className="flex h-[3.6rem] w-[3.6rem] items-center justify-center rounded-full bg-[#10372c] shadow-[0_10px_22px_rgba(0,0,0,0.3)]">
                <Icon3d name={item.icon} className="h-8 w-8 object-contain" alt="" />
              </span>
              <span className="w-full truncate text-center text-[10px] font-semibold tracking-[-0.01em] text-white/65">
                {item.label}
              </span>
            </MotionLink>
          ))}
        </div>
      </motion.section>

      <motion.section
        id="super-browse"
        initial={enter}
        animate={settle}
        transition={{ ...spring, delay: reduceMotion ? 0 : 0.11 }}
        className="scroll-mt-24 overflow-hidden rounded-[1.7rem] border border-clay/25 bg-[linear-gradient(165deg,rgba(52,211,153,0.2)_0%,rgba(16,55,44,0.55)_55%,rgba(12,20,17,0.9)_100%)] p-4 shadow-[0_16px_36px_rgba(0,0,0,0.28)]"
      >
        <p className="mb-3 text-[12px] font-semibold tracking-[-0.01em] text-white/80">Explore Brands</p>
        <div className="grid grid-cols-5 gap-2">
          {exploreStores.map((store) => (
            <motion.button
              key={store.id}
              type="button"
              whileTap={{ scale: 0.94 }}
              transition={springSnappy}
              onClick={() => openStore(store.url, store.name)}
              className="relative flex aspect-square items-center justify-center rounded-[1.05rem] bg-white shadow-[0_8px_18px_rgba(0,0,0,0.2)]"
              style={{ background: store.bg }}
            >
              <BrandLogo
                domain={store.domain}
                name={store.name}
                logoUrl={store.logoUrl}
                className="flex h-8 w-8 items-center justify-center"
                imgClassName="h-8 w-8 object-contain"
              />
              {store.cashback && (
                <span className="absolute -right-1 -top-1 rounded-full bg-[#10372c] px-1.5 py-0.5 text-[8px] font-bold text-white">
                  {store.cashback}
                </span>
              )}
            </motion.button>
          ))}
        </div>
        <div className="mt-3.5 grid grid-cols-2 gap-2">
          <MotionLink
            to="/dashboard/offers?tab=marketplace"
            whileTap={{ scale: 0.98 }}
            transition={springSnappy}
            className="rounded-full bg-[#10372c] px-4 py-3 text-center text-[12px] font-semibold text-white"
          >
            See all stores →
          </MotionLink>
          <motion.button
            type="button"
            whileTap={{ scale: 0.98 }}
            transition={springSnappy}
            onClick={() => openStore('https://www.flipkart.com/', 'Flipkart')}
            className="rounded-full bg-white px-4 py-3 text-center text-[12px] font-semibold text-black"
          >
            Show Demo
          </motion.button>
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
  scoreDecision,
  ledger,
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
          <motion.button
            type="button"
            whileTap={{ scale: 0.96 }}
            transition={springSnappy}
            aria-label="Notifications"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.06] text-white/55"
          >
            <Bell size={15} />
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
              <p className="text-[12px] text-white/40">Earned today {formatPaise(earnedToday)}</p>
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
                  {scoreDecision || 'Approved'}
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
  const navigate = useNavigate()
  const { user } = useSupabase()
  const userId = user?.id || user?.email || getLastAuthEmail() || ''
  const cached = userId ? cacheGet<HomeCache>(cacheKey(userId), CACHE_TTL.goldbackHome) : null
  const [balance, setBalance] = useState<GoldbackBalance | null>(cached?.data.balance ?? null)
  const [ledger, setLedger] = useState<GoldbackLedgerEntry[]>(cached?.data.ledger ?? [])
  const [offers, setOffers] = useState<GoldbackOffer[]>(cached?.data.offers ?? [])
  const [yurekaScore, setYurekaScore] = useState<number | null>(cached?.data.yurekaScore ?? null)
  const [scoreDecision, setScoreDecision] = useState<string | null>(cached?.data.scoreDecision ?? null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exploreStores, setExploreStores] = useState<SuperBrowseStore[]>(SUPER_BROWSE_STORES.slice(0, 10))

  const enter = reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }
  const settle = { opacity: 1, y: 0 }

  useEffect(() => {
    let cancelled = false
    void fetchSuperBrowseStores().then((next) => {
      if (!cancelled && next.length) setExploreStores(next.slice(0, 10))
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.location.hash !== '#super-browse') return
    void import('@shared/dashboardScroll').then((m) => {
      m.restoreDashboardPosition({
        pathname: '/dashboard/home',
        hash: '#super-browse',
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
        })
      }
      return
    }
    const waitlist = await api.get<ApiWaitlist>(`/api/v1/waitlist/entry?email=${encodeURIComponent(user.email)}`)
    let nextScore: number | null = null
    let nextDecision: string | null = null
    if (!isApiError(waitlist) && waitlist.data) {
      nextScore = waitlist.data.yurekaScore ?? null
      nextDecision = waitlist.data.scoreDecision ?? null
      setYurekaScore(nextScore)
      setScoreDecision(nextDecision)
    }
    if (nextBalance) {
      cacheSet(cacheKey(userId), {
        balance: nextBalance,
        ledger: nextLedger,
        offers: nextOffers,
        yurekaScore: nextScore,
        scoreDecision: nextDecision,
      })
    }
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

  const greetingName = firstName(user)
  const balancePaise = balance?.balancePaise ?? 0
  const avatarUrl = googleAvatarUrl(user)
  const scorePct = yurekaScore != null ? Math.max(8, Math.min(100, yurekaScore)) : 8

  const openStore = (url: string, title: string) => {
    void openStoreBrowse(url, userId, {
      title,
      returnTo: '/dashboard/home#super-browse',
      navigate,
    })
  }

  const viewProps: HomeViewProps = {
    reduceMotion,
    userId,
    greetingName,
    balancePaise,
    earnedToday,
    yurekaScore,
    scoreDecision,
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

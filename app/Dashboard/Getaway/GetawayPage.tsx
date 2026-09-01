import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Loader2, ArrowLeft, Plane, MessageCircle } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useSupabase } from '@shared/SupabaseProvider'
import { wwApi, type WwInstallment, type WwTripPublic } from '@backend/lib/wanderworld/client'
import NotificationBell from '../NotificationBell'
import WwTripChat from '../../wanderworld/WwTripChat'
import {
  captureGetawayRef,
  captureGetawayRefFromSearch,
  formatInr,
  loadRazorpayScript,
  readGetawayRef,
} from './getawayUtils'

async function openRazorpayCheckout(opts: {
  keyId: string
  orderId: string
  amountPaise: number
  name: string
  description: string
  prefill: { name: string; email: string; contact: string }
}): Promise<{ razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }> {
  const ready = await loadRazorpayScript()
  if (!ready || !window.Razorpay) throw new Error('Could not load Razorpay checkout')
  return new Promise((resolve, reject) => {
    const rzp = new window.Razorpay!({
      key: opts.keyId,
      amount: opts.amountPaise,
      currency: 'INR',
      name: 'Yureka · WanderWorld',
      description: opts.description,
      order_id: opts.orderId,
      prefill: opts.prefill,
      theme: { color: '#34d399' },
      handler: (response: any) => {
        resolve({
          razorpay_order_id: response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature,
        })
      },
      modal: {
        ondismiss: () => reject(new Error('Payment cancelled')),
      },
    })
    rzp.open()
  })
}

const GetawayPage: React.FC = () => {
  const { user } = useSupabase()
  const userId = user?.id || ''
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const reduceMotion = useReducedMotion()

  const view = useMemo(() => {
    const path = location.pathname.replace(/\/$/, '')
    if (path.endsWith('/getaway/bookings') || path.endsWith('/getaway/bookings/')) {
      return { kind: 'bookings' as const }
    }
    const chatMatch = path.match(/\/getaway\/chat(?:\/([^/]+))?$/)
    if (chatMatch) {
      return {
        kind: 'chat' as const,
        tripSlug: chatMatch[1] ? decodeURIComponent(chatMatch[1]) : undefined,
      }
    }
    const groupMatch = path.match(/\/getaway\/group\/([^/]+)$/)
    if (groupMatch?.[1]) return { kind: 'group' as const, code: decodeURIComponent(groupMatch[1]) }
    const m = path.match(/\/getaway\/([^/]+)$/)
    if (m && m[1] && m[1] !== 'bookings' && m[1] !== 'group' && m[1] !== 'chat') {
      return { kind: 'trip' as const, slug: m[1] }
    }
    return { kind: 'catalog' as const }
  }, [location.pathname])

  useEffect(() => {
    // Persist as soon as we see ref (also covered globally in App for login redirects).
    captureGetawayRefFromSearch(location.search)
    const ref = searchParams.get('ref')
    if (!ref) return
    captureGetawayRef(ref)
    void wwApi.resolveRef(ref) // counts referral click server-side
  }, [searchParams, location.search])

  const [trips, setTrips] = useState<WwTripPublic[]>([])
  const [trip, setTrip] = useState<WwTripPublic | null>(null)
  const [bookings, setBookings] = useState<
    { registration: any; trip: any; installments: WwInstallment[] }[]
  >([])
  const [groupInvite, setGroupInvite] = useState<Awaited<
    ReturnType<typeof wwApi.groupInvite>
  >['data'] | null>(null)
  const [alreadyBooked, setAlreadyBooked] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [paymentMode, setPaymentMode] = useState<'full' | 'plan'>('full')
  const [buyerName, setBuyerName] = useState('')
  const [buyerPhone, setBuyerPhone] = useState('')
  const [paySuccess, setPaySuccess] = useState<string | null>(
    searchParams.get('paid') === '1' ? 'Payment received. See details below.' : null,
  )
  const activeRef = readGetawayRef()
  const [city, setCity] = useState('')
  const [groupHasChat, setGroupHasChat] = useState(false)

  const loginNext = encodeURIComponent(location.pathname + location.search)

  const loadCatalog = useCallback(async () => {
    setLoading(true)
    setError(null)
    const res = await wwApi.trips()
    if (res.error) setError(res.error)
    else setTrips(res.data?.trips || [])
    setLoading(false)
  }, [])

  const loadTrip = useCallback(async (slug: string) => {
    setLoading(true)
    setError(null)
    setAlreadyBooked(false)
    const res = await wwApi.trip(slug)
    if (res.error || !res.data?.trip) {
      setError(res.error || 'Trip not found')
      setTrip(null)
      setLoading(false)
      return
    }
    setTrip(res.data.trip)
    setPaymentMode(res.data.trip.paymentPlansEnabled ? 'plan' : 'full')
    if (userId) {
      const b = await wwApi.bookings(userId)
      const hit = (b.data?.bookings || []).some(
        (row) => row.trip?.id === res.data!.trip.id && row.registration?.status !== 'cancelled',
      )
      setAlreadyBooked(hit)
    }
    setLoading(false)
  }, [userId])

  const loadBookings = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    setError(null)
    const res = await wwApi.bookings(userId)
    if (res.error) setError(res.error)
    else setBookings(res.data?.bookings || [])
    setLoading(false)
  }, [userId])

  const loadGroup = useCallback(async (code: string) => {
    setLoading(true)
    setError(null)
    const res = await wwApi.groupInvite(code)
    if (res.error || !res.data) {
      setError(res.error || 'Group not found')
      setGroupInvite(null)
    } else {
      setGroupInvite(res.data)
      if (userId && res.data.trip.slug) {
        const b = await wwApi.bookings(userId)
        const hit = (b.data?.bookings || []).some(
          (row) =>
            row.trip?.slug === res.data!.trip.slug && row.registration?.status !== 'cancelled',
        )
        setGroupHasChat(hit)
      } else {
        setGroupHasChat(false)
      }
    }
    setLoading(false)
  }, [userId])

  useEffect(() => {
    if (view.kind === 'catalog') void loadCatalog()
    else if (view.kind === 'trip') void loadTrip(view.slug)
    else if (view.kind === 'group') void loadGroup(view.code)
    else if (view.kind === 'chat') setLoading(false)
    else void loadBookings()
  }, [view, loadCatalog, loadTrip, loadBookings, loadGroup])

  useEffect(() => {
    if (user?.user_metadata?.full_name) setBuyerName(String(user.user_metadata.full_name))
  }, [user])

  const joinAndPayGroup = async () => {
    if (!userId || view.kind !== 'group') return
    setBusy(true)
    setError(null)
    try {
      const res = await wwApi.joinGroup(userId, view.code, {
        name: buyerName || user.email?.split('@')[0] || 'Guest',
        email: user.email || undefined,
      })
      if (res.error || !res.data) throw new Error(res.error || 'Could not join group')
      if (res.data.alreadyPaid) {
        navigate('/dashboard/getaway/bookings?paid=1')
        return
      }
      if (res.data.paymentsUnavailable || !res.data.keyId || !res.data.razorpayOrderId) {
        setError('Joined. payments are temporarily unavailable. Ask your promoter to collect cash.')
        await loadGroup(view.code)
        return
      }
      const pay = await openRazorpayCheckout({
        keyId: res.data.keyId,
        orderId: res.data.razorpayOrderId,
        amountPaise: res.data.amountPaise || 0,
        name: 'WanderWorld',
        description: res.data.tripTitle || 'Group share',
        prefill: res.data.prefill || {
          name: buyerName,
          email: user.email || '',
          contact: '',
        },
      })
      const verify = await wwApi.verify(userId, {
        installmentId: res.data.installmentId || res.data.installment?.id,
        ...pay,
      })
      if (verify.error) throw new Error(verify.error)
      setGroupHasChat(true)
      navigate('/dashboard/getaway/bookings?paid=1')
    } catch (e: any) {
      if (e?.message !== 'Payment cancelled') setError(e?.message || 'Could not join group')
    } finally {
      setBusy(false)
    }
  }

  const checkout = async () => {
    if (!userId || !trip) return
    setBusy(true)
    setError(null)
    try {
      const res = await wwApi.checkout(userId, {
        tripId: trip.id,
        paymentMode,
        buyerName: buyerName || user.email?.split('@')[0] || 'Guest',
        buyerEmail: user.email,
        buyerPhone,
        city,
        promoterCode: readGetawayRef(),
      })
      if (res.error || !res.data) {
        if (/already booked/i.test(res.error || '')) {
          setAlreadyBooked(true)
        }
        throw new Error(res.error || 'Checkout failed')
      }
      const pay = await openRazorpayCheckout({
        keyId: res.data.keyId,
        orderId: res.data.razorpayOrderId,
        amountPaise: res.data.amountPaise,
        name: 'WanderWorld',
        description: res.data.tripTitle,
        prefill: res.data.prefill,
      })
      const verify = await wwApi.verify(userId, {
        installmentId: res.data.installmentId,
        ...pay,
      })
      if (verify.error) throw new Error(verify.error)
      setPaySuccess('Payment received. See My bookings for details.')
      navigate('/dashboard/getaway/bookings?paid=1')
    } catch (e: any) {
      if (e?.message !== 'Payment cancelled') setError(e?.message || 'Checkout failed')
    } finally {
      setBusy(false)
    }
  }

  const payInstallment = async (installmentId: string) => {
    if (!userId) return
    setBusy(true)
    setError(null)
    try {
      const res = await wwApi.payInstallment(userId, installmentId)
      if (res.error || !res.data) throw new Error(res.error || 'Failed')
      const pay = await openRazorpayCheckout({
        keyId: res.data.keyId,
        orderId: res.data.razorpayOrderId,
        amountPaise: res.data.amountPaise,
        name: 'WanderWorld',
        description: res.data.tripTitle,
        prefill: res.data.prefill,
      })
      const verify = await wwApi.verify(userId, {
        installmentId: res.data.installmentId,
        ...pay,
      })
      if (verify.error) throw new Error(verify.error)
      await loadBookings()
    } catch (e: any) {
      if (e?.message !== 'Payment cancelled') setError(e?.message || 'Payment failed')
    } finally {
      setBusy(false)
    }
  }

  const spring = reduceMotion ? { duration: 0.15 } : { type: 'spring' as const, bounce: 0, duration: 0.4 }

  return (
    <div className="mx-auto w-full max-w-5xl px-1 pb-28 md:pb-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-start gap-4">
          <img
            src="/assets/brand-logos/wanderworld-holidays.png"
            alt="WanderWorld Holidays"
            className="hidden h-16 w-auto shrink-0 object-contain sm:block"
            decoding="async"
          />
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-white/35">WanderWorld</p>
            <h1 className="mt-1 text-3xl font-black tracking-tight text-white md:text-4xl">
              Join your getaway
            </h1>
            <p className="mt-2 max-w-md text-sm text-white/45">
              Curated trips. book full or on a plan when the trip allows it.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell />
          {view.kind !== 'catalog' && (
            <Link
              to="/dashboard/getaway"
              className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-white/10 px-4 text-[11px] font-black uppercase tracking-[0.18em] text-white transition active:scale-[0.97]"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Trips
            </Link>
          )}
          <Link
            to="/dashboard/getaway/bookings"
            className="inline-flex min-h-11 items-center rounded-2xl bg-clay px-4 text-[11px] font-black uppercase tracking-[0.18em] text-black transition active:scale-[0.97]"
          >
            My bookings
          </Link>
          {userId ? (
            <Link
              to="/dashboard/getaway/chat"
              className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-white/10 px-4 text-[11px] font-black uppercase tracking-[0.18em] text-white transition active:scale-[0.97]"
            >
              <MessageCircle className="h-3.5 w-3.5" /> Chat
            </Link>
          ) : null}
        </div>
      </div>

      {activeRef && view.kind === 'trip' && (
        <p className="mb-4 rounded-2xl border border-clay/20 bg-clay/10 px-4 py-2.5 text-xs text-clay/90">
          Referral <span className="font-mono">{activeRef}</span> applied at checkout.
        </p>
      )}

      {paySuccess && view.kind === 'bookings' && (
        <p className="mb-4 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {paySuccess}
        </p>
      )}

      {error && (
        <p className="mb-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs text-red-200">
          {error}
        </p>
      )}

      {loading && (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-clay" />
        </div>
      )}

      {!loading && view.kind === 'catalog' && (
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={spring}
          className="grid gap-4 sm:grid-cols-2"
        >
          {trips.map((t) => (
            <Link
              key={t.id}
              to={`/dashboard/getaway/${t.slug}`}
              className="group block overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.03] transition active:scale-[0.99]"
            >
              <div className="relative aspect-[16/10] bg-gradient-to-br from-emerald-900/40 via-[#0c1210] to-[#080808]">
                {t.coverImageUrl ? (
                  <img src={t.coverImageUrl} alt="" className="h-full w-full object-cover opacity-80" />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <Plane className="h-12 w-12 text-white/20" />
                  </div>
                )}
              </div>
              <div className="p-5">
                <h2 className="text-xl font-black tracking-tight text-white group-hover:text-clay">{t.title}</h2>
                <p className="mt-2 line-clamp-2 text-sm text-white/45">{t.description || 'Trip details inside.'}</p>
                <div className="mt-4 flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.15em] text-white/40">
                  <span>{formatInr(t.priceInr)}</span>
                  <span>
                    {t.seatsLeft} seats · {t.startDate}
                  </span>
                </div>
              </div>
            </Link>
          ))}
          {trips.length === 0 && (
            <p className="col-span-full py-16 text-center text-sm text-white/40">
              No published getaways yet. Check back soon.
            </p>
          )}
        </motion.div>
      )}

      {!loading && view.kind === 'trip' && trip && (
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={spring}
          className="grid gap-8 lg:grid-cols-[1.2fr_0.9fr]"
        >
          <div>
            <div className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-gradient-to-br from-emerald-900/30 to-[#080808]">
              <div className="aspect-[16/9]">
                {trip.coverImageUrl ? (
                  <img src={trip.coverImageUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <Plane className="h-16 w-16 text-white/15" />
                  </div>
                )}
              </div>
            </div>
            <h2 className="mt-6 text-3xl font-black tracking-tight text-white">{trip.title}</h2>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-white/55">{trip.description}</p>
            {trip.itinerary && (
              <>
                <h3 className="mt-8 font-mono text-[10px] uppercase tracking-[0.25em] text-white/35">Itinerary</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-white/55">{trip.itinerary}</p>
              </>
            )}
          </div>

          <div
            className="h-fit rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-5 lg:sticky lg:top-4"
            style={{ backdropFilter: 'blur(16px)' }}
          >
            <p className="text-3xl font-black text-white">{formatInr(trip.priceInr)}</p>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
              {trip.seatsLeft} seats left · {trip.startDate} → {trip.endDate}
            </p>

            {!alreadyBooked && trip.paymentPlansEnabled && (
              <div className="mt-5 grid grid-cols-2 gap-2">
                {(['full', 'plan'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setPaymentMode(mode)}
                    className={`min-h-11 rounded-2xl text-[11px] font-black uppercase tracking-[0.15em] transition active:scale-[0.97] ${
                      paymentMode === mode ? 'bg-clay text-black' : 'bg-white/10 text-white/60'
                    }`}
                  >
                    {mode === 'full' ? 'Pay full' : 'Payment plan'}
                  </button>
                ))}
              </div>
            )}

            {!alreadyBooked && paymentMode === 'plan' && trip.paymentPlansEnabled && (
              <ul className="mt-4 space-y-2 text-xs text-white/50">
                {trip.planTemplate.map((p, i) => (
                  <li key={i}>
                    {p.label}: {Math.round(p.percent * 100)}%
                    {p.daysBeforeStart != null ? ` · due ${p.daysBeforeStart}d before start` : ' · due now'}
                  </li>
                ))}
              </ul>
            )}

            {alreadyBooked ? (
              <div className="mt-5 space-y-3">
                <p className="rounded-2xl border border-clay/25 bg-clay/10 px-4 py-3 text-sm text-clay">
                  You’ve already booked this trip. Continue payment from My bookings.
                </p>
                <Link
                  to="/dashboard/getaway/bookings"
                  className="flex min-h-12 w-full items-center justify-center rounded-2xl bg-clay text-[11px] font-black uppercase tracking-[0.22em] text-black transition active:scale-[0.97]"
                >
                  Open my bookings
                </Link>
              </div>
            ) : !userId ? (
              <div className="mt-5 space-y-3">
                <p className="text-sm text-white/50">Sign in with your Yureka account to book and receive trip updates in your inbox.</p>
                <Link
                  to={`/login?next=${loginNext}`}
                  className="flex min-h-12 w-full items-center justify-center rounded-2xl bg-clay text-[11px] font-black uppercase tracking-[0.22em] text-black transition active:scale-[0.97]"
                >
                  Sign in to book
                </Link>
              </div>
            ) : (
              <>
                <div className="mt-5 space-y-3">
                  <input
                    className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3.5 text-sm text-white"
                    placeholder="Your name"
                    value={buyerName}
                    onChange={(e) => setBuyerName(e.target.value)}
                  />
                  <input
                    className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3.5 text-sm text-white"
                    placeholder="Phone"
                    value={buyerPhone}
                    onChange={(e) => setBuyerPhone(e.target.value)}
                  />
                  <input
                    className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3.5 text-sm text-white"
                    placeholder="City"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                  />
                </div>

                <button
                  type="button"
                  disabled={busy || trip.seatsLeft <= 0}
                  onClick={checkout}
                  className="mt-5 flex min-h-12 w-full items-center justify-center rounded-2xl bg-clay text-[11px] font-black uppercase tracking-[0.22em] text-black transition active:scale-[0.97] disabled:opacity-50"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : trip.seatsLeft <= 0 ? 'Sold out' : 'Continue to pay'}
                </button>
                <p className="mt-3 text-center text-[11px] text-white/35">Secure checkout via Razorpay</p>
              </>
            )}
          </div>

          {/* Mobile sticky CTA */}
          {!alreadyBooked && userId && (
            <div
              className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 p-3 md:hidden"
              style={{
                paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
                background: 'rgba(10,10,10,0.82)',
                backdropFilter: 'blur(20px)',
              }}
            >
              <button
                type="button"
                disabled={busy || trip.seatsLeft <= 0}
                onClick={checkout}
                className="flex min-h-12 w-full items-center justify-center rounded-2xl bg-clay text-[11px] font-black uppercase tracking-[0.22em] text-black active:scale-[0.97] disabled:opacity-50"
              >
                {busy ? 'Processing…' : `Pay ${formatInr(paymentMode === 'plan' ? trip.priceInr * (trip.planTemplate[0]?.percent || 0.3) : trip.priceInr)}`}
              </button>
            </div>
          )}
        </motion.div>
      )}

      {!loading && view.kind === 'group' && groupInvite && (
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={spring}
          className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.03]"
        >
          <div className="relative aspect-[16/9] bg-gradient-to-br from-emerald-900/40 via-[#0c1210] to-[#080808]">
            {groupInvite.trip.coverImageUrl ? (
              <img
                src={groupInvite.trip.coverImageUrl}
                alt=""
                className="h-full w-full object-cover opacity-80"
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <Plane className="h-12 w-12 text-white/20" />
              </div>
            )}
          </div>
          <div className="space-y-5 p-5 md:p-7">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-clay/90">
                Group invite · {groupInvite.joinCode}
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-white md:text-3xl">
                {groupInvite.trip.title}
              </h2>
              <p className="mt-2 text-sm text-white/50">
                Led by {groupInvite.leadName} · {groupInvite.groupSize} seats ·{' '}
                {groupInvite.seatsPaid} paid · {groupInvite.seatsOpen} open
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-black/30 px-4 py-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">Your share</p>
                <p className="mt-1 text-xl font-black text-white">{formatInr(groupInvite.perSeatInr)}</p>
              </div>
              <div className="rounded-2xl bg-black/30 px-4 py-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">Group total</p>
                <p className="mt-1 text-xl font-black text-white">{formatInr(groupInvite.amountDueInr)}</p>
              </div>
              <div className="rounded-2xl bg-black/30 px-4 py-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">Saved</p>
                <p className="mt-1 text-xl font-black text-clay">
                  {formatInr(groupInvite.discountInr || 0)}
                </p>
              </div>
            </div>

            <ul className="space-y-2">
              {groupInvite.shares.map((s) => (
                <li
                  key={s.sequence}
                  className="flex items-center justify-between rounded-2xl border border-white/8 bg-black/25 px-4 py-3 text-sm"
                >
                  <span className="text-white/70">
                    #{s.sequence} {s.claimedName || (s.claimed ? 'Claimed' : 'Open seat')}
                  </span>
                  <span
                    className={
                      s.isPaid ? 'text-emerald-300' : s.claimed ? 'text-amber-200' : 'text-white/40'
                    }
                  >
                    {s.isPaid ? 'Paid' : s.claimed ? 'Reserved' : 'Open'} · {formatInr(s.amountInr)}
                  </span>
                </li>
              ))}
            </ul>

            {!userId ? (
              <Link
                to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`}
                className="flex min-h-12 w-full items-center justify-center rounded-2xl bg-clay text-[11px] font-black uppercase tracking-[0.22em] text-black active:scale-[0.97]"
              >
                Sign in to join & pay
              </Link>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => void joinAndPayGroup()}
                className="flex min-h-12 w-full items-center justify-center rounded-2xl bg-clay text-[11px] font-black uppercase tracking-[0.22em] text-black active:scale-[0.97] disabled:opacity-50"
              >
                {busy
                  ? 'Processing…'
                  : `Join & pay ${formatInr(groupInvite.perSeatInr)}`}
              </button>
            )}
            <p className="text-center text-[12px] text-white/35">
              Each traveler pays only their seat. After paying, the booking shows under My bookings.
            </p>
            {userId && groupInvite.trip.slug && groupHasChat ? (
              <Link
                to={`/dashboard/getaway/chat/${groupInvite.trip.slug}`}
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] text-[11px] font-black uppercase tracking-[0.18em] text-white/70 transition active:scale-[0.97]"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                Open trip chat
              </Link>
            ) : userId ? (
              <p className="text-center text-[12px] text-white/35">
                Trip chat unlocks right after you join and pay your seat.
              </p>
            ) : null}
          </div>
        </motion.div>
      )}

      {!loading && view.kind === 'chat' && userId && (
        <WwTripChat
          userId={userId}
          userEmail={user.email}
          userName={buyerName || user.user_metadata?.full_name}
          tripRef={view.tripSlug}
          chatBasePath="/dashboard/getaway/chat"
          variant="getaway"
        />
      )}

      {!loading && view.kind === 'chat' && !userId && (
        <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-8 text-center">
          <p className="text-sm text-white/45">Sign in to access trip chat with your group.</p>
          <Link
            to={`/login?next=${encodeURIComponent(location.pathname)}`}
            className="mt-4 inline-flex min-h-11 items-center rounded-2xl bg-clay px-5 text-[11px] font-black uppercase tracking-[0.18em] text-black"
          >
            Sign in
          </Link>
        </div>
      )}

      {!loading && view.kind === 'bookings' && (
        <div className="space-y-4">
          {bookings.map(({ registration, trip: t, installments }) => {
            const cancelled = registration.status === 'cancelled'
            return (
            <div
              key={registration.id}
              className={`rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-5 ${
                cancelled ? 'opacity-55' : ''
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-xl font-black text-white">{t?.title || 'Trip'}</h2>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
                    {registration.status} · {registration.paymentMode}
                  </p>
                </div>
                <p className="text-sm text-white/50">
                  Paid {formatInr(registration.amountPaidInr)} / {formatInr(registration.amountDueInr)}
                </p>
              </div>
              {cancelled ? (
                <p className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/45">
                  This booking was cancelled. You can book this trip again if seats remain.
                </p>
              ) : (
              <ul className="mt-4 space-y-2">
                {installments.map((inst) => {
                  const overdue = inst.status === 'overdue'
                  const dueSoon =
                    inst.status === 'due' &&
                    inst.dueAt &&
                    new Date(inst.dueAt).getTime() - Date.now() < 3 * 86400000
                  return (
                  <li
                    key={inst.id}
                    className={`flex flex-wrap items-center justify-between gap-2 rounded-2xl px-4 py-3 ${
                      overdue
                        ? 'border border-red-500/25 bg-red-500/10'
                        : dueSoon
                          ? 'border border-amber-500/20 bg-amber-500/10'
                          : 'bg-black/30'
                    }`}
                  >
                    <div>
                      <p className="text-sm font-semibold text-white">
                        #{inst.sequence} {inst.label}
                      </p>
                      <p className={`text-xs ${overdue ? 'text-red-200/80' : 'text-white/40'}`}>
                        {formatInr(inst.amountInr)} · {inst.status}
                        {inst.dueAt ? ` · due ${inst.dueAt.slice(0, 10)}` : ''}
                      </p>
                    </div>
                    {inst.status === 'due' &&
                      (!registration.isGroup || inst.claimedByUserId === userId) && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => payInstallment(inst.id)}
                        className="min-h-11 rounded-xl bg-clay px-4 text-[10px] font-black uppercase tracking-[0.15em] text-black active:scale-[0.97] disabled:opacity-50"
                      >
                        Pay now
                      </button>
                    )}
                  </li>
                  )
                })}
              </ul>
              )}
              {!cancelled && t?.slug ? (
                <Link
                  to={`/dashboard/getaway/chat/${t.slug}`}
                  className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl bg-white/[0.06] px-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70 transition active:scale-[0.97]"
                >
                  <MessageCircle className="h-3.5 w-3.5" /> Trip chat
                </Link>
              ) : null}
            </div>
            )
          })}
          {bookings.length === 0 && (
            <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-8 text-center">
              <p className="text-sm text-white/45">No bookings yet.</p>
              <Link
                to="/dashboard/getaway"
                className="mt-4 inline-flex min-h-11 items-center rounded-2xl bg-clay px-5 text-[11px] font-black uppercase tracking-[0.18em] text-black"
              >
                Browse getaways
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default GetawayPage

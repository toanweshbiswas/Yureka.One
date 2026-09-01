import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, MessageCircle, Send, ArrowLeft, Plane, Users } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { wwApi } from '@backend/lib/wanderworld/client'
import type { WwChatMessage, WwChatThread } from '@backend/lib/wanderworld/types'
import { wwBtnPrimary, wwSurface, useWwMotion } from './wwUi'

function relativeTime(iso: string): string {
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return ''
  const sec = Math.round((Date.now() - t) / 1000)
  if (sec < 45) return 'Just now'
  if (sec < 3600) return `${Math.max(1, Math.floor(sec / 60))}m`
  if (sec < 86400) return `${Math.floor(sec / 3600)}h`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function roleBadge(role: WwChatMessage['authorRole']): string {
  if (role === 'owner' || role === 'admin') return 'Team'
  if (role === 'promoter') return 'Host'
  return ''
}

function renderThreadRow(t: WwChatThread) {
  return (
    <>
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-emerald-900/30">
        {t.coverImageUrl ? (
          <img src={t.coverImageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <MessageCircle className="m-auto h-6 w-6 text-white/25" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold text-white">{t.tripTitle}</p>
        <p className="mt-0.5 truncate text-[12px] text-white/40">
          {t.lastMessage
            ? `${t.lastMessage.authorName}: ${t.lastMessage.body}`
            : 'Tap to open chat — say hello'}
        </p>
      </div>
      <div className="shrink-0 text-right">
        {t.lastMessage ? (
          <p className="font-mono text-[10px] text-white/30">{relativeTime(t.lastMessage.createdAt)}</p>
        ) : null}
        <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.12em] text-white/25">
          {t.participantCount > 0 ? (
            <>
              <Users className="mr-0.5 inline h-3 w-3 opacity-60" />
              {t.participantCount} travelers
            </>
          ) : (
            'Open chat'
          )}
        </p>
      </div>
    </>
  )
}

type Props = {
  userId: string
  userEmail?: string
  userName?: string
  /** Trip id or slug when viewing a single thread */
  tripRef?: string | null
  /** Base path for thread links, e.g. /dashboard/getaway/chat */
  chatBasePath: string
  variant?: 'getaway' | 'portal'
  onBack?: () => void
  onSelectTrip?: (tripSlug: string) => void
}

export const WwTripChat: React.FC<Props> = ({
  userId,
  userEmail,
  userName,
  tripRef,
  chatBasePath,
  variant = 'getaway',
  onBack,
  onSelectTrip,
}) => {
  const { spring, springFast, reduce } = useWwMotion()
  const reduceMotion = useReducedMotion()
  const [threads, setThreads] = useState<WwChatThread[]>([])
  const [browseTrips, setBrowseTrips] = useState<
    { id: string; title: string; slug: string; coverImageUrl?: string | null }[]
  >([])
  const [hasBookings, setHasBookings] = useState(false)
  const [messages, setMessages] = useState<WwChatMessage[]>([])
  const [activeTrip, setActiveTrip] = useState<{ id: string; title: string; slug: string } | null>(
    null,
  )
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const lastTsRef = useRef<string | null>(null)

  const scrollToBottom = () => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }

  const loadThreads = useCallback(async () => {
    setLoading(true)
    setError(null)
    const [threadRes, bookingRes, tripRes] = await Promise.all([
      wwApi.chatThreads(userId),
      wwApi.bookings(userId),
      variant === 'getaway' ? wwApi.trips() : Promise.resolve({ data: null, error: null, status: 200 }),
    ])

    const fromApi = threadRes.data?.threads || []
    const bookingRows = bookingRes.data?.bookings || []
    setHasBookings(
      bookingRows.some((b) => b.registration?.status !== 'cancelled' && b.trip),
    )

    const merged = new Map<string, WwChatThread>()
    for (const t of fromApi) merged.set(t.tripId, t)
    for (const b of bookingRows) {
      if (!b.trip || b.registration.status === 'cancelled') continue
      if (!merged.has(b.trip.id)) {
        merged.set(b.trip.id, {
          tripId: b.trip.id,
          tripTitle: b.trip.title,
          tripSlug: b.trip.slug,
          coverImageUrl: b.trip.coverImageUrl || null,
          participantCount: 0,
          lastMessage: null,
        })
      }
    }
    setThreads([...merged.values()].sort((a, b) => a.tripTitle.localeCompare(b.tripTitle)))

    if (variant === 'getaway' && tripRes.data?.trips) {
      setBrowseTrips(
        tripRes.data.trips.map((t) => ({
          id: t.id,
          title: t.title,
          slug: t.slug,
          coverImageUrl: t.coverImageUrl,
        })),
      )
    }

    if (threadRes.error && !bookingRows.length) setError(threadRes.error)
    setLoading(false)
  }, [userId, variant])

  const loadMessages = useCallback(
    async (ref: string, since?: string) => {
      if (!since) setLoading(true)
      setError(null)
      const res = await wwApi.chatMessages(userId, ref, since)
      if (res.error) {
        setError(res.error)
        if (!since) setLoading(false)
        return
      }
      if (res.data?.trip) setActiveTrip(res.data.trip)
      const incoming = res.data?.messages || []
      if (since && incoming.length) {
        setMessages((prev) => {
          const ids = new Set(prev.map((m) => m.id))
          const merged = [...prev, ...incoming.filter((m) => !ids.has(m.id))]
          return merged.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        })
      } else {
        setMessages(incoming)
      }
      if (incoming.length) lastTsRef.current = incoming[incoming.length - 1].createdAt
      if (!since) setLoading(false)
      requestAnimationFrame(scrollToBottom)
    },
    [userId],
  )

  useEffect(() => {
    if (tripRef) void loadMessages(tripRef)
    else void loadThreads()
  }, [tripRef, loadMessages, loadThreads])

  useEffect(() => {
    if (!tripRef || !activeTrip) return
    const poll = setInterval(() => {
      if (lastTsRef.current) void loadMessages(tripRef, lastTsRef.current)
      else void loadMessages(tripRef)
    }, 8_000)
    return () => clearInterval(poll)
  }, [tripRef, activeTrip, loadMessages])

  const send = async () => {
    const text = draft.trim()
    if (!text || !tripRef) return
    setSending(true)
    setError(null)
    const res = await wwApi.sendChatMessage(userId, tripRef, text, userName)
    setSending(false)
    if (res.error || !res.data?.message) {
      setError(res.error || 'Could not send')
      return
    }
    setDraft('')
    setMessages((prev) => [...prev, res.data!.message])
    lastTsRef.current = res.data.message.createdAt
    requestAnimationFrame(scrollToBottom)
  }

  const glassPanel =
    variant === 'portal'
      ? `${wwSurface} flex flex-col overflow-hidden`
      : 'flex flex-col overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.04]'

  if (!tripRef) {
    return (
      <div className="space-y-4">
        {error && (
          <p className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs text-red-200">
            {error}
          </p>
        )}
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-7 w-7 animate-spin text-clay" />
          </div>
        ) : threads.length === 0 ? (
          <div className="space-y-4">
            <div className={`${glassPanel} p-8 text-center`} style={{ backdropFilter: 'blur(16px)' }}>
              <MessageCircle className="mx-auto h-10 w-10 text-white/20" />
              <p className="mt-4 text-sm font-semibold text-white/80">No trip chats yet</p>
              <p className="mt-2 text-sm text-white/45">
                {variant === 'getaway'
                  ? 'Book a getaway to unlock group chat with your fellow travelers and the WanderWorld team — all on Yureka, not WhatsApp.'
                  : 'Published trips you can access will appear here. Select a trip to start the conversation.'}
              </p>
              {variant === 'getaway' ? (
                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                  <Link
                    to="/dashboard/getaway"
                    className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-clay px-5 text-[11px] font-black uppercase tracking-[0.18em] text-black transition active:scale-[0.97]"
                  >
                    <Plane className="h-3.5 w-3.5" /> Browse getaways
                  </Link>
                  <Link
                    to="/dashboard/getaway/bookings"
                    className="inline-flex min-h-11 items-center rounded-2xl bg-white/10 px-5 text-[11px] font-black uppercase tracking-[0.18em] text-white transition active:scale-[0.97]"
                  >
                    My bookings
                  </Link>
                </div>
              ) : null}
            </div>

            {variant === 'getaway' && browseTrips.length > 0 ? (
              <div className="space-y-2">
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/35">
                  Open getaways — book to join chat
                </p>
                {browseTrips.map((t) => (
                  <Link
                    key={t.id}
                    to={`/dashboard/getaway/${t.slug}`}
                    className={`${glassPanel} flex items-center gap-4 p-4 transition active:scale-[0.99]`}
                    style={{ backdropFilter: 'blur(12px)' }}
                  >
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-emerald-900/30">
                      {t.coverImageUrl ? (
                        <img src={t.coverImageUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <Plane className="m-auto h-5 w-5 text-white/25" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-semibold text-white">{t.title}</p>
                      <p className="text-[12px] text-white/40">Book this trip → chat unlocks instantly</p>
                    </div>
                    <span className="shrink-0 rounded-xl bg-white/[0.08] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-clay">
                      Book
                    </span>
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="space-y-3">
            {!hasBookings && variant === 'getaway' ? (
              <p className="rounded-2xl border border-clay/20 bg-clay/10 px-4 py-2.5 text-xs text-clay/90">
                Tap a trip below to open chat. You can message even before anyone else has posted.
              </p>
            ) : null}
            <div className="space-y-2">
            {threads.map((t) =>
              onSelectTrip ? (
                <button
                  key={t.tripId}
                  type="button"
                  onClick={() => onSelectTrip(t.tripSlug)}
                  className={`${glassPanel} flex w-full items-center gap-4 p-4 text-left transition active:scale-[0.99]`}
                  style={{ backdropFilter: 'blur(12px)' }}
                >
                  {renderThreadRow(t)}
                </button>
              ) : (
                <Link
                  key={t.tripId}
                  to={`${chatBasePath}/${t.tripSlug}`}
                  className={`${glassPanel} flex items-center gap-4 p-4 transition active:scale-[0.99]`}
                  style={{ backdropFilter: 'blur(12px)' }}
                >
                  {renderThreadRow(t)}
                </Link>
              ),
            )}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={`${glassPanel} min-h-[420px] max-h-[min(72vh,640px)]`} style={{ backdropFilter: 'blur(16px)' }}>
      <div
        className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-3"
        style={{ backdropFilter: 'blur(20px)' }}
      >
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-xl bg-white/[0.06] text-white/60 transition active:scale-[0.97]"
            aria-label="Back to chats"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        ) : (
          <Link
            to={chatBasePath}
            className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-xl bg-white/[0.06] text-white/60 transition active:scale-[0.97]"
            aria-label="Back to chats"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold tracking-[-0.02em] text-white">
            {activeTrip?.title || 'Trip chat'}
          </p>
          <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-white/35">
            Group & team · on Yureka
          </p>
        </div>
      </div>

      {error && (
        <p className="mx-4 mt-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {error}
        </p>
      )}

      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-clay" />
          </div>
        ) : messages.length === 0 ? (
          <div className="py-10 text-center">
            <MessageCircle className="mx-auto h-8 w-8 text-white/15" />
            <p className="mt-3 text-sm text-white/50">You’re the first here.</p>
            <p className="mt-1 text-xs text-white/35">
              Say hello — your group and WanderWorld hosts will see it in their inbox too.
            </p>
          </div>
        ) : (
          messages.map((m) => {
            const mine = m.authorUserId === userId || m.authorEmail === userEmail
            const badge = roleBadge(m.authorRole)
            return (
              <motion.div
                key={m.id}
                initial={reduceMotion || reduce ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={springFast}
                className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 ${
                    mine
                      ? 'rounded-br-md bg-clay/90 text-black'
                      : 'rounded-bl-md bg-white/[0.08] text-white/90'
                  }`}
                >
                  {!mine && (
                    <p className="mb-0.5 text-[11px] font-semibold text-white/55">
                      {m.authorName}
                      {badge ? (
                        <span className="ml-1.5 font-mono text-[9px] uppercase tracking-[0.1em] text-clay/80">
                          {badge}
                        </span>
                      ) : null}
                    </p>
                  )}
                  <p className="whitespace-pre-wrap text-[14px] leading-snug">{m.body}</p>
                  <p
                    className={`mt-1 font-mono text-[9px] ${
                      mine ? 'text-black/45' : 'text-white/30'
                    }`}
                  >
                    {relativeTime(m.createdAt)}
                  </p>
                </div>
              </motion.div>
            )
          })
        )}
      </div>

      <div
        className="border-t border-white/[0.06] p-3"
        style={{ paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="flex items-end gap-2">
          <textarea
            rows={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void send()
              }
            }}
            placeholder="Message your group…"
            className="max-h-28 min-h-[44px] flex-1 resize-none rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm text-white placeholder:text-white/30"
          />
          <button
            type="button"
            disabled={sending || !draft.trim()}
            onPointerDown={() => {}}
            onClick={() => void send()}
            className={`${wwBtnPrimary} !min-h-11 !min-w-11 !rounded-2xl !px-0 disabled:opacity-45`}
            aria-label="Send message"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default WwTripChat

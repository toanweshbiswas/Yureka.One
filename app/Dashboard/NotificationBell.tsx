import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import { Check, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useSupabase } from '@shared/SupabaseProvider'
import Icon3d from '@shared/Icon3d'
import { api, isApiError } from '@backend/lib/api/client'

type InboxNotification = {
  id: string
  title: string
  body: string
  type?: string
  href?: string | null
  imageUrl?: string | null
  readAt?: string | null
  createdAt?: string
}

const springSettle = { type: 'spring' as const, bounce: 0, duration: 0.38 }
const springSnappy = { type: 'spring' as const, bounce: 0, duration: 0.28 }

function relativeTime(iso?: string): string {
  if (!iso) return ''
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return ''
  const sec = Math.round((Date.now() - t) / 1000)
  if (sec < 45) return 'Just now'
  if (sec < 3600) return `${Math.max(1, Math.floor(sec / 60))}m ago`
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`
  if (sec < 86400 * 7) return `${Math.floor(sec / 86400)}d ago`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/** Shared inbox bell — Home + dashboard chrome. */
const NotificationBell: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { user } = useSupabase()
  const navigate = useNavigate()
  const reduceMotion = useReducedMotion()
  const [notifications, setNotifications] = useState<InboxNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [panelTop, setPanelTop] = useState(72)
  const [panelRight, setPanelRight] = useState(12)
  const rootRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const applyInbox = (payload: { items?: InboxNotification[]; unreadCount?: number } | InboxNotification[] | null | undefined) => {
    const raw = Array.isArray(payload) ? payload : payload?.items || []
    const myEmail = String(user?.email || '').trim().toLowerCase()
    const items = raw.filter((n: any) => {
      const nEmail = String(n.email || '').trim().toLowerCase()
      const nUid = String(n.userId || '').trim().toLowerCase()
      if (myEmail && nEmail && nEmail !== myEmail) return false
      if (myEmail && nUid.includes('@') && nUid !== myEmail) return false
      return true
    })
    const unread = Array.isArray(payload)
      ? items.filter((n) => !n.readAt).length
      : typeof payload?.unreadCount === 'number'
        ? Math.min(payload.unreadCount, items.filter((n) => !n.readAt).length)
        : items.filter((n) => !n.readAt).length
    setNotifications(items)
    setUnreadCount(unread)
  }

  const authHeaders = user?.id ? { 'x-user-id': user.id } : undefined

  useEffect(() => {
    if (!user?.id && !user?.email) return
    let cancelled = false
    let failures = 0
    let timer: ReturnType<typeof setTimeout> | null = null

    const schedule = (ms: number) => {
      if (cancelled) return
      timer = setTimeout(() => void load(), ms)
    }

    const load = async () => {
      setLoading(true)
      const res = await api.get<{ items: InboxNotification[]; unreadCount: number }>(
        '/api/notifications',
        { headers: authHeaders, timeoutMs: 8000 },
      )
      if (!cancelled) {
        if (!isApiError(res) && res.data) {
          applyInbox(res.data)
          failures = 0
        } else {
          failures += 1
        }
        setLoading(false)
        // Back off when API is down (502) so the console isn't spammed every 30s.
        schedule(failures >= 2 ? 120_000 : 30_000)
      }
    }

    void load()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [user?.id, user?.email])

  useEffect(() => {
    if (!isOpen) return
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null
      if (!target) return
      if (rootRef.current?.contains(target)) return
      if (panelRef.current?.contains(target)) return
      setIsOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKey)
    }
  }, [isOpen])

  const placePanel = () => {
    const rect = rootRef.current?.getBoundingClientRect()
    if (!rect) {
      setPanelTop(72)
      setPanelRight(12)
      return
    }
    setPanelTop(Math.max(rect.bottom + 8, 16))
    setPanelRight(Math.max(window.innerWidth - rect.right, 12))
  }

  const handleOpen = async () => {
    const next = !isOpen
    if (next) placePanel()
    setIsOpen(next)
    if (next && unreadCount > 0) {
      setUnreadCount(0)
      const res = await api.patch<{ items: InboxNotification[]; unreadCount: number }>(
        '/api/notifications/read-all',
        {},
        { headers: authHeaders },
      )
      if (!isApiError(res) && res.data) applyInbox(res.data)
    }
  }

  const handleOpenItem = async (n: InboxNotification) => {
    setNotifications((prev) => prev.filter((x) => x.id !== n.id))
    if (n.href && n.href.startsWith('/')) {
      setIsOpen(false)
      navigate(n.href)
    }
    await api.post(`/api/notifications/${n.id}/dismiss`, {}, { headers: authHeaders })
  }

  const handleDismiss = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    setNotifications((prev) => prev.filter((n) => n.id !== id))
    const res = await api.post<{ items: InboxNotification[]; unreadCount: number }>(
      `/api/notifications/${id}/dismiss`,
      {},
      { headers: authHeaders },
    )
    if (!isApiError(res) && res.data) applyInbox(res.data)
  }

  const panelEnter = reduceMotion
    ? { opacity: 0 }
    : { opacity: 0, y: 8, scale: 0.96 }
  const panelSettle = reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }

  const overlay =
    typeof document !== 'undefined'
      ? createPortal(
          <AnimatePresence>
            {isOpen && (
              <>
                <motion.button
                  type="button"
                  aria-label="Close notifications"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: reduceMotion ? 0.15 : 0.22 }}
                  onClick={() => setIsOpen(false)}
                  className="fixed inset-0 z-[90] cursor-default bg-black/45"
                />
                <motion.div
                  ref={panelRef}
                  role="dialog"
                  aria-label="Notifications"
                  initial={panelEnter}
                  animate={panelSettle}
                  exit={panelEnter}
                  transition={springSettle}
                  style={{
                    top: panelTop,
                    right: panelRight,
                    transformOrigin: 'top right',
                  }}
                  className="fixed z-[95] w-[min(22.5rem,calc(100vw-1.5rem))] overflow-hidden rounded-[1.35rem] border border-white/12 bg-black/72 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl backdrop-saturate-150"
                >
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent" />
                  <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
                    <div>
                      <h3 className="text-[15px] font-semibold tracking-[-0.02em] text-white">Inbox</h3>
                      <p className="mt-0.5 text-[12px] text-white/40">
                        {loading && notifications.length === 0
                          ? 'Updating…'
                          : notifications.length === 0
                            ? 'You’re all caught up'
                            : `${notifications.length} ${notifications.length === 1 ? 'update' : 'updates'}`}
                      </p>
                    </div>
                    {notifications.length > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-clay/15 px-2.5 py-1 text-[11px] font-semibold text-clay">
                        <Check size={12} strokeWidth={2.5} />
                        Live
                      </span>
                    )}
                  </div>

                  <div className="dashboard-scroll max-h-[min(60vh,28rem)] overflow-y-auto overscroll-contain p-2">
                    {notifications.length === 0 ? (
                      <div className="flex flex-col items-center px-6 py-12 text-center">
                        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.04] ring-1 ring-white/10">
                          <Icon3d name="megaphone" className="h-6 w-6 object-contain opacity-50" alt="" />
                        </div>
                        <p className="text-[14px] font-semibold tracking-[-0.02em] text-white/80">
                          {loading ? 'Fetching updates' : 'Nothing new'}
                        </p>
                        <p className="mt-1.5 max-w-[16rem] text-[12.5px] leading-relaxed text-white/40">
                          Approvals, Goldback, and product notes land here when they arrive.
                        </p>
                      </div>
                    ) : (
                      <motion.ul
                        className="space-y-1"
                        initial="hidden"
                        animate="show"
                        variants={{
                          hidden: {},
                          show: {
                            transition: reduceMotion
                              ? {}
                              : { staggerChildren: 0.035, delayChildren: 0.04 },
                          },
                        }}
                      >
                        {notifications.map((n) => (
                          <motion.li
                            key={n.id}
                            variants={{
                              hidden: reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 },
                              show: { opacity: 1, y: 0, transition: springSnappy },
                            }}
                          >
                            <div
                              role="button"
                              tabIndex={0}
                              onClick={() => void handleOpenItem(n)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault()
                                  void handleOpenItem(n)
                                }
                              }}
                              className="group relative flex cursor-pointer flex-col gap-2.5 rounded-[1.1rem] p-3.5 transition-colors hover:bg-white/[0.04] active:bg-white/[0.06]"
                            >
                              <button
                                type="button"
                                onClick={(e) => void handleDismiss(e, n.id)}
                                className="absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full text-white/25 opacity-80 transition-colors hover:bg-white/10 hover:text-white/80 active:scale-95"
                                aria-label="Dismiss notification"
                              >
                                <X size={13} strokeWidth={2.25} />
                              </button>
                              <div className="flex gap-3 pr-7">
                                <div
                                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                                    n.readAt ? 'bg-white/18' : 'bg-clay'
                                  }`}
                                  aria-hidden
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-baseline justify-between gap-2">
                                    <h4 className="text-[13.5px] font-semibold tracking-[-0.015em] text-white">
                                      {n.title}
                                    </h4>
                                    <time className="shrink-0 text-[11px] tabular-nums text-white/30">
                                      {relativeTime(n.createdAt)}
                                    </time>
                                  </div>
                                  <p className="mt-1 text-[12.5px] leading-relaxed text-white/55">{n.body}</p>
                                </div>
                              </div>
                              {n.imageUrl && (
                                <div className="relative ml-5 overflow-hidden rounded-xl border border-white/8">
                                  <img src={n.imageUrl} alt="" className="h-28 w-full object-cover" />
                                </div>
                              )}
                            </div>
                          </motion.li>
                        ))}
                      </motion.ul>
                    )}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>,
          document.body,
        )
      : null

  return (
    <div ref={rootRef} className={`relative z-[100] ${className}`}>
      <motion.button
        type="button"
        onClick={() => void handleOpen()}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        whileTap={{ scale: 0.96 }}
        transition={springSnappy}
        className={`relative flex h-11 w-11 items-center justify-center rounded-2xl border text-white/40 transition-colors ${
          isOpen
            ? 'border-white/20 bg-white/[0.08] text-white'
            : 'border-white/10 bg-white/[0.03] hover:border-white/18 hover:text-white/80'
        }`}
      >
        <Icon3d
          name="megaphone"
          className={`h-[22px] w-[22px] object-contain transition-transform duration-200 ${
            isOpen ? 'scale-105' : ''
          }`}
          alt=""
        />
        <AnimatePresence>
          {unreadCount > 0 && (
            <motion.span
              key="badge"
              initial={reduceMotion ? { opacity: 0 } : { scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.6, opacity: 0 }}
              transition={springSnappy}
              className="absolute -right-1 -top-1 flex h-[1.15rem] min-w-[1.15rem] items-center justify-center rounded-full bg-clay px-1 text-[9px] font-bold tabular-nums leading-none text-black"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
      {overlay}
    </div>
  )
}

export default NotificationBell

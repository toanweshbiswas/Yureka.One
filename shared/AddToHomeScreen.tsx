import React, { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Download, Share, X, Smartphone } from 'lucide-react'
import { resolveSiteRole } from '@shared/hosts'
import { isIosDevice, isLikelyMobile, isStandalonePwa } from '@shared/pwaDisplay'

const STORAGE_KEY = 'yureka-a2hs-dismissed-v1'
const DISMISS_MS = 1000 * 60 * 60 * 24 * 3 // 3 days
const SESSION_SHOWN = 'yureka-a2hs-shown-session'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isStandalone(): boolean {
  return isStandalonePwa()
}

function wasDismissedRecently(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return false
    const ts = Number(raw)
    if (!Number.isFinite(ts)) return false
    return Date.now() - ts < DISMISS_MS
  } catch {
    return false
  }
}

function markDismissed() {
  try {
    localStorage.setItem(STORAGE_KEY, String(Date.now()))
  } catch {
    /* ignore */
  }
}

function markSessionShown() {
  try {
    sessionStorage.setItem(SESSION_SHOWN, '1')
  } catch {
    /* ignore */
  }
}

function wasShownThisSession(): boolean {
  try {
    return sessionStorage.getItem(SESSION_SHOWN) === '1'
  } catch {
    return false
  }
}

/** Register minimal SW so Chrome can fire beforeinstallprompt. */
export function registerInstallServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
  // Avoid fighting Vite HMR in local dev
  if (import.meta.env.DEV) return
  const run = () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  }
  if (document.readyState === 'complete') run()
  else window.addEventListener('load', run, { once: true })
}

type Props = {
  /** Force the instructions sheet open (e.g. from Profile). */
  forceOpen?: boolean
  onCloseForced?: () => void
  /** Compact header control instead of floating banner. */
  mode?: 'banner' | 'button'
  /** Lift banner above the mobile dashboard tab bar. */
  liftForTabBar?: boolean
}

const AddToHomeScreen: React.FC<Props> = ({ forceOpen = false, onCloseForced, mode = 'banner', liftForTabBar = false }) => {
  const role = resolveSiteRole()
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [iosHint, setIosHint] = useState(false)

  const closeAll = useCallback(() => {
    setVisible(false)
    setSheetOpen(false)
    onCloseForced?.()
  }, [onCloseForced])

  const dismiss = useCallback(() => {
    markDismissed()
    closeAll()
  }, [closeAll])

  const showBanner = useCallback(() => {
    if (isStandalone() || wasDismissedRecently()) return
    setVisible(true)
    markSessionShown()
  }, [])

  useEffect(() => {
    if (isStandalone()) return
    // Marketing landing host intentionally skips — product app / localhost only
    if (role === 'landing') return

    registerInstallServiceWorker()

    const onBip = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
      showBanner()
    }
    window.addEventListener('beforeinstallprompt', onBip)

    // Soft prompt on mobile app shell — BIP often never fires without engagement heuristics
    const t = window.setTimeout(() => {
      if (wasShownThisSession() && !isIosDevice()) return
      if (!isLikelyMobile()) return
      setIosHint(isIosDevice())
      showBanner()
    }, 1200)

    return () => {
      window.removeEventListener('beforeinstallprompt', onBip)
      window.clearTimeout(t)
    }
  }, [role, showBanner])

  useEffect(() => {
    if (forceOpen) {
      setSheetOpen(true)
      setIosHint(isIosDevice() || !deferred)
    }
  }, [forceOpen, deferred])

  const installNative = async () => {
    if (!deferred) {
      setSheetOpen(true)
      setIosHint(true)
      return
    }
    await deferred.prompt()
    const choice = await deferred.userChoice
    setDeferred(null)
    if (choice.outcome === 'accepted') {
      markDismissed()
      closeAll()
    } else {
      dismiss()
    }
  }

  const openHowTo = () => {
    setSheetOpen(true)
    setIosHint(true)
  }

  if (mode === 'button') {
    if (isStandalone()) return null
    return (
      <>
        <button
          type="button"
          onPointerDown={() => {}}
          onClick={deferred ? () => void installNative() : openHowTo}
          className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-[10px] font-black uppercase tracking-[0.18em] text-white/70 active:scale-[0.97] transition-transform duration-100"
          aria-label="Add Yureka to Home Screen"
        >
          <Smartphone size={14} className="text-clay" />
          Home screen
        </button>
        <InstallSheet
          open={sheetOpen || forceOpen}
          ios={iosHint || isIosDevice()}
          onClose={() => {
            setSheetOpen(false)
            onCloseForced?.()
          }}
          onInstall={deferred ? () => void installNative() : undefined}
        />
      </>
    )
  }

  return (
    <>
      <AnimatePresence>
        {visible && !sheetOpen && !forceOpen && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
            className={`fixed z-[90] left-3 right-3 md:left-auto md:right-6 md:w-[22rem] md:bottom-6 ${
              liftForTabBar
                ? 'bottom-[calc(5.25rem+env(safe-area-inset-bottom,0px))]'
                : 'bottom-[calc(1.25rem+env(safe-area-inset-bottom,0px))]'
            }`}
          >
            <div className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#0c0c0c]/92 backdrop-blur-2xl shadow-[0_24px_64px_rgba(0,0,0,0.55)]">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
              <div className="flex items-start gap-3 p-4 pr-12">
                <div className="w-11 h-11 rounded-2xl bg-clay/15 border border-clay/25 flex items-center justify-center shrink-0">
                  <Download size={18} className="text-clay" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-bold text-white tracking-tight">Add Yureka to Home Screen</p>
                  <p className="mt-1 text-[12px] leading-relaxed text-white/50">
                    Open it like an app — full screen, one tap away.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void (deferred ? installNative() : openHowTo())}
                      className="inline-flex items-center justify-center rounded-xl bg-clay px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.18em] text-black active:scale-[0.97] transition-transform duration-100"
                    >
                      {deferred ? 'Install' : 'How to'}
                    </button>
                    <button
                      type="button"
                      onClick={dismiss}
                      className="inline-flex items-center justify-center rounded-xl border border-white/10 px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.18em] text-white/45 active:scale-[0.97] transition-transform duration-100"
                    >
                      Not now
                    </button>
                  </div>
                </div>
              </div>
              <button
                type="button"
                aria-label="Dismiss"
                onClick={dismiss}
                className="absolute top-3 right-3 w-9 h-9 rounded-xl flex items-center justify-center text-white/35 hover:text-white active:scale-[0.97]"
              >
                <X size={16} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <InstallSheet
        open={sheetOpen || forceOpen}
        ios={iosHint || isIosDevice()}
        onClose={() => {
          setSheetOpen(false)
          onCloseForced?.()
        }}
        onInstall={deferred ? () => void installNative() : undefined}
      />
    </>
  )
}

function InstallSheet({
  open,
  ios,
  onClose,
  onInstall,
}: {
  open: boolean
  ios: boolean
  onClose: () => void
  onInstall?: () => void
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            aria-label="Close"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] bg-black/65 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="a2hs-title"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', bounce: 0.15, duration: 0.45 }}
            className="fixed z-[110] inset-x-0 bottom-0 max-h-[min(85dvh,36rem)] rounded-t-[1.75rem] border border-white/10 border-b-0 bg-[#0e0e0e]/96 backdrop-blur-2xl shadow-[0_-24px_80px_rgba(0,0,0,0.55)]"
            style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="h-1 w-10 rounded-full bg-white/20" />
            </div>
            <div className="px-6 pt-2 pb-2 flex items-start justify-between gap-3">
              <div>
                <h2 id="a2hs-title" className="text-lg font-black tracking-tight text-white">
                  Add to Home Screen
                </h2>
                <p className="mt-1 text-[13px] text-white/45 leading-relaxed">
                  Keep Yureka one tap away — works offline-ready as a home icon.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-10 h-10 rounded-2xl border border-white/10 flex items-center justify-center text-white/40 active:scale-[0.97]"
                aria-label="Close sheet"
              >
                <X size={16} />
              </button>
            </div>

            <div className="px-6 pb-4 space-y-3">
              {onInstall && !ios ? (
                <button
                  type="button"
                  onClick={onInstall}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl bg-clay py-3.5 text-[11px] font-black uppercase tracking-[0.2em] text-black active:scale-[0.98] transition-transform duration-100"
                >
                  <Download size={16} />
                  Install Yureka
                </button>
              ) : (
                <ol className="space-y-3">
                  <Step n={1}>
                    Tap the <Share className="inline mx-1 text-clay" size={14} aria-hidden /> <strong className="text-white/80">Share</strong> button in Safari
                  </Step>
                  <Step n={2}>
                    Scroll and choose <strong className="text-white/80">Add to Home Screen</strong>
                  </Step>
                  <Step n={3}>
                    Tap <strong className="text-white/80">Add</strong> — Yureka appears on your Home Screen
                  </Step>
                </ol>
              )}
              {!onInstall && !ios && (
                <p className="text-[12px] text-white/40 leading-relaxed">
                  In Chrome: open the browser menu → <strong className="text-white/70">Install app</strong> or <strong className="text-white/70">Add to Home screen</strong>.
                </p>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3 items-start rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-3.5">
      <span className="w-7 h-7 rounded-xl bg-clay/15 text-clay text-[11px] font-black flex items-center justify-center shrink-0">
        {n}
      </span>
      <p className="text-[13px] text-white/55 leading-relaxed pt-0.5">{children}</p>
    </li>
  )
}

export default AddToHomeScreen
export { isStandalone }

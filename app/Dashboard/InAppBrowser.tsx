import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'motion/react'
import { ChevronLeft, ExternalLink, RotateCw } from 'lucide-react'
import {
  browseHost,
  embedFrameSrc,
  needsFirstPartyCookies,
  sanitizeBrowseUrl,
} from '@shared/inAppBrowse'
import { openTrackedStore } from '@shared/trackedBrowse'
import { systemBrowserLabel } from '@shared/pwaDisplay'
import { useSupabase } from '@shared/SupabaseProvider'
import { InAppGiftCardBar } from './InAppGiftCardBar'

const spring = { type: 'spring' as const, bounce: 0, duration: 0.35 }

function readIframePageUrl(iframe: HTMLIFrameElement | null): string | null {
  if (!iframe) return null
  try {
    return sanitizeBrowseUrl(iframe.contentWindow?.location.href)
  } catch {
    return null
  }
}

function iframeLooksBlocked(iframe: HTMLIFrameElement): boolean {
  try {
    const win = iframe.contentWindow
    if (!win) return true
    const href = win.location.href
    if (!href || href === 'about:blank') return true
    const doc = iframe.contentDocument
    if (doc) {
      const body = doc.body
      if (!body || !body.innerHTML.trim()) return true
      const text = (body.innerText || '').slice(0, 400)
      if (/refused to connect|blocked by|err_blocked|cannot be displayed|x-frame-options/i.test(text)) {
        return true
      }
    }
    return false
  } catch {
    // Cross-origin success looks the same as a blocked opaque frame.
    return false
  }
}

type Props = {
  src?: string
  title?: string
  returnTo?: string
  brands?: { name: string; src: string }[]
  activeBrand?: string
  onBrand?: (name: string) => void
  extra?: React.ReactNode
}

export function InAppBrowserFrame({
  src,
  title,
  returnTo = '/dashboard/home',
  brands,
  activeBrand,
  onBrand,
  extra,
}: Props) {
  const { user } = useSupabase()
  const navigate = useNavigate()
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [frameKey, setFrameKey] = useState(0)
  const [loading, setLoading] = useState(true)
  const [embedFailed, setEmbedFailed] = useState(false)
  const [pageUrl, setPageUrl] = useState<string | null>(null)
  const safeSrc = sanitizeBrowseUrl(src)
  const frameSrc = embedFrameSrc(safeSrc)
  const host = browseHost(safeSrc)
  // Flipkart/Amazon never iframe. cookies/login break in third-party frames.
  const cookieHost = needsFirstPartyCookies(safeSrc)
  const allowEmbed = Boolean(frameSrc) && !cookieHost
  const useExternal = Boolean(safeSrc && (!frameSrc || embedFailed || cookieHost))
  const storeName = title || host || 'this store'

  const openOutside = useCallback(() => {
    // Explicit user choice only. Android → Chrome; iOS → https (may still UL if app installed).
    void openTrackedStore(safeSrc || '', user?.id || '', undefined, undefined, { preferWeb: true })
  }, [safeSrc, user?.id])

  const browserName = systemBrowserLabel()

  useEffect(() => {
    setEmbedFailed(false)
    setLoading(Boolean(frameSrc) && !cookieHost)
    setPageUrl(safeSrc)
  }, [frameSrc, frameKey, safeSrc, cookieHost])

  const syncIframeUrl = useCallback(() => {
    const live = readIframePageUrl(iframeRef.current)
    if (live) setPageUrl(live)
    else if (safeSrc) setPageUrl(safeSrc)
  }, [safeSrc])

  useEffect(() => {
    if (!frameSrc || useExternal) return
    // Fail faster on blank/blocked frames so Android doesn’t sit on a white loader.
    const t = window.setTimeout(() => {
      const el = iframeRef.current
      if (el && iframeLooksBlocked(el)) setEmbedFailed(true)
      setLoading(false)
    }, 2800)
    return () => window.clearTimeout(t)
  }, [frameSrc, frameKey, useExternal])

  useEffect(() => {
    if (!frameSrc || useExternal) return
    const id = window.setInterval(() => syncIframeUrl(), 2500)
    return () => window.clearInterval(id)
  }, [frameSrc, useExternal, syncIframeUrl])

  useEffect(() => {
    if (useExternal) setLoading(false)
  }, [useExternal])

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-[#070707]">
      <div className="flex shrink-0 items-center gap-2 border-b border-white/[0.08] bg-[#0c0d10]/90 px-2 py-2 backdrop-blur-xl">
        <motion.button
          type="button"
          whileTap={{ scale: 0.94 }}
          transition={spring}
          aria-label="Back"
          onClick={() => {
            const dest = returnTo || '/dashboard/browse'
            navigate(dest)
            // Layout restores scroll/hash after the route settles.
            window.setTimeout(() => {
              void import('@shared/dashboardScroll').then((m) => {
                m.restoreDashboardPosition({
                  pathname: dest.split('?')[0].split('#')[0],
                  hash: dest.includes('#') ? dest.slice(dest.indexOf('#')) : '',
                })
              })
            }, 30)
          }}
          className="flex h-11 w-11 items-center justify-center rounded-full text-white/80 hover:bg-white/[0.08]"
        >
          <ChevronLeft size={22} />
        </motion.button>
        <div className="min-w-0 flex-1 px-1">
          <p className="truncate text-[17px] font-semibold tracking-[-0.03em] text-white">
            {storeName}
          </p>
        </div>
        {safeSrc && (
          <motion.button
            type="button"
            whileTap={{ scale: 0.94 }}
            transition={spring}
            aria-label={`Open in ${browserName}`}
            onClick={openOutside}
            className="flex h-11 w-11 items-center justify-center rounded-full text-white/55 hover:bg-white/[0.08] hover:text-white"
          >
            <ExternalLink size={16} />
          </motion.button>
        )}
        {frameSrc && !useExternal && (
          <motion.button
            type="button"
            whileTap={{ scale: 0.94 }}
            transition={spring}
            aria-label="Reload page"
            onClick={() => {
              setLoading(true)
              setEmbedFailed(false)
              setFrameKey((k) => k + 1)
            }}
            className="flex h-11 w-11 items-center justify-center rounded-full text-white/55 hover:bg-white/[0.08] hover:text-white"
          >
            <RotateCw size={16} />
          </motion.button>
        )}
      </div>

      {brands && brands.length > 0 && (
        <div className="flex shrink-0 gap-2 overflow-x-auto px-3 py-2.5">
          {brands.map((brand) => {
            const on = brand.name === activeBrand
            return (
              <motion.button
                key={brand.name}
                type="button"
                whileTap={{ scale: 0.97 }}
                transition={spring}
                onClick={() => onBrand?.(brand.name)}
                className={`shrink-0 rounded-full px-3.5 py-2 text-[13px] font-semibold ${
                  on ? 'bg-white text-black' : 'bg-white/[0.08] text-white/70'
                }`}
              >
                {brand.name}
              </motion.button>
            )
          })}
          {extra}
        </div>
      )}

      <div className="relative min-h-0 flex-1 bg-[#070707]">
        {useExternal ? (
          <div className="flex h-full flex-col items-center justify-center px-7 text-center">
            <p className="max-w-[20rem] text-[17px] font-semibold tracking-[-0.03em] text-white">
              {cookieHost ? `${storeName} needs a full browser for login` : `${storeName} can’t load inside Yureka`}
            </p>
            <p className="mt-2 max-w-[20rem] text-[14px] leading-snug text-white/50">
              {cookieHost
                ? `Login cookies only work in a top-level ${browserName} tab. not inside Yureka.`
                : `This store blocks embedded browsing. Stay here, or open it in ${browserName}.`}
            </p>
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              transition={spring}
              onClick={openOutside}
              className="mt-6 min-h-[44px] rounded-full bg-white px-6 text-[15px] font-semibold text-black"
            >
              Open in {browserName}
            </motion.button>
            {host && <InAppGiftCardBar pageUrl={pageUrl} host={host} />}
          </div>
        ) : (
          <>
            {loading && frameSrc && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-white">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-black/10 border-t-black/45" />
              </div>
            )}
            {allowEmbed && frameSrc ? (
              <iframe
                ref={iframeRef}
                key={`${frameSrc}-${frameKey}`}
                title={storeName}
                src={frameSrc}
                className="absolute inset-0 h-full w-full border-0 bg-white"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads allow-top-navigation-by-user-activation allow-storage-access-by-user-activation"
                referrerPolicy="no-referrer-when-downgrade"
                allow="payment; geolocation; clipboard-read; clipboard-write; storage-access *"
                onLoad={() => {
                  const el = iframeRef.current
                  if (el && iframeLooksBlocked(el)) setEmbedFailed(true)
                  syncIframeUrl()
                  setLoading(false)
                }}
              />
            ) : (
              <div className="flex h-full items-center justify-center px-6 text-center text-[14px] text-white/50">
                This link can’t be opened inside Yureka.
              </div>
            )}
            {host && (
              <InAppGiftCardBar
                pageUrl={pageUrl}
                host={host}
                requireProductPage
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}

const InAppBrowserPage: React.FC = () => {
  const [params] = useSearchParams()
  const from = params.get('from') || '/dashboard/offers'
  const src = useMemo(() => sanitizeBrowseUrl(params.get('url')), [params])
  const title = params.get('title') || undefined

  return <InAppBrowserFrame src={src || undefined} title={title} returnTo={from} />
}

export default InAppBrowserPage

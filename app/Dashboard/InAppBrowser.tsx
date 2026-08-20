import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'motion/react'
import { ChevronLeft, Lock, RotateCw } from 'lucide-react'
import { browseHost, embedFrameSrc, sanitizeBrowseUrl } from '@shared/inAppBrowse'

const spring = { type: 'spring' as const, bounce: 0, duration: 0.35 }

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
  const navigate = useNavigate()
  const [frameKey, setFrameKey] = useState(0)
  const [loading, setLoading] = useState(true)
  const safeSrc = sanitizeBrowseUrl(src)
  const frameSrc = embedFrameSrc(safeSrc)
  const host = browseHost(safeSrc)

  useEffect(() => {
    setLoading(true)
    const t = window.setTimeout(() => setLoading(false), 8000)
    return () => window.clearTimeout(t)
  }, [frameSrc, frameKey])

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-[#070707]">
      <div className="flex shrink-0 items-center gap-2 border-b border-white/[0.08] bg-[#0c0d10]/90 px-2 py-2 backdrop-blur-xl">
        <motion.button
          type="button"
          whileTap={{ scale: 0.94 }}
          transition={spring}
          aria-label="Back"
          onClick={() => navigate(returnTo)}
          className="flex h-11 w-11 items-center justify-center rounded-full text-white/80 hover:bg-white/[0.08]"
        >
          <ChevronLeft size={22} />
        </motion.button>
        <div className="min-w-0 flex-1 rounded-full bg-white/[0.07] px-3 py-2">
          <p className="truncate text-[13px] font-semibold tracking-[-0.02em] text-white">
            {title || host || 'Shop'}
          </p>
          <p className="flex items-center gap-1 truncate text-[11px] text-white/40">
            <Lock size={10} className="shrink-0" />
            {host || 'yureka.one'}
          </p>
        </div>
        <motion.button
          type="button"
          whileTap={{ scale: 0.94 }}
          transition={spring}
          aria-label="Reload page"
          onClick={() => {
            setLoading(true)
            setFrameKey((k) => k + 1)
          }}
          className="flex h-11 w-11 items-center justify-center rounded-full text-white/55 hover:bg-white/[0.08] hover:text-white"
        >
          <RotateCw size={16} />
        </motion.button>
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

      <div className="relative min-h-0 flex-1 bg-white">
        {loading && frameSrc && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white text-[13px] text-black/45">
            Opening {title || host || 'store'}…
          </div>
        )}
        {frameSrc ? (
          <iframe
            key={`${frameSrc}-${frameKey}`}
            title={title || host || 'Brand'}
            src={frameSrc}
            className="absolute inset-0 h-full w-full border-0"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads allow-top-navigation-by-user-activation"
            referrerPolicy="no-referrer-when-downgrade"
            allow="payment; geolocation; clipboard-read; clipboard-write"
            onLoad={() => setLoading(false)}
          />
        ) : (
          <div className="flex h-full items-center justify-center px-6 text-center text-[14px] text-black/50">
            This link can’t be opened inside Yureka.
          </div>
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

import React, { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Gift, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { formatInr } from '@shared/giftCardDeepLink'
import { fetchGiftCardMatchFromUrl, type GiftCardMatchPayload } from '@shared/giftCardMatch'
import { isProductPageUrl } from '@shared/giftCardProduct'

const spring = { type: 'spring' as const, bounce: 0, duration: 0.35 }

function hideKey(host: string) {
  return `yureka-gift-bar-hide:${host}`
}

type Props = {
  pageUrl: string | null
  host: string
  requireProductPage?: boolean
}

export function InAppGiftCardBar({ pageUrl, host, requireProductPage = false }: Props) {
  const navigate = useNavigate()
  const [match, setMatch] = useState<GiftCardMatchPayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [hidden, setHidden] = useState(false)
  const timer = useRef(0)
  const onProduct = isProductPageUrl(pageUrl)

  useEffect(() => {
    try {
      setHidden(sessionStorage.getItem(hideKey(host)) === '1')
    } catch {
      setHidden(false)
    }
  }, [host])

  useEffect(() => {
    if (!pageUrl || hidden || (requireProductPage && !onProduct)) {
      setMatch(null)
      setLoading(false)
      return
    }

    window.clearTimeout(timer.current)
    setMatch(null)
    setLoading(true)
    timer.current = window.setTimeout(() => {
      fetchGiftCardMatchFromUrl(pageUrl)
        .then((next) => setMatch(next))
        .catch(() => setMatch(null))
        .finally(() => setLoading(false))
    }, 400)

    return () => window.clearTimeout(timer.current)
  }, [pageUrl, hidden, onProduct, requireProductPage])

  if (hidden) return null
  if (!loading && !match) return null
  if (!match && !onProduct) return null
  const amount = match?.suggestedAmount
  const savings = match?.savingsInr
  const discount = match?.discountPercentage

  let subtitle = match
    ? amount
      ? `Buy ${formatInr(amount)} ${match.brand} gift card`
      : `${match.title} available on Yureka`
    : onProduct
      ? 'Checking gift card savings…'
      : `${host} gift cards on Yureka`

  if (match?.productPrice && amount && match.productPrice !== amount) {
    subtitle += ` · item ${formatInr(match.productPrice)}`
  }
  if (savings && savings > 0) {
    subtitle += ` · save ${formatInr(savings)}`
  } else if (discount && discount > 0) {
    subtitle += ` · ${discount}% off`
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 16 }}
        transition={spring}
        className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      >
        <div className="pointer-events-auto flex max-w-md items-center gap-3 rounded-full border border-emerald-400/30 bg-[rgba(10,10,10,0.94)] px-3 py-2.5 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-300">
            {match?.logoUrl ? (
              <img src={match.logoUrl} alt="" className="h-6 w-6 rounded-md object-cover" />
            ) : (
              <Gift size={16} />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-300">
              Pay with gift card
            </p>
            <p className="truncate text-[12px] text-white/75">{subtitle}</p>
          </div>
          {match?.checkoutPath && (
            <button
              type="button"
              onClick={() => navigate(match.checkoutPath)}
              className="shrink-0 rounded-full bg-emerald-400 px-3.5 py-2 text-[12px] font-bold text-black"
            >
              Get card
            </button>
          )}
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => {
              try {
                sessionStorage.setItem(hideKey(host), '1')
              } catch {
                /* ignore */
              }
              setHidden(true)
              setMatch(null)
            }}
            className="shrink-0 rounded-full p-1.5 text-white/40 hover:text-white/70"
          >
            <X size={16} />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

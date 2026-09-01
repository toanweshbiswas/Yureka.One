import React, { useEffect, useRef } from 'react'
import {
  ADSENSE_CLIENT,
  AD_PLACEMENTS,
  isAdsenseEnabled,
  loadAdsenseScript,
  slotForPlacement,
  type AdPlacementId,
} from '@shared/googleAdsense'

type Props = {
  placement: AdPlacementId
  className?: string
}

/**
 * Named AdSense placement. Create a display ad unit in AdSense, paste its slot ID
 * into the matching VITE_ADSENSE_SLOT_* env var, and mount this component where
 * you want the ad to appear.
 */
const GoogleAdSlot: React.FC<Props> = ({ placement, className = '' }) => {
  const insRef = useRef<HTMLModElement>(null)
  const config = AD_PLACEMENTS[placement]
  const slot = slotForPlacement(placement)
  const enabled = isAdsenseEnabled() && Boolean(slot)

  useEffect(() => {
    if (!enabled || !ADSENSE_CLIENT || !slot || !insRef.current) return
    if (insRef.current.dataset.adsensePushed === '1') return

    let cancelled = false

    loadAdsenseScript(ADSENSE_CLIENT)
      .then(() => {
        if (cancelled || !insRef.current || insRef.current.dataset.adsensePushed === '1') return
        insRef.current.dataset.adsensePushed = '1'
        try {
          ;(window.adsbygoogle = window.adsbygoogle || []).push({})
        } catch {
          // Ad blockers or AdSense policy blocks — fail silently.
        }
      })
      .catch(() => {
        // Script blocked or offline.
      })

    return () => {
      cancelled = true
    }
  }, [enabled, slot, placement])

  if (!enabled) return null

  return (
    <aside
      className={`google-ad-slot ${className}`.trim()}
      aria-label={`Advertisement: ${config.label}`}
      data-ad-placement={placement}
    >
      <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-white/25">
        Ad
      </p>
      <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] min-h-[90px]">
        <ins
          ref={insRef}
          className="adsbygoogle block"
          style={{ display: 'block' }}
          data-ad-client={ADSENSE_CLIENT}
          data-ad-slot={slot}
          data-ad-format={config.format}
          {...(config.fullWidthResponsive ? { 'data-full-width-responsive': 'true' } : {})}
        />
      </div>
    </aside>
  )
}

export default GoogleAdSlot

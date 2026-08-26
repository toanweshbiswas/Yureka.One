import React, { useEffect, useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import {
  localBrandLogo,
  normalizeLogoHost,
  remoteBrandLogoSources,
} from './localBrandLogos'

function isWeakRemoteFavicon(url: string): boolean {
  return /duckduckgo\.com\/ip3|google\.com\/s2\/favicons|gstatic\.com\/faviconV2|icons\.duckduckgo\.com/i.test(
    url,
  )
}

/** Ordered logo candidates. local asset first, then custom URL, then high-res CDNs. */
export function storeLogoSources(domain: string, logoUrl?: string | null): string[] {
  const host = normalizeLogoHost(domain)
  const out: string[] = []
  const seen = new Set<string>()

  const push = (url: string | null | undefined) => {
    const next = String(url || '').trim()
    if (!next || seen.has(next)) return
    seen.add(next)
    out.push(next)
  }

  const custom = String(logoUrl || '').trim()
  const customOk =
    custom &&
    (custom.startsWith('/') || /^https?:\/\//i.test(custom)) &&
    !isWeakRemoteFavicon(custom)

  // Crisp same-origin marks beat tiny remote favicons every time.
  push(localBrandLogo(host))
  if (customOk) push(custom)
  else if (custom.startsWith('/') || /^https?:\/\//i.test(custom)) push(custom)

  for (const remote of remoteBrandLogoSources(host)) push(remote)

  return out
}

/** Primary logo URL (first candidate). Prefer BrandLogo for automatic fallbacks. */
export function storeLogo(domain: string, logoUrl?: string | null) {
  return storeLogoSources(domain, logoUrl)[0] || ''
}

type BrandLogoProps = {
  domain: string
  name?: string
  logoUrl?: string | null
  className?: string
  imgClassName?: string
  /** Tile / letter-fallback background */
  bg?: string
  size?: number
  alt?: string
  pressable?: boolean
}

/**
 * Brand mark with interruptible press + multi-source fallback so tiles never go blank.
 */
export function BrandLogo({
  domain,
  name,
  logoUrl,
  className = '',
  imgClassName = 'h-full w-full object-contain p-[8%]',
  bg,
  size,
  alt = '',
  pressable = false,
}: BrandLogoProps) {
  const reduceMotion = useReducedMotion()
  const sources = useMemo(() => storeLogoSources(domain, logoUrl), [domain, logoUrl])
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    setIdx(0)
  }, [sources])

  const letter = (name || domain || '?').trim().charAt(0).toUpperCase() || '?'
  const exhausted = idx >= sources.length
  const src = !exhausted ? sources[idx] : null

  const shellStyle: React.CSSProperties = {
    ...(bg ? { background: bg } : {}),
    ...(size ? { width: size, height: size } : {}),
  }

  const body = exhausted ? (
    <span
      className="flex h-full w-full items-center justify-center text-[42%] font-bold tracking-tight text-black/70"
      aria-hidden
    >
      {letter}
    </span>
  ) : (
    <img
      key={src}
      src={src!}
      alt={alt}
      decoding="async"
      loading="lazy"
      referrerPolicy="no-referrer"
      className={imgClassName}
      onError={() => setIdx((i) => i + 1)}
    />
  )

  if (pressable) {
    return (
      <motion.span
        whileTap={reduceMotion ? undefined : { scale: 0.94 }}
        transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
        className={className}
        style={shellStyle}
      >
        {body}
      </motion.span>
    )
  }

  return (
    <span className={className} style={shellStyle}>
      {body}
    </span>
  )
}

export default BrandLogo

import React, { useEffect, useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'

/** Ordered logo candidates — custom URL first, then resilient public icon CDNs. */
export function storeLogoSources(domain: string, logoUrl?: string | null): string[] {
  const host = String(domain || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0]
    .replace(/[^a-z0-9.-]/g, '')

  const out: string[] = []
  const custom = String(logoUrl || '').trim()
  if (custom && /^https?:\/\//i.test(custom)) out.push(custom)
  if (host) {
    // DuckDuckGo is more reliable than Google s2 in PWAs / Safari ITP.
    out.push(`https://icons.duckduckgo.com/ip3/${encodeURIComponent(host)}.ico`)
    out.push(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`)
    out.push(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`)
  }
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
  imgClassName = 'h-full w-full object-contain',
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

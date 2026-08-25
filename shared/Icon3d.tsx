import { useState } from 'react'

const FALLBACK_GLYPH: Record<string, string> = {
  bag: '🛍',
  boy: '👤',
  gift: '🎁',
  flash: '⚡',
  chart: '📊',
  calender: '📅',
  wallet: '👛',
  heart: '♥',
  tick: '✓',
  mail: '✉',
  money: '₹',
}

export function icon3d(name: string) {
  return `/assets/3dicons/${name}.png`
}

export default function Icon3d({
  name,
  className = 'h-8 w-8 object-contain',
  alt = '',
}: {
  name: string
  className?: string
  alt?: string
}) {
  const [broken, setBroken] = useState(false)
  if (broken) {
    return (
      <span
        className={`inline-flex items-center justify-center text-[13px] leading-none ${className}`}
        aria-hidden={alt ? undefined : true}
        role={alt ? 'img' : undefined}
        aria-label={alt || undefined}
      >
        {FALLBACK_GLYPH[name] || '•'}
      </span>
    )
  }
  return (
    <img
      src={icon3d(name)}
      alt={alt}
      className={className}
      draggable={false}
      decoding="async"
      onError={() => setBroken(true)}
    />
  )
}

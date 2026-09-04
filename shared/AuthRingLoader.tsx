import React from 'react'

type AuthRingLoaderProps = {
  /** Pixel size of the ring. Buttons: 18–20. Full-page: 36–48. */
  size?: number
  className?: string
  /** Accessible label for screen readers */
  label?: string
}

/**
 * Glowing conic ring used on auth busy states.
 * Approximate of the neon mint loader: soft bloom + fading trail.
 */
export default function AuthRingLoader({
  size = 18,
  className = '',
  label = 'Loading',
}: AuthRingLoaderProps) {
  const stroke = Math.max(2, Math.round(size * 0.14))

  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      role="status"
      aria-label={label}
    >
      {/* Soft bloom behind the ring */}
      <span
        aria-hidden
        className="absolute inset-[-35%] rounded-full opacity-80 blur-[6px]"
        style={{
          background:
            'radial-gradient(circle, rgba(52,211,153,0.55) 0%, rgba(52,211,153,0.12) 45%, transparent 70%)',
        }}
      />
      <span
        aria-hidden
        className="auth-ring-loader relative block rounded-full"
        style={{
          width: size,
          height: size,
          background: `conic-gradient(from 0deg, transparent 0%, rgba(52,211,153,0.15) 28%, #34d399 72%, #a7f3d0 100%)`,
          WebkitMask: `radial-gradient(farthest-side, transparent calc(100% - ${stroke}px), #000 calc(100% - ${stroke}px))`,
          mask: `radial-gradient(farthest-side, transparent calc(100% - ${stroke}px), #000 calc(100% - ${stroke}px))`,
          filter: 'drop-shadow(0 0 4px rgba(52,211,153,0.85)) drop-shadow(0 0 10px rgba(52,211,153,0.45))',
        }}
      />
      <span className="sr-only">{label}</span>
    </span>
  )
}

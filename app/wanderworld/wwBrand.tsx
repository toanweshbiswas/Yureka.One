import React from 'react'

export const WANDERWORLD_LOGO_SRC = '/assets/brand-logos/wanderworld-holidays.png'

type WwLogoProps = {
  className?: string
  /** Login/hero vs compact header */
  size?: 'hero' | 'header' | 'inline'
}

export function WwLogo({ className = '', size = 'hero' }: WwLogoProps) {
  const sizeClass =
    size === 'hero' ? 'h-36 w-auto sm:h-44' : size === 'header' ? 'h-10 w-auto sm:h-12' : 'h-16 w-auto'

  return (
    <img
      src={WANDERWORLD_LOGO_SRC}
      alt="WanderWorld Holidays"
      className={`${sizeClass} object-contain ${className}`.trim()}
      decoding="async"
    />
  )
}

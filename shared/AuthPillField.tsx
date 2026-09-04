import React, { useId, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'

const springSnappy = { type: 'spring' as const, bounce: 0, duration: 0.28 }

export type AuthPillFieldProps = {
  id: string
  label: string
  type?: string
  value: string
  onChange: (value: string) => void
  autoComplete?: string
  required?: boolean
  minLength?: number
  placeholder?: string
  icon?: React.ReactNode
  trailing?: React.ReactNode
}

/**
 * Auth pill input with neon plasma aura on focus and when filled.
 */
export default function AuthPillField({
  id,
  label,
  type = 'text',
  value,
  onChange,
  autoComplete,
  required,
  minLength,
  placeholder,
  icon,
  trailing,
}: AuthPillFieldProps) {
  const [focused, setFocused] = useState(false)
  const reduceMotion = useReducedMotion()
  const uid = useId().replace(/:/g, '')
  const filterId = `auth-plasma-${uid}`
  const glowId = `auth-glow-${uid}`

  const filled = value.trim().length > 0
  const lit = focused || filled
  /** Focus is brightest; filled-but-blurred keeps a calmer twin of the same effect. */
  const intense = focused

  return (
    <motion.div
      className="relative"
      animate={{
        scale: focused && !reduceMotion ? 1.01 : 1,
      }}
      transition={springSnappy}
    >
      {/* Soft bloom */}
      <span
        aria-hidden
        className={[
          'pointer-events-none absolute -inset-1 rounded-full transition-opacity duration-200',
          lit ? 'opacity-100' : 'opacity-0',
        ].join(' ')}
        style={{
          boxShadow: intense
            ? '0 0 18px 4px rgba(52,211,153,0.35), 0 0 40px 8px rgba(52,211,153,0.18)'
            : '0 0 14px 3px rgba(52,211,153,0.22), 0 0 28px 6px rgba(52,211,153,0.1)',
        }}
      />

      {/* Living electric rim — focus + filled */}
      {lit && (
        <>
          <svg width="0" height="0" className="absolute" aria-hidden>
            <defs>
              <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
                <feTurbulence
                  type="fractalNoise"
                  baseFrequency={reduceMotion ? '0.03 0.08' : intense ? '0.04 0.11' : '0.032 0.09'}
                  numOctaves="3"
                  seed="3"
                  result="noise"
                >
                  {!reduceMotion && intense && (
                    <animate
                      attributeName="baseFrequency"
                      values="0.035 0.09;0.05 0.13;0.03 0.08;0.035 0.09"
                      dur="1.6s"
                      repeatCount="indefinite"
                    />
                  )}
                </feTurbulence>
                <feDisplacementMap
                  in="SourceGraphic"
                  in2="noise"
                  scale={reduceMotion ? 2 : intense ? 5 : 3}
                  xChannelSelector="R"
                  yChannelSelector="G"
                />
              </filter>
              <filter id={glowId} x="-80%" y="-80%" width="260%" height="260%">
                <feGaussianBlur stdDeviation={intense ? 2.8 : 2} result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
          </svg>

          <span
            aria-hidden
            className={[
              'pointer-events-none absolute -inset-[3px] rounded-full border-[2.5px] transition-colors duration-200',
              intense ? 'border-clay/50' : 'border-clay/35',
            ].join(' ')}
            style={{ filter: `url(#${glowId})` }}
          />
          <span
            aria-hidden
            className={[
              'pointer-events-none absolute -inset-[2px] rounded-full border-[1.5px] transition-colors duration-200',
              intense ? 'border-[#6ee7b7]' : 'border-clay/70',
              !reduceMotion && intense ? 'auth-plasma-pulse' : '',
            ].join(' ')}
            style={{ filter: `url(#${filterId})` }}
          />
        </>
      )}

      {/* Sparks only while actively typing / focused */}
      {focused && !reduceMotion && (
        <span className="pointer-events-none absolute inset-0" aria-hidden>
          {[
            { top: '6%', left: '16%', delay: '0s' },
            { top: '10%', left: '70%', delay: '0.35s' },
            { top: '82%', left: '26%', delay: '0.7s' },
            { top: '74%', left: '80%', delay: '1.1s' },
            { top: '46%', left: '2%', delay: '0.5s' },
            { top: '50%', left: '96%', delay: '0.9s' },
          ].map((s, i) => (
            <span
              key={i}
              className="auth-plasma-spark absolute h-[3px] w-[3px] rounded-full bg-[#ecfdf5]"
              style={{
                top: s.top,
                left: s.left,
                animationDelay: s.delay,
                boxShadow: '0 0 6px 2px rgba(110,231,183,0.9)',
              }}
            />
          ))}
        </span>
      )}

      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoComplete={autoComplete}
        required={required}
        minLength={minLength}
        placeholder={placeholder}
        className={[
          'relative z-[1] w-full rounded-full border bg-white/[0.05] py-3.5 pl-5 pr-12 text-[16px] leading-none text-white',
          'placeholder:text-white/35 outline-none transition-[border-color,background-color,box-shadow] duration-150',
          intense
            ? 'border-clay/80 bg-white/[0.07] shadow-[inset_0_0_14px_rgba(52,211,153,0.08)]'
            : filled
              ? 'border-clay/55 bg-clay/[0.06] shadow-[inset_0_0_10px_rgba(52,211,153,0.05)]'
              : 'border-white/12 hover:border-white/20',
        ].join(' ')}
      />
      {icon && (
        <span
          className={[
            'pointer-events-none absolute right-4 top-1/2 z-[2] -translate-y-1/2 transition-colors duration-150',
            lit ? 'text-clay' : 'text-clay/70',
          ].join(' ')}
          aria-hidden
        >
          {icon}
        </span>
      )}
      {trailing}
    </motion.div>
  )
}

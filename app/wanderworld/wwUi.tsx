import React from 'react'
import { motion, useReducedMotion, type HTMLMotionProps } from 'motion/react'

/** Critically damped. Apple default for reposition / UI chrome */
export const wwSpring = { type: 'spring' as const, bounce: 0, duration: 0.4 }
/** Snappier chrome (tabs, chips) */
export const wwSpringFast = { type: 'spring' as const, bounce: 0, duration: 0.28 }

export function useWwMotion() {
  const reduce = useReducedMotion()
  return {
    reduce: Boolean(reduce),
    spring: reduce ? { duration: 0.15 } : wwSpring,
    springFast: reduce ? { duration: 0.12 } : wwSpringFast,
  }
}

export const wwPage =
  'relative min-h-dvh overflow-x-hidden text-white antialiased selection:bg-clay/30'

export const wwAmbient =
  'pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(245,197,24,0.07),transparent_55%),radial-gradient(ellipse_60%_40%_at_100%_0%,rgba(52,211,153,0.06),transparent_45%),#080808]'

export const wwGlassHeader =
  'sticky top-0 z-20 border-b border-white/[0.08] px-4 py-3 md:px-8 supports-[backdrop-filter]:bg-[#080808]/72] supports-[backdrop-filter]:backdrop-blur-[20px] supports-[backdrop-filter]:backdrop-saturate-[180%] bg-[#0c0c0c]/92'

export const wwSurface =
  'rounded-[1.75rem] border border-white/[0.08] bg-white/[0.035] shadow-[0_1px_0_rgba(255,255,255,0.04)_inset]'

export const wwSurfacePad = `${wwSurface} p-5 md:p-6`

export const wwField =
  'w-full rounded-[1.15rem] border border-white/[0.1] bg-black/45 px-4 py-3.5 text-[15px] text-white placeholder:text-white/30 outline-none transition-[border-color,background-color] duration-150 focus:border-clay/40 focus:bg-black/55'

/** Compact search field for sticky admin chrome */
export const wwSearchField =
  'w-full rounded-[1.05rem] border border-white/[0.1] bg-black/50 py-3 pl-11 pr-4 text-[15px] tracking-[-0.01em] text-white placeholder:text-white/35 outline-none transition-[border-color,background-color] duration-150 focus:border-clay/35 focus:bg-black/60'

export const wwBtnPrimary =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-[1.15rem] bg-clay px-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-black transition-transform duration-100 ease-out active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45'

export const wwBtnSecondary =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-[1.15rem] bg-white/[0.08] px-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/85 transition-transform duration-100 ease-out active:scale-[0.97] hover:bg-white/[0.12] disabled:pointer-events-none disabled:opacity-45'

export const wwBtnGhost =
  'inline-flex min-h-10 items-center justify-center gap-1.5 rounded-[1rem] bg-white/[0.06] px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/70 transition-transform duration-100 ease-out active:scale-[0.97] hover:bg-white/[0.1] disabled:pointer-events-none disabled:opacity-45'

export const wwChip =
  'relative shrink-0 rounded-full px-4 py-2.5 text-[11px] font-semibold tracking-[0.04em] transition-transform duration-100 ease-out active:scale-[0.97]'

export const wwLabel =
  'font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-white/40'

export const wwTitle =
  'text-[1.65rem] font-semibold tracking-[-0.03em] text-white md:text-[1.85rem]'

export const wwSectionTitle =
  'text-[13px] font-semibold tracking-[-0.01em] text-white/90'

/** Page-level title for a tab (wayfinding) */
export function WwPageHeading({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: string
  action?: React.ReactNode
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-[1.35rem] font-semibold tracking-[-0.03em] text-white md:text-[1.5rem]">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-1 max-w-xl text-[13px] leading-snug text-white/45">{subtitle}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

/** In-form section label + optional hint (grouping & mapping) */
export function WwFieldGroup({
  title,
  hint,
  children,
  className = '',
}: {
  title: string
  hint?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`space-y-2.5 ${className}`}>
      <div>
        <p className={wwLabel}>{title}</p>
        {hint ? <p className="mt-1 text-[12px] leading-snug text-white/40">{hint}</p> : null}
      </div>
      {children}
    </div>
  )
}

export const wwTableWrap = `${wwSurface} overflow-x-auto`

export const wwTh =
  'px-4 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-white/40'

export const wwTd = 'px-4 py-3.5 text-[14px] text-white/80'

export function WwStat({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string
  value: React.ReactNode
  hint?: React.ReactNode
  tone?: 'default' | 'warn' | 'ok'
}) {
  const toneCls =
    tone === 'warn'
      ? 'border-amber-400/20 bg-amber-400/[0.06]'
      : tone === 'ok'
        ? 'border-emerald-400/20 bg-emerald-400/[0.05]'
        : ''
  return (
    <div className={`${wwSurface} ${toneCls} p-4 md:p-5`}>
      <p className={wwLabel}>{label}</p>
      <p className="mt-2 text-[1.65rem] font-semibold tracking-[-0.03em] tabular-nums text-white md:text-[1.85rem]">
        {value}
      </p>
      {hint != null ? <p className="mt-1.5 text-[12px] leading-snug text-white/40">{hint}</p> : null}
    </div>
  )
}

export function WwPanel({
  title,
  children,
  className = '',
  action,
}: {
  title?: string
  children: React.ReactNode
  className?: string
  action?: React.ReactNode
}) {
  return (
    <section className={`${wwSurface} ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3.5 md:px-5">
          {title ? <h2 className={wwSectionTitle}>{title}</h2> : <span />}
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

type TabPanelProps = HTMLMotionProps<'div'> & {
  children: React.ReactNode
}

export function WwTabPanel({ children, ...rest }: TabPanelProps) {
  const { spring, reduce } = useWwMotion()
  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
      transition={spring}
      {...rest}
    >
      {children}
    </motion.div>
  )
}

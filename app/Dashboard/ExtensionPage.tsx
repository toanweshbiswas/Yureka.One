import React, { useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { Check, Copy, Puzzle } from 'lucide-react'

const STEPS = [
  {
    n: '1',
    title: 'Open extensions',
    body: 'Visit chrome://extensions and turn on Developer mode (top right).',
  },
  {
    n: '2',
    title: 'Load unpacked',
    body: 'Choose Load unpacked, then select the extension folder below.',
  },
  {
    n: '3',
    title: 'Pin & shop',
    body: 'Pin Yureka in the toolbar. Coupons and Goldback appear on the store you’re browsing.',
  },
] as const

const spring = { type: 'spring' as const, bounce: 0, duration: 0.4 }

const ExtensionPage: React.FC = () => {
  const folder = 'Yureka.One/extension'
  const reduceMotion = useReducedMotion()
  const [copied, setCopied] = useState(false)

  const copyPath = async () => {
    try {
      await navigator.clipboard.writeText(folder)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      /* ignore */
    }
  }

  const enter = reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }

  return (
    <div className="mx-auto max-w-xl">
      <motion.div initial={enter} animate={{ opacity: 1, y: 0 }} transition={spring}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-clay">Browser plugin</p>
        <h1 className="mt-2 text-[1.85rem] font-semibold leading-[1.1] tracking-[-0.035em] text-white sm:text-[2.2rem]">
          Yureka for Chrome
        </h1>
        <p className="mt-3 max-w-md text-[14.5px] leading-relaxed text-white/45">
          Live coupons and Goldback on Amazon, Flipkart, Myntra, and more. without leaving checkout.
          Some deal links are affiliate links; Yureka may earn a commission at no extra cost to you.
        </p>
      </motion.div>

      <motion.div
        initial={enter}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...spring, delay: reduceMotion ? 0 : 0.06 }}
        className="relative mt-8 overflow-hidden rounded-[1.5rem] border border-white/10 bg-black/40 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl backdrop-saturate-150"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />

        <div className="flex items-start gap-4 border-b border-white/[0.06] p-5 sm:p-6">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-clay/15 text-clay ring-1 ring-clay/25">
            <Puzzle size={22} strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <p className="text-[15px] font-semibold tracking-[-0.02em] text-white">Load unpacked</p>
            <p className="mt-1 text-[13px] leading-relaxed text-white/42">
              Works in Chrome and Edge today. Chrome Web Store listing comes next. this path is the real install.
            </p>
          </div>
        </div>

        <div className="p-5 sm:p-6">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/35">Folder path</p>
          <motion.button
            type="button"
            onClick={() => void copyPath()}
            whileTap={{ scale: 0.985 }}
            transition={spring}
            className="flex w-full items-center justify-between gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3.5 text-left transition-colors hover:border-white/16 hover:bg-white/[0.05]"
          >
            <code className="truncate text-[13px] tracking-[-0.01em] text-white/85">{folder}</code>
            <span
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                copied ? 'bg-clay/20 text-clay' : 'bg-white/5 text-white/45'
              }`}
            >
              {copied ? (
                <>
                  <Check size={13} strokeWidth={2.5} /> Copied
                </>
              ) : (
                <>
                  <Copy size={13} /> Copy
                </>
              )}
            </span>
          </motion.button>

          <ol className="relative mt-8 space-y-0">
            <div
              className="absolute bottom-3 left-[15px] top-3 w-px bg-gradient-to-b from-clay/50 via-white/12 to-transparent"
              aria-hidden
            />
            {STEPS.map((s, i) => (
              <li key={s.n} className="relative flex gap-4 pb-7 last:pb-0">
                <span className="relative z-[1] flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0c0c0c] text-[12px] font-bold tabular-nums text-clay ring-1 ring-clay/35">
                  {s.n}
                </span>
                <div className="min-w-0 pt-1">
                  <p className="text-[14px] font-semibold tracking-[-0.02em] text-white">{s.title}</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-white/42">{s.body}</p>
                  {i === 0 && (
                    <p className="mt-2 font-mono text-[11px] text-white/30">chrome://extensions</p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </motion.div>

      <p className="mt-6 text-[12.5px] leading-relaxed text-white/35">
        Privacy: the extension only sends the store hostname to match offers. not your cart contents.
      </p>
    </div>
  )
}

export default ExtensionPage

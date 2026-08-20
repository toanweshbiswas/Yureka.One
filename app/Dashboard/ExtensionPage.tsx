import React from 'react'
import { Copy, Zap } from 'lucide-react'

const STEPS = [
  {
    n: '01',
    title: 'Open Chrome extensions',
    body: 'Go to chrome://extensions and turn on Developer mode in the top right.',
  },
  {
    n: '02',
    title: 'Load unpacked',
    body: 'Click Load unpacked and select the extension folder in the Yureka.One repo.',
  },
  {
    n: '03',
    title: 'Pin Yureka',
    body: 'Pin the toolbar icon. Shop as usual — coupons and Goldback show on the store you are on.',
  },
] as const

const ExtensionPage: React.FC = () => {
  const folder = 'Yureka.One/extension'

  const copyPath = async () => {
    try {
      await navigator.clipboard.writeText(folder)
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="max-w-2xl">
      <p className="text-[11px] font-black uppercase tracking-[0.22em] text-clay">Browser</p>
      <h1 className="mt-2 text-[2rem] sm:text-[2.35rem] font-semibold tracking-[-0.04em] text-white leading-tight">
        Yureka for Chrome
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-white/45 max-w-lg">
        See live coupons and Goldback on Amazon, Flipkart, Myntra, and other stores without leaving the page. Shop
        through Yureka from the toolbar.
      </p>

      <div className="mt-8 rounded-[1.6rem] border border-white/[0.08] bg-white/[0.03] p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-clay/15 text-clay flex items-center justify-center">
            <Zap size={20} />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-white">Load unpacked</p>
            <p className="text-[12px] text-white/40">Works today in Chrome and Edge. Chrome Web Store listing comes next.</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void copyPath()}
          className="mt-5 w-full flex items-center justify-between gap-3 rounded-2xl bg-black/40 border border-white/[0.08] px-4 py-3 text-left hover:border-white/16 transition"
        >
          <code className="text-[13px] text-white/80 truncate">{folder}</code>
          <Copy size={15} className="text-white/35 shrink-0" />
        </button>

        <ol className="mt-6 space-y-5">
          {STEPS.map((s) => (
            <li key={s.n} className="flex gap-4">
              <span className="text-[11px] font-black tracking-[0.14em] text-clay/80 pt-0.5">{s.n}</span>
              <div>
                <p className="text-[14px] font-semibold text-white tracking-[-0.02em]">{s.title}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-white/42">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <p className="mt-6 text-[12px] font-semibold text-white/40">
        In the address bar: chrome://extensions
      </p>
    </div>
  )
}

export default ExtensionPage

import React, { useEffect, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { Terminal, Database, ShieldCheck, Activity } from 'lucide-react'

function statusForProgress(progress: number): { text: string; icon: number; logStep: number } {
  if (progress >= 100) return { text: 'SYNC COMPLETE.', icon: 2, logStep: 8 }
  if (progress >= 75) return { text: 'PERSISTING TRANSACTIONS TO LEDGER...', icon: 1, logStep: 6 }
  if (progress >= 35) return { text: 'EXTRACTING PURCHASE PAYLOADS FROM GMAIL...', icon: 2, logStep: 4 }
  if (progress >= 20) return { text: 'ESTABLISHING SECURE OAUTH CONNECTION...', icon: 0, logStep: 2 }
  if (progress >= 10) return { text: 'PREPARING GMAIL RESYNC...', icon: 0, logStep: 1 }
  return { text: 'INITIALIZING ENGINE...', icon: 0, logStep: 0 }
}

const LOG_LINES = [
  'INFO: Initializing engine...',
  'GET /gmail/v1/users/me/messages',
  'AUTH: Scope validated.',
  'HTTP 200 OK (candidates)',
  'BATCH GET /gmail/v1/users/me...',
  'Parsing regex (brand, amt, date)...',
  'Score >= 5 -> Match',
  'Deduplicating via hash...',
  'Persist financial_ledger_cache (Supabase)',
  'SYNC COMPLETED SUCCESSFULLY.',
]

export const ScannerProgress: React.FC<{ progress: number }> = ({ progress }) => {
  const clamped = Math.max(0, Math.min(100, Number(progress) || 0))
  const [displayProgress, setDisplayProgress] = useState(clamped)
  const meta = useMemo(() => statusForProgress(clamped), [clamped])

  // Smooth catch-up toward the real sync progress from SupabaseProvider.
  useEffect(() => {
    setDisplayProgress(clamped)
  }, [clamped])

  // While waiting on a long network stage, ease the bar forward a little so it doesn't look frozen.
  useEffect(() => {
    if (clamped <= 0 || clamped >= 100) return
    const ceiling = clamped < 35 ? 34 : clamped < 75 ? 74 : 92
    const id = window.setInterval(() => {
      setDisplayProgress((prev) => {
        if (prev >= ceiling) return prev
        return Math.min(ceiling, prev + 0.4)
      })
    }, 400)
    return () => window.clearInterval(id)
  }, [clamped])

  const icons = [ShieldCheck, Database, Terminal, Activity]
  const CurrentIcon = icons[meta.icon] || ShieldCheck
  const shown = Math.floor(Math.max(clamped, displayProgress))

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="w-full relative overflow-hidden rounded-3xl p-[1px] group"
    >
      <div className="absolute inset-0 bg-gradient-to-r from-clay/20 via-clay to-clay/20 opacity-50 group-hover:opacity-100 animate-[spin_4s_linear_infinite]" />

      <div className="relative w-full bg-black/90 backdrop-blur-xl rounded-[23px] p-6 flex flex-col sm:flex-row items-center gap-6 z-10 border border-white/5">
        <div className="relative shrink-0 flex items-center justify-center w-14 h-14 bg-white/[0.03] rounded-2xl border border-white/10 shadow-[0_0_20px_rgba(33,222,179,0.15)]">
          <CurrentIcon className="text-clay animate-pulse" size={24} />
          <div className="absolute inset-0 bg-clay/20 blur-xl rounded-full" />
        </div>

        <div className="flex-1 w-full">
          <div className="flex items-center justify-between text-xs mb-3">
            <div className="flex items-center gap-3">
              <span className="w-2 h-2 bg-clay rounded-full animate-pulse" />
              <span className="text-clay/90 font-mono tracking-widest uppercase">{meta.text}</span>
            </div>
            <span className="text-white font-mono font-bold tracking-wider">{shown}%</span>
          </div>

          <div className="relative h-1.5 bg-white/5 rounded-full overflow-hidden">
            <motion.div
              className="absolute top-0 left-0 h-full bg-gradient-to-r from-clay/50 to-clay shadow-[0_0_10px_#00933b]"
              animate={{ width: `${Math.max(shown, 2)}%` }}
              transition={{ type: 'spring', bounce: 0, duration: 0.45 }}
            />
          </div>
        </div>

        <div className="hidden lg:block shrink-0 w-64 bg-[#0a0a0a] rounded-xl p-3 border border-white/5 font-mono text-[10px] leading-relaxed overflow-hidden relative max-h-[7.5rem]">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-transparent to-[#0a0a0a] z-10 pointer-events-none" />
          <div className="text-white/30 space-y-1 relative z-0">
            {LOG_LINES.map((line, i) => (
              <p key={line} className={i === meta.logStep ? 'text-clay opacity-100' : 'opacity-40'}>
                {line}
              </p>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

import React from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Mail, RefreshCw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useSupabase } from '@shared/SupabaseProvider'
import { ScannerProgress } from './ScannerProgress'

/**
 * Sticky prompt until the member completes at least one Gmail inbox sync.
 * Not dismissible — clears only after a successful sync.
 */
const GmailSyncPrompt: React.FC = () => {
  const {
    needsGmailSync,
    currentUserStatus,
    syncLedger,
    ledgerLoading,
    scanProgress,
    ledgerError,
  } = useSupabase()
  const navigate = useNavigate()

  const canAccess = currentUserStatus === 'accepted' || currentUserStatus === 'admin'
  const open = Boolean(needsGmailSync && canAccess)

  const startSync = () => {
    void syncLedger(true)
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
          className="relative mb-5 overflow-hidden rounded-[1.5rem] border border-clay/35 bg-gradient-to-br from-clay/15 via-black/40 to-black/60 px-4 py-4 md:mb-8 md:rounded-[1.75rem] md:px-7 md:py-6"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3.5 min-w-0">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-clay/30 bg-clay/10">
                <Mail className="text-clay" size={20} />
              </div>
              <div className="min-w-0 text-left">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-clay">
                  Required · Gmail
                </p>
                <h2 className="text-[1.05rem] font-semibold tracking-[-0.02em] text-white md:text-xl">
                  Sync your Gmail to unlock Expenses & Bills
                </h2>
                <p className="mt-1.5 max-w-xl text-[13px] leading-snug text-white/45 md:text-sm">
                  Grant read-only inbox access once. We pull purchase and bill emails into your ledger — this prompt stays until you sync.
                </p>
                {ledgerError === 'AUTH_EXPIRED' && (
                  <p className="mt-2 text-xs text-red-300/90">
                    Permission was declined or expired. Tap sync again and allow Gmail access.
                  </p>
                )}
              </div>
            </div>

            <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:items-end">
              <button
                type="button"
                disabled={ledgerLoading}
                onClick={startSync}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-clay px-5 py-3.5 text-[11px] font-black uppercase tracking-[0.18em] text-black transition-opacity disabled:opacity-50 sm:w-auto"
              >
                <RefreshCw size={14} className={ledgerLoading ? 'animate-spin' : undefined} />
                {ledgerLoading ? 'Syncing…' : 'Sync Gmail now'}
              </button>
              <button
                type="button"
                onClick={() => navigate('/dashboard/expenses')}
                className="text-[11px] font-semibold uppercase tracking-widest text-white/35 hover:text-white/60"
              >
                Open Expenses
              </button>
            </div>
          </div>

          <AnimatePresence>
            {ledgerLoading && scanProgress > 0 && (
              <div className="mt-4">
                <ScannerProgress progress={scanProgress} />
              </div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default GmailSyncPrompt

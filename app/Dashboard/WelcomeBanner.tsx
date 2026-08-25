import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { X } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import { useSupabase } from '@shared/SupabaseProvider'
import Icon3d from '@shared/Icon3d'

const STORAGE_KEY = 'yureka_welcome_dismissed'

const WelcomeBanner: React.FC = () => {
  const { user, currentUserStatus } = useSupabase()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!user?.id || (currentUserStatus !== 'accepted' && currentUserStatus !== 'admin')) {
      setOpen(false)
      return
    }
    try {
      const dismissed = localStorage.getItem(`${STORAGE_KEY}:${user.id}`)
      setOpen(!dismissed)
    } catch {
      setOpen(true)
    }
  }, [user?.id, currentUserStatus])

  const dismiss = () => {
    if (user?.id) {
      try {
        localStorage.setItem(`${STORAGE_KEY}:${user.id}`, '1')
      } catch {
        // ignore
      }
    }
    setOpen(false)
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
          className="relative mb-5 overflow-hidden rounded-[1.5rem] border border-clay/25 bg-clay/10 px-4 py-4 md:mb-8 md:rounded-[1.75rem] md:px-7 md:py-6"
        >
          <motion.button
            type="button"
            onClick={dismiss}
            whileTap={{ scale: 0.94 }}
            transition={{ type: 'spring', bounce: 0, duration: 0.35 }}
            className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-black/25 text-white/55 active:bg-black/40 active:text-white md:right-4 md:top-4 md:h-9 md:w-9"
            aria-label="Dismiss welcome"
          >
            <X size={16} />
          </motion.button>

          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-clay">
            You&apos;re approved
          </p>
          <h2 className="mb-1.5 pr-11 text-[1.25rem] font-semibold tracking-[-0.03em] text-white md:mb-2 md:text-2xl md:font-black md:tracking-tight">
            Welcome to Yureka
          </h2>
          <p className="mb-4 max-w-xl text-[13px] leading-snug text-white/45 md:mb-5 md:text-sm">
            Your account is unlocked. Start with these three steps.
          </p>

          <ul className="space-y-2.5 md:space-y-3">
            {[
              { icon: 'chart', label: 'Sync Gmail for expenses & bills', to: '/dashboard/expenses' },
              { icon: 'boy', label: 'Complete your profile', to: '/dashboard/profile' },
              { icon: 'bag', label: 'Browse offers & earn Goldback', to: '/dashboard/offers' },
            ].map((item) => (
              <li key={item.to}>
                <Link
                  to={item.to}
                  onClick={dismiss}
                  className="group flex items-center gap-3 rounded-xl py-0.5 text-[13px] text-white/80 active:text-white md:text-sm"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-black/25 group-active:border-clay/40">
                    <Icon3d name={item.icon} className="h-5 w-5 object-contain" alt="" />
                  </span>
                  <span className="font-semibold tracking-[-0.01em]">{item.label}</span>
                  <Icon3d name="tick" className="ml-auto h-4 w-4 object-contain opacity-40" alt="" />
                </Link>
              </li>
            ))}
          </ul>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default WelcomeBanner

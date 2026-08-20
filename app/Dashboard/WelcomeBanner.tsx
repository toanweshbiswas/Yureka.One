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
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="mb-8 rounded-[1.75rem] border border-clay/25 bg-clay/10 px-5 py-5 md:px-7 md:py-6 relative overflow-hidden"
        >
          <button
            type="button"
            onClick={dismiss}
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/20 text-white/50 hover:text-white flex items-center justify-center"
            aria-label="Dismiss welcome"
          >
            <X size={16} />
          </button>

          <p className="text-[9px] font-black uppercase tracking-[0.4em] text-clay mb-2">You're approved</p>
          <h2 className="text-xl md:text-2xl font-black text-white tracking-tight mb-2 pr-10">
            Welcome to Yureka
          </h2>
          <p className="text-sm text-white/45 mb-5 max-w-xl">
            Your account is unlocked. Start with these three steps.
          </p>

          <ul className="space-y-3">
            {[
              { icon: 'boy', label: 'Complete your profile', to: '/dashboard/profile' },
              { icon: 'bag', label: 'Browse offers & earn Goldback', to: '/dashboard/offers' },
              { icon: 'gift', label: 'Explore gift cards', to: '/dashboard/giftcards' },
            ].map((item) => (
              <li key={item.to}>
                <Link
                  to={item.to}
                  onClick={dismiss}
                  className="flex items-center gap-3 text-sm text-white/80 hover:text-white transition-colors group"
                >
                  <span className="w-8 h-8 rounded-xl bg-black/25 border border-white/10 flex items-center justify-center group-hover:border-clay/40">
                    <Icon3d name={item.icon} className="h-5 w-5 object-contain" alt="" />
                  </span>
                  <span className="font-semibold">{item.label}</span>
                  <Icon3d name="tick" className="h-4 w-4 object-contain opacity-40 ml-auto" alt="" />
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

import React, { useState, useEffect } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import {
  Mail, Phone, Calendar,
  Save, ShieldCheck, Loader2, Sparkles, Check
} from 'lucide-react'
import { useSupabase } from '@shared/SupabaseProvider'
import { api, isApiError } from '@backend/lib/api/client'
import type { Waitlist as ApiWaitlist } from '@backend/lib/api/types'
import AddToHomeScreen from '@shared/AddToHomeScreen'
import { googleAvatarUrl, prettyGender } from '@shared/userProfile'

const spring = { type: 'spring' as const, bounce: 0, duration: 0.4 }
const springSnappy = { type: 'spring' as const, bounce: 0, duration: 0.3 }

const AccountSettings: React.FC = () => {
  const reduceMotion = useReducedMotion()
  const { user } = useSupabase()
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [waitlistId, setWaitlistId] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    mobileNumber: '',
    dateOfBirth: '',
    gender: '',
  })
  const [yurekaScore, setYurekaScore] = useState<number | null>(null)
  const [scoreDecision, setScoreDecision] = useState<string | null>(null)

  useEffect(() => {
    if (user) loadAccountData()
  }, [user])

  useEffect(() => {
    const onScore = (event: Event) => {
      const detail = (event as CustomEvent).detail || {}
      const next = Number(detail.score)
      if (!Number.isFinite(next)) return
      setYurekaScore(next)
      setScoreDecision(typeof detail.decision === 'string' ? detail.decision : null)
    }
    window.addEventListener('yureka-score-updated', onScore)
    return () => window.removeEventListener('yureka-score-updated', onScore)
  }, [])

  const loadAccountData = async () => {
    try {
      const res = await api.get<ApiWaitlist>(`/api/v1/waitlist/entry?email=${encodeURIComponent(user!.email)}`)
      if (!isApiError(res) && res.data) {
        const entry = res.data
        setWaitlistId(entry.id ?? null)
        const googleName = String(user?.user_metadata?.full_name || user?.user_metadata?.name || '').trim()
        const fullName = String(entry.name || googleName).trim()
        const parts = fullName.split(/\s+/).filter(Boolean)
        setFormData({
          firstName: entry.firstName || parts[0] || '',
          lastName: entry.lastName || parts.slice(1).join(' ') || '',
          email: entry.email || user?.email || '',
          mobileNumber: entry.mobileNumber || '',
          dateOfBirth: entry.dateOfBirth || '',
          gender: entry.gender || '',
        })
        setYurekaScore(entry.yurekaScore ?? null)
        setScoreDecision(entry.scoreDecision ?? null)
      } else if (user) {
        const googleName = String(user.user_metadata?.full_name || user.user_metadata?.name || '').trim()
        const parts = googleName.split(/\s+/).filter(Boolean)
        setFormData((prev) => ({
          ...prev,
          firstName: parts[0] || prev.firstName,
          lastName: parts.slice(1).join(' ') || prev.lastName,
          email: user.email || prev.email,
        }))
      }
    } catch (err) {
      console.error('Failed to load account:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    if (!waitlistId) return
    setIsSaving(true)
    try {
      const res = await api.patch(`/api/v1/waitlist/${waitlistId}/metadata`, {
        mobile_number: formData.mobileNumber,
        date_of_birth: formData.dateOfBirth,
        gender: formData.gender,
      })
      if (isApiError(res)) throw new Error(res.error)
      setShowSuccess(true)
      window.setTimeout(() => setShowSuccess(false), 2800)
    } catch {
      alert('Failed to update profile.')
    } finally {
      setIsSaving(false)
    }
  }

  const enter = reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }
  const settle = { opacity: 1, y: 0 }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-40">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={spring}
          className="flex flex-col items-center gap-4"
        >
          <motion.div
            animate={reduceMotion ? undefined : { rotate: 360 }}
            transition={
              reduceMotion
                ? undefined
                : { duration: 1.1, repeat: Infinity, ease: 'linear' }
            }
            className="h-11 w-11 rounded-full border-2 border-white/10 border-t-clay"
          />
          <p className="text-[13px] font-medium tracking-[-0.01em] text-white/45">Loading profile…</p>
        </motion.div>
      </div>
    )
  }

  const avatarUrl = googleAvatarUrl(user)
  const initials = `${formData.firstName?.[0] || ''}${formData.lastName?.[0] || ''}`.toUpperCase() || 'U'

  return (
    <div className="max-w-4xl space-y-8 md:space-y-12">
      <motion.div
        initial={enter}
        animate={settle}
        transition={spring}
        className="relative overflow-hidden rounded-[1.75rem] md:rounded-[2.25rem] border border-white/[0.08] bg-white/[0.04] p-6 sm:p-8 md:p-10 backdrop-blur-2xl"
      >
        <div className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-clay/10 blur-[80px]" />

        <div className="relative z-10 space-y-8 md:space-y-10">
          <div className="flex flex-col items-center gap-5 md:flex-row md:gap-8">
            <motion.div
              whileTap={{ scale: 0.97 }}
              transition={springSnappy}
              className="relative"
            >
              <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-[1.35rem] bg-clay text-3xl font-semibold tracking-[-0.04em] text-black shadow-[0_18px_40px_rgba(0,147,59,0.28)] md:h-28 md:w-28">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  initials
                )}
              </div>
              <div className="absolute -bottom-1.5 -right-1.5 flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-[#0c0d10]/90 text-clay shadow-lg backdrop-blur-xl">
                <ShieldCheck size={18} />
              </div>
            </motion.div>

            <div className="text-center md:text-left">
              <div className="mb-2 flex items-center justify-center gap-2.5 md:justify-start">
                <span className="h-1.5 w-1.5 rounded-full bg-clay" />
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-clay/90">
                  Signed in
                </p>
              </div>
              <h3 className="text-[2rem] font-semibold leading-none tracking-[-0.04em] text-white sm:text-[2.35rem] md:text-[2.75rem]">
                {formData.firstName} {formData.lastName}
              </h3>
              <p className="mt-2.5 text-[14px] leading-snug text-white/45">
                Manage your account details and preferences.
              </p>
              <div className="mt-4 flex justify-center md:justify-start">
                <AddToHomeScreen mode="button" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            {[
              {
                label: 'Yureka Score',
                accent: true,
                body:
                  yurekaScore != null ? (
                    <>
                      <p className="text-[1.75rem] font-semibold tracking-[-0.03em] text-white tabular-nums leading-none">
                        {yurekaScore}
                        <span className="text-[15px] font-medium text-white/35">/100</span>
                      </p>
                      {scoreDecision && (
                        <p className="mt-1.5 text-[12px] capitalize text-white/45">{scoreDecision}</p>
                      )}
                    </>
                  ) : (
                    <p className="text-[14px] text-white/40">Not scored yet</p>
                  ),
              },
              {
                label: 'Gender',
                accent: false,
                body: (
                  <p className="text-[1.15rem] font-semibold tracking-[-0.02em] text-white">
                    {prettyGender(formData.gender)}
                  </p>
                ),
              },
              {
                label: 'Google photo',
                accent: false,
                body: (
                  <p className="text-[13px] font-medium leading-snug text-white/65">
                    {avatarUrl ? 'Linked from Google' : 'Sign in with Google to sync photo'}
                  </p>
                ),
              },
            ].map((card, i) => (
              <motion.div
                key={card.label}
                initial={enter}
                animate={settle}
                transition={{ ...spring, delay: reduceMotion ? 0 : 0.04 * (i + 1) }}
                className={`rounded-[1.15rem] px-4 py-3.5 ${
                  card.accent
                    ? 'border border-clay/25 bg-clay/10'
                    : 'border border-white/[0.08] bg-white/[0.03]'
                }`}
              >
                <p
                  className={`mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${
                    card.accent ? 'text-clay/85' : 'text-white/35'
                  }`}
                >
                  {card.label}
                </p>
                {card.body}
              </motion.div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-6 pt-2 md:grid-cols-2 md:gap-7">
            <div className="space-y-2">
              <label className="ml-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/35">
                Email
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-white/20" size={18} />
                <input
                  type="email"
                  value={formData.email}
                  disabled
                  className="w-full cursor-not-allowed rounded-2xl border border-white/[0.06] bg-white/[0.03] py-4 pl-14 pr-24 text-[14px] font-medium tracking-[-0.01em] text-white/30 outline-none"
                />
                <div className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/25">
                  Read only
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="ml-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/35">
                Mobile
              </label>
              <div className="relative">
                <Phone className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-white/35" size={18} />
                <input
                  type="tel"
                  value={formData.mobileNumber}
                  onChange={(e) => setFormData({ ...formData, mobileNumber: e.target.value })}
                  className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.04] py-4 pl-14 pr-5 text-[14px] font-medium tracking-[-0.01em] text-white outline-none placeholder:text-white/20 focus:border-clay/40"
                  placeholder="+91 XXXXX XXXXX"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="ml-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/35">
                Date of birth
              </label>
              <div className="relative">
                <Calendar className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-white/35" size={18} />
                <input
                  type="date"
                  value={formData.dateOfBirth}
                  onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                  className="w-full appearance-none rounded-2xl border border-white/[0.08] bg-white/[0.04] py-4 pl-14 pr-5 text-[14px] font-medium tracking-[-0.01em] text-white outline-none focus:border-clay/40"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="ml-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/35">
                Gender
              </label>
              <div className="relative">
                <select
                  value={formData.gender}
                  onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                  className="w-full cursor-pointer appearance-none rounded-2xl border border-white/[0.08] bg-[#0a0a0a] px-5 py-4 text-[14px] font-medium tracking-[-0.01em] text-white outline-none focus:border-clay/40"
                >
                  <option value="" className="bg-[#0f0f0f]">
                    Select
                  </option>
                  <option value="male" className="bg-[#0f0f0f]">
                    Male
                  </option>
                  <option value="female" className="bg-[#0f0f0f]">
                    Female
                  </option>
                  <option value="other" className="bg-[#0f0f0f]">
                    Other / Prefer not to say
                  </option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center justify-between gap-6 border-t border-white/[0.06] pt-8 lg:flex-row">
            <div className="flex items-center gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-white/35">
                <ShieldCheck size={20} />
              </div>
              <p className="max-w-sm text-[13px] leading-relaxed text-white/40">
                Your profile changes are saved securely to your Yureka account.
              </p>
            </div>

            <motion.button
              type="button"
              onClick={handleSave}
              disabled={isSaving || !waitlistId}
              whileTap={isSaving ? undefined : { scale: 0.97 }}
              transition={springSnappy}
              className={`flex w-full items-center justify-center gap-3 rounded-2xl px-8 py-4 text-[13px] font-semibold tracking-[-0.01em] disabled:opacity-50 lg:w-auto ${
                showSuccess ? 'bg-clay text-black' : 'bg-white text-black'
              }`}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={isSaving ? 'saving' : showSuccess ? 'ok' : 'idle'}
                  initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
                  transition={springSnappy}
                  className="inline-flex items-center gap-3"
                >
                  {isSaving ? (
                    <>
                      Saving…
                      <Loader2 className="animate-spin" size={18} />
                    </>
                  ) : showSuccess ? (
                    <>
                      Saved
                      <Check size={18} />
                    </>
                  ) : (
                    <>
                      Save changes
                      <Save size={18} />
                    </>
                  )}
                </motion.span>
              </AnimatePresence>
            </motion.button>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={enter}
        animate={settle}
        transition={{ ...spring, delay: reduceMotion ? 0 : 0.08 }}
        className="flex flex-col items-center gap-5 rounded-[1.75rem] border border-red-500/15 bg-red-500/[0.04] p-6 md:flex-row md:gap-6 md:p-8"
      >
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/10 text-red-400">
          <Sparkles size={24} />
        </div>
        <div className="flex-1 text-center md:text-left">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-red-400">
            Danger zone
          </p>
          <p className="text-[14px] leading-relaxed text-white/45">
            Signing out removes this device session. Deleting your account permanently ends access to Goldback, gift cards, and referrals.
          </p>
        </div>
        <motion.button
          type="button"
          whileTap={{ scale: 0.97 }}
          transition={springSnappy}
          className="rounded-2xl border border-red-500/20 bg-black/20 px-5 py-3 text-[12px] font-semibold tracking-[-0.01em] text-red-400/80"
        >
          Delete account
        </motion.button>
      </motion.div>
    </div>
  )
}

export default AccountSettings

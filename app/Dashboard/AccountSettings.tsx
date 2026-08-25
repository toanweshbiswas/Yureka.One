import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Mail, Phone, Save, Loader2, Check, LogOut, Trash2 } from 'lucide-react'
import { useSupabase } from '@shared/SupabaseProvider'
import { api, isApiError } from '@backend/lib/api/client'
import { DateField } from '@shared/DateField'
import type { Waitlist as ApiWaitlist } from '@backend/lib/api/types'
import AddToHomeScreen from '@shared/AddToHomeScreen'
import { googleAvatarUrl } from '@shared/userProfile'
import { signOutGmail } from '@shared/auth'
import { cacheInvalidate } from '@shared/dashboardCache'

const spring = { type: 'spring' as const, bounce: 0, duration: 0.38 }
const springSnappy = { type: 'spring' as const, bounce: 0, duration: 0.28 }

const fieldLabel = 'ml-0.5 text-[12px] font-medium tracking-[-0.01em] text-white/45'
const fieldShell =
  'w-full rounded-2xl border border-white/[0.08] bg-white/[0.04] py-3.5 pl-12 pr-4 text-[14px] font-medium tracking-[-0.01em] text-white outline-none placeholder:text-white/25 focus:border-clay/40 focus:bg-white/[0.06] sm:pl-14 sm:py-4'

const AccountSettings: React.FC = () => {
  const reduceMotion = useReducedMotion()
  const navigate = useNavigate()
  const { user } = useSupabase()
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [waitlistId, setWaitlistId] = useState<string | null>(null)
  const [deletion, setDeletion] = useState<{
    id: string
    status: string
    purgeAt: string | null
    requestedAt: string
  } | null>(null)
  const [retentionDays, setRetentionDays] = useState(30)
  const [deletionBusy, setDeletionBusy] = useState(false)
  const [deletionReason, setDeletionReason] = useState('')
  const [deletionMsg, setDeletionMsg] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    mobileNumber: '',
    dateOfBirth: '',
    gender: '',
  })
  const [yurekaScore, setYurekaScore] = useState<number | null>(null)

  useEffect(() => {
    if (user) void loadAccountData()
  }, [user])

  useEffect(() => {
    const onScore = (event: Event) => {
      const detail = (event as CustomEvent).detail || {}
      const next = Number(detail.score)
      if (Number.isFinite(next)) setYurekaScore(next)
    }
    window.addEventListener('yureka-score-updated', onScore)
    return () => window.removeEventListener('yureka-score-updated', onScore)
  }, [])

  const loadAccountData = async () => {
    try {
      const [waitlistRes, deletionRes] = await Promise.all([
        api.get<ApiWaitlist>(`/api/v1/waitlist/entry?email=${encodeURIComponent(user!.email)}`),
        api.get<{
          request: {
            id: string
            status: string
            purgeAt: string | null
            requestedAt: string
          } | null
          retentionDays: number
        }>('/api/account/deletion-request', { timeoutMs: 12_000 }),
      ])

      if (!isApiError(deletionRes) && deletionRes.data) {
        setDeletion(deletionRes.data.request)
        if (deletionRes.data.retentionDays) setRetentionDays(deletionRes.data.retentionDays)
      }

      const res = waitlistRes
      if (!isApiError(res) && res.data) {
        const entry = res.data
        setWaitlistId(entry.id ?? null)
        const googleName = String(user?.user_metadata?.full_name || user?.user_metadata?.name || '').trim()
        const fullName = String(entry.name || googleName).trim()
        const parts = fullName.split(/\s+/).filter(Boolean)
        setFormData({
          firstName: (entry as any).firstName || parts[0] || '',
          lastName: (entry as any).lastName || parts.slice(1).join(' ') || '',
          email: entry.email || user?.email || '',
          mobileNumber: entry.mobileNumber || '',
          dateOfBirth: entry.dateOfBirth || '',
          gender: entry.gender || '',
        })
        setYurekaScore(entry.yurekaScore ?? null)
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

  const handleRequestDeletion = async () => {
    if (
      !confirm(
        `Delete your Yureka account?\n\nAn admin must approve. After approval, records are kept ${retentionDays} days, then permanently deleted.`,
      )
    ) {
      return
    }
    setDeletionBusy(true)
    setDeletionMsg(null)
    try {
      const res = await api.post<{
        request: {
          id: string
          status: string
          purgeAt: string | null
          requestedAt: string
        }
        retentionDays: number
      }>('/api/account/deletion-request', { reason: deletionReason.trim() || null }, { timeoutMs: 30_000 })
      if (isApiError(res)) throw new Error(res.error)
      setDeletion(res.data?.request || null)
      if (res.data?.retentionDays) setRetentionDays(res.data.retentionDays)
      setDeletionMsg('Request sent. We’ll email you when an admin reviews it.')
    } catch (e: any) {
      setDeletionMsg(e?.message || 'Could not submit deletion request')
    }
    setDeletionBusy(false)
  }

  const handleCancelDeletion = async () => {
    setDeletionBusy(true)
    setDeletionMsg(null)
    try {
      const res = await api.delete<{ request: unknown }>('/api/account/deletion-request', { timeoutMs: 15_000 })
      if (isApiError(res)) throw new Error(res.error)
      setDeletion(null)
      setDeletionMsg('Deletion request cancelled.')
    } catch (e: any) {
      setDeletionMsg(e?.message || 'Could not cancel')
    }
    setDeletionBusy(false)
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
      window.setTimeout(() => setShowSuccess(false), 2200)
    } catch {
      alert('Failed to update profile.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSignOut = async () => {
    setSigningOut(true)
    try {
      cacheInvalidate('auth')
      cacheInvalidate('giftcards')
      cacheInvalidate('goldback')
      cacheInvalidate('offers')
      await signOutGmail()
      navigate('/')
    } finally {
      setSigningOut(false)
    }
  }

  const enter = reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }
  const settle = { opacity: 1, y: 0 }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-40">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={spring}
          className="flex flex-col items-center gap-3"
        >
          <motion.div
            animate={reduceMotion ? undefined : { rotate: 360 }}
            transition={reduceMotion ? undefined : { duration: 1.1, repeat: Infinity, ease: 'linear' }}
            className="h-10 w-10 rounded-full border-2 border-white/10 border-t-clay"
          />
          <p className="text-[13px] text-white/45">Loading profile…</p>
        </motion.div>
      </div>
    )
  }

  const avatarUrl = googleAvatarUrl(user)
  const displayName =
    [formData.firstName, formData.lastName].filter(Boolean).join(' ') ||
    formData.email.split('@')[0] ||
    'Member'
  const initials = `${formData.firstName?.[0] || ''}${formData.lastName?.[0] || ''}`.toUpperCase() || 'U'

  return (
    <div className="mx-auto max-w-lg space-y-5">
      {/* Identity — one surface, no duplicate gender/photo tiles */}
      <motion.section
        initial={enter}
        animate={settle}
        transition={spring}
        className="relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-black/45 p-5 backdrop-blur-xl backdrop-saturate-150 sm:p-6"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />

        <div className="flex items-center gap-4">
          <motion.div whileTap={{ scale: 0.97 }} transition={springSnappy} className="shrink-0">
            <div className="flex h-[4.25rem] w-[4.25rem] items-center justify-center overflow-hidden rounded-[1.15rem] bg-clay text-[1.35rem] font-semibold tracking-[-0.04em] text-black sm:h-[4.75rem] sm:w-[4.75rem]">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                initials
              )}
            </div>
          </motion.div>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[1.35rem] font-semibold tracking-[-0.03em] text-white sm:text-[1.5rem]">
              {displayName}
            </h1>
            <p className="mt-0.5 truncate text-[13px] text-white/45">{formData.email}</p>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              {yurekaScore != null && (
                <span className="inline-flex items-center rounded-full bg-clay/15 px-2.5 py-1 text-[12px] font-semibold tabular-nums text-clay">
                  Score {yurekaScore}
                  <span className="ml-0.5 font-medium text-clay/60">/100</span>
                </span>
              )}
              <span className="inline-flex items-center rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] font-medium text-white/45">
                Signed in
              </span>
            </div>
          </div>
        </div>

        <div className="mt-5">
          <AddToHomeScreen mode="button" />
        </div>
      </motion.section>

      {/* Editable fields only — email stays in hero */}
      <motion.section
        initial={enter}
        animate={settle}
        transition={{ ...spring, delay: reduceMotion ? 0 : 0.05 }}
        className="rounded-[1.5rem] border border-white/10 bg-black/35 p-5 backdrop-blur-xl sm:p-6"
      >
        <h2 className="text-[15px] font-semibold tracking-[-0.02em] text-white">Details</h2>
        <p className="mt-1 text-[12.5px] leading-relaxed text-white/40">
          Email is locked to your login. Update mobile, birthday, and gender below.
        </p>

        <div className="mt-5 space-y-4">
          <div className="space-y-1.5">
            <label className={fieldLabel}>Email</label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/25 sm:left-5" />
              <input
                type="email"
                value={formData.email}
                disabled
                className={`${fieldShell} cursor-not-allowed border-white/[0.06] bg-white/[0.02] pr-20 text-white/35`}
              />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[11px] font-medium text-white/30">
                Locked
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className={fieldLabel}>Mobile</label>
            <div className="relative">
              <Phone className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35 sm:left-5" />
              <input
                type="tel"
                value={formData.mobileNumber}
                onChange={(e) => setFormData({ ...formData, mobileNumber: e.target.value })}
                className={fieldShell}
                placeholder="+91 XXXXX XXXXX"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className={fieldLabel}>Date of birth</label>
              <DateField
                value={formData.dateOfBirth}
                onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <label className={fieldLabel}>Gender</label>
              <select
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                className="w-full cursor-pointer appearance-none rounded-2xl border border-white/[0.08] bg-[#0a0a0a] px-4 py-3.5 text-[14px] font-medium tracking-[-0.01em] text-white outline-none focus:border-clay/40 sm:px-5 sm:py-4"
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

        <motion.button
          type="button"
          onClick={() => void handleSave()}
          disabled={isSaving || !waitlistId}
          whileTap={isSaving ? undefined : { scale: 0.98 }}
          transition={springSnappy}
          className={`mt-6 flex w-full items-center justify-center gap-2.5 rounded-2xl px-6 py-3.5 text-[14px] font-semibold tracking-[-0.015em] disabled:opacity-45 ${
            showSuccess ? 'bg-clay text-black' : 'bg-white text-black'
          }`}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={isSaving ? 'saving' : showSuccess ? 'ok' : 'idle'}
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -3 }}
              transition={springSnappy}
              className="inline-flex items-center gap-2.5"
            >
              {isSaving ? (
                <>
                  Saving…
                  <Loader2 className="animate-spin" size={17} />
                </>
              ) : showSuccess ? (
                <>
                  Saved
                  <Check size={17} strokeWidth={2.5} />
                </>
              ) : (
                <>
                  Save changes
                  <Save size={17} />
                </>
              )}
            </motion.span>
          </AnimatePresence>
        </motion.button>
      </motion.section>

      <motion.div
        initial={enter}
        animate={settle}
        transition={{ ...spring, delay: reduceMotion ? 0 : 0.08 }}
        className="space-y-4 pb-8"
      >
        <motion.button
          type="button"
          onClick={() => void handleSignOut()}
          disabled={signingOut}
          whileTap={{ scale: 0.98 }}
          transition={springSnappy}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3.5 text-[13px] font-semibold tracking-[-0.01em] text-white/55 transition-colors hover:border-white/16 hover:text-white/80 disabled:opacity-50"
        >
          <LogOut size={16} />
          {signingOut ? 'Signing out…' : 'Sign out'}
        </motion.button>

        <section
          id="delete-account"
          className="rounded-[1.5rem] border border-red-500/25 bg-red-500/[0.07] p-5 space-y-4"
        >
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-red-400">
              Danger zone
            </p>
            <h2 className="text-[15px] font-semibold tracking-[-0.02em] text-red-100">Delete account</h2>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-white/45">
              Request deletion for admin approval. If approved, we keep your records for {retentionDays} days,
              then permanently delete Goldback, gift cards, expenses, and profile data.
            </p>
          </div>

          {deletion?.status === 'pending' ? (
            <div className="space-y-3">
              <p className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-3.5 py-3 text-[12.5px] text-amber-100/90">
                Deletion request pending
                {deletion.requestedAt
                  ? ` · submitted ${new Date(deletion.requestedAt).toLocaleDateString('en-IN')}`
                  : ''}
                . You can cancel until an admin approves.
              </p>
              <button
                type="button"
                disabled={deletionBusy}
                onClick={() => void handleCancelDeletion()}
                className="w-full rounded-2xl border border-white/12 bg-white/[0.04] px-4 py-3.5 text-[13px] font-semibold text-white/75 disabled:opacity-50"
              >
                {deletionBusy ? 'Cancelling…' : 'Cancel deletion request'}
              </button>
            </div>
          ) : deletion?.status === 'approved' ? (
            <p className="rounded-xl border border-red-400/25 bg-red-500/10 px-3.5 py-3 text-[12.5px] text-red-100/90">
              Deletion approved. Permanent purge{' '}
              {deletion.purgeAt
                ? new Date(deletion.purgeAt).toLocaleString('en-IN')
                : `in about ${retentionDays} days`}
              . Contact support@yureka.one if this was a mistake.
            </p>
          ) : (
            <div className="space-y-3">
              <label className="block space-y-1.5">
                <span className="text-[12px] font-medium text-white/40">Reason (optional)</span>
                <textarea
                  value={deletionReason}
                  onChange={(e) => setDeletionReason(e.target.value)}
                  placeholder="Tell us why you’re leaving…"
                  rows={2}
                  maxLength={500}
                  className="w-full resize-none rounded-2xl border border-white/[0.08] bg-black/35 px-3.5 py-3 text-[13px] text-white placeholder:text-white/25 outline-none focus:border-red-400/35"
                />
              </label>
              <button
                type="button"
                disabled={deletionBusy || !user}
                onClick={() => void handleRequestDeletion()}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-400/35 bg-red-500/20 px-4 py-3.5 text-[13px] font-semibold text-red-100 transition-colors hover:bg-red-500/30 disabled:opacity-50"
              >
                <Trash2 size={15} />
                {deletionBusy ? 'Submitting…' : 'Delete account'}
              </button>
            </div>
          )}

          {deletionMsg ? (
            <p className="text-[12.5px] text-white/55" role="status">
              {deletionMsg}
            </p>
          ) : null}
        </section>
      </motion.div>
    </div>
  )
}

export default AccountSettings

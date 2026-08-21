import React, { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { motion } from 'motion/react'
import { establishRecoverySession, friendlyAuthError, getSupabaseBrowser } from '@shared/auth'
import { landingUrl } from '@shared/hosts'

const ResetPasswordPage: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const next = useMemo(() => searchParams.get('next') || '/dashboard', [searchParams])

  const [busy, setBusy] = useState(true)
  const [canReset, setCanReset] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      setBusy(true)
      setError(null)
      setInfo(null)
      setCanReset(false)

      const { session, error: sessionError } = await establishRecoverySession()
      if (cancelled) return

      if (!session?.user) {
        setError(friendlyAuthError(sessionError))
        setBusy(false)
        return
      }

      setCanReset(true)
      setBusy(false)
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [])

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canReset) {
      setError('This reset link is invalid or expired. Please request a new one from the login page.')
      return
    }
    if (!password || password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    const sb = getSupabaseBrowser()
    if (!sb) {
      setError('Password reset is temporarily unavailable. Please try again later.')
      return
    }

    setUpdating(true)
    setError(null)
    setInfo(null)

    const { error: updateError } = await sb.auth.updateUser({ password })
    setUpdating(false)

    if (updateError) {
      setError(friendlyAuthError(updateError.message))
      setCanReset(false)
      return
    }

    setInfo('Password updated. You can now sign in.')
    navigate(`/login?next=${encodeURIComponent(next)}`, { replace: true })
  }

  if (busy) {
    return (
      <div className="min-h-dvh bg-[#080808] flex items-center justify-center">
        <Loader2 className="animate-spin text-clay" size={40} />
      </div>
    )
  }

  return (
    <div
      className="min-h-dvh bg-[#080808] flex items-center justify-center px-5 sm:px-6 relative overflow-hidden"
      style={{
        paddingTop: 'max(3rem, env(safe-area-inset-top, 0px))',
        paddingBottom: 'max(3rem, env(safe-area-inset-bottom, 0px))',
      }}
    >
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.04]"
        style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '40px 40px' }}
      />
      <div className="fixed top-1/4 -left-1/4 w-[50%] h-[50%] bg-clay/10 blur-[120px] rounded-full pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
        className="relative z-10 w-full max-w-md bg-white/[0.04] border border-white/10 rounded-[2rem] sm:rounded-[2.5rem] p-7 sm:p-10 text-center shadow-2xl"
      >
        <div className="w-14 h-14 rounded-2xl bg-clay/15 border border-clay/25 flex items-center justify-center mx-auto mb-8">
          <svg viewBox="0 0 24 24" className="w-6 h-6 text-clay" aria-hidden>
            <path
              d="M12 12c2.21 0 4-1.79 4-4S14.21 4 12 4 8 5.79 8 8s1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"
              fill="currentColor"
            />
          </svg>
        </div>

        <h1 className="text-3xl md:text-4xl font-heading font-black text-white uppercase tracking-tighter mb-3">
          Reset password
        </h1>

        <p className="text-sm text-white/40 mb-8 leading-relaxed">
          {canReset
            ? 'Choose a new password. Once updated, you can sign in immediately.'
            : 'Request a fresh link from login, then open it in the same browser (avoid email in-app browsers).'}
        </p>

        {error && (
          <p className="mb-6 text-xs text-red-200 bg-red-500/10 border border-red-500/20 rounded-2xl px-4 py-3">
            {error}
          </p>
        )}
        {info && (
          <p className="mb-6 text-xs text-clay bg-clay/10 border border-clay/20 rounded-2xl px-4 py-3">{info}</p>
        )}

        {canReset ? (
          <form onSubmit={handleUpdate} className="space-y-3 text-left mb-5">
            <input
              className="w-full rounded-2xl bg-black/50 border border-white/10 px-4 py-3.5 text-sm text-white focus:outline-none focus:border-clay/40"
              placeholder="New password (min 8 chars)"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
            <input
              className="w-full rounded-2xl bg-black/50 border border-white/10 px-4 py-3.5 text-sm text-white focus:outline-none focus:border-clay/40"
              placeholder="Confirm new password"
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />

            <button
              type="submit"
              disabled={updating}
              className="w-full bg-clay text-black py-4 rounded-2xl font-black text-[11px] uppercase tracking-[0.25em] flex items-center justify-center gap-3 hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
            >
              {updating ? <Loader2 size={18} className="animate-spin" /> : 'Update password'}
            </button>
          </form>
        ) : null}

        <p className="mt-8 text-[10px] font-black uppercase tracking-[0.35em] text-white/25">
          <Link to="/login?mode=forgot" className="hover:text-clay transition-colors">
            Request a new link
          </Link>
          <span className="mx-3">·</span>
          <Link to={`/login?next=${encodeURIComponent(next)}`} className="hover:text-clay transition-colors">
            Back to login
          </Link>
          <span className="mx-3">·</span>
          <a href={landingUrl('/')} className="hover:text-clay transition-colors">
            Home
          </a>
        </p>
      </motion.div>
    </div>
  )
}

export default ResetPasswordPage

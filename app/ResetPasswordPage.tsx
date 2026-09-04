import React, { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { establishRecoverySession, friendlyAuthError, getSupabaseBrowser } from '@shared/auth'
import { landingUrl } from '@shared/hosts'
import AuthRingLoader from '@shared/AuthRingLoader'
import AuthPillField from '@shared/AuthPillField'
import YurekaBrandMark from '@shared/YurekaBrandMark'

const spring = { type: 'spring' as const, bounce: 0, duration: 0.35 }
const springSnappy = { type: 'spring' as const, bounce: 0, duration: 0.22 }

function AuthHero({ reduceMotion }: { reduceMotion: boolean | null }) {
  return (
    <div className="relative mx-auto mb-8 flex h-[7.5rem] w-[7.5rem] items-center justify-center">
      {!reduceMotion && (
        <>
          <motion.span
            className="absolute -left-3 top-2 h-10 w-10 rounded-full bg-clay/10 blur-[1px]"
            animate={{ y: [0, -6, 0], opacity: [0.45, 0.7, 0.45] }}
            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
            aria-hidden
          />
          <motion.span
            className="absolute -right-2 bottom-1 h-14 w-14 rounded-full bg-clay/[0.07]"
            animate={{ y: [0, 5, 0], opacity: [0.35, 0.55, 0.35] }}
            transition={{ duration: 6.5, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
            aria-hidden
          />
        </>
      )}
      <div className="relative flex h-[5.5rem] w-[5.5rem] items-center justify-center rounded-full border border-clay/20 bg-clay/[0.08] shadow-[0_0_40px_rgba(52,211,153,0.15),inset_0_1px_0_rgba(255,255,255,0.12)]">
        <YurekaBrandMark className="h-12 w-12 rounded-2xl object-cover" />
      </div>
    </div>
  )
}

const ResetPasswordPage: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const next = useMemo(() => searchParams.get('next') || '/dashboard', [searchParams])
  const reduceMotion = useReducedMotion()

  const [busy, setBusy] = useState(true)
  const [canReset, setCanReset] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
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

  const enter = reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16 }
  const settle = { opacity: 1, y: 0 }

  if (busy) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#070707]">
        <AuthRingLoader size={40} label="Loading" />
      </div>
    )
  }

  return (
    <div
      className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[#070707] px-5 sm:px-6"
      style={{
        paddingTop: 'max(1.5rem, env(safe-area-inset-top, 0px))',
        paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom, 0px))',
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif',
      }}
    >
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            'radial-gradient(ellipse 70% 45% at 50% 0%, rgba(52,211,153,0.12), transparent 60%)',
        }}
      />

      <motion.div
        initial={enter}
        animate={settle}
        transition={spring}
        className="relative z-10 w-full max-w-[22rem]"
      >
        <AuthHero reduceMotion={reduceMotion} />

        <div className="text-center">
          <h1 className="text-[1.5rem] font-semibold leading-tight tracking-[-0.03em] text-white">
            Choose a new password
          </h1>
          <p className="mt-2 text-[14px] leading-relaxed text-white/45">
            {canReset
              ? 'You can sign in right after updating.'
              : 'Request a fresh link from login, then open it in the same browser.'}
          </p>
        </div>

        <div className="mt-7 space-y-3">
          {error && (
            <p
              role="alert"
              className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-[13px] leading-relaxed text-red-100/90"
            >
              {error}
            </p>
          )}
          {info && (
            <p className="rounded-2xl border border-clay/25 bg-clay/10 px-4 py-3 text-[13px] leading-relaxed text-clay">
              {info}
            </p>
          )}

          {canReset ? (
            <form onSubmit={handleUpdate} className="space-y-3">
              <AuthPillField
                id="new-password"
                label="New password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={setPassword}
                autoComplete="new-password"
                required
                minLength={8}
                placeholder="New password"
                trailing={
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.92 }}
                    transition={springSnappy}
                    className="absolute right-3 top-1/2 z-[2] flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-clay/70 hover:text-clay"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <EyeOff size={18} strokeWidth={1.75} />
                    ) : (
                      <Eye size={18} strokeWidth={1.75} />
                    )}
                  </motion.button>
                }
              />

              <AuthPillField
                id="confirm-new-password"
                label="Confirm password"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={setConfirmPassword}
                autoComplete="new-password"
                required
                minLength={8}
                placeholder="Confirm password"
                trailing={
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.92 }}
                    transition={springSnappy}
                    className="absolute right-3 top-1/2 z-[2] flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-clay/70 hover:text-clay"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? (
                      <EyeOff size={18} strokeWidth={1.75} />
                    ) : (
                      <Eye size={18} strokeWidth={1.75} />
                    )}
                  </motion.button>
                }
              />

              <motion.button
                type="submit"
                disabled={updating}
                whileTap={{ scale: updating ? 1 : 0.98 }}
                transition={springSnappy}
                className={`mt-2 flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-[15px] font-semibold tracking-[-0.01em] shadow-[0_8px_24px_rgba(52,211,153,0.28)] disabled:opacity-50 ${
                  updating
                    ? 'bg-[#0a0a0a] text-clay ring-1 ring-clay/25'
                    : 'bg-clay text-black'
                }`}
              >
                {updating ? (
                  <AuthRingLoader size={20} label="Updating password" />
                ) : (
                  'Update password'
                )}
              </motion.button>
            </form>
          ) : null}
        </div>

        <nav
          className="mt-8 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[12px] font-medium text-white/30"
          aria-label="Reset password footer"
        >
          <Link to="/login?mode=forgot" className="transition-colors hover:text-white/55">
            Request new link
          </Link>
          <Link to={`/login?next=${encodeURIComponent(next)}`} className="transition-colors hover:text-white/55">
            Back to sign in
          </Link>
          <a href={landingUrl('/')} className="transition-colors hover:text-white/55">
            Home
          </a>
        </nav>
      </motion.div>
    </div>
  )
}

export default ResetPasswordPage

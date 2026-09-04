import React, { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Eye, EyeOff, Mail, User } from 'lucide-react'
import AuthRingLoader from '@shared/AuthRingLoader'
import AuthPillField from '@shared/AuthPillField'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useSupabase } from '@shared/SupabaseProvider'
import {
  authCallbackUrl,
  getSupabaseBrowser,
  resetPasswordForEmail,
  signInWithEmail,
  signInWithGmail,
  signUpWithEmail,
  supabaseConfigured,
} from '@shared/auth'
import { landingUrl } from '@shared/hosts'
import { GoogleSignInScopeNote } from '@shared/GmailLimitedUseNotice'
import { tryHandoffOAuthCodeToNativeApp } from '@shared/nativeAppHandoff'
import { isPasswordRecoveryCallback } from '@shared/oauthHandoff'
import YurekaBrandMark from '@shared/YurekaBrandMark'
import { WAITLIST_REQUIRED } from '@shared/waitlistGate'
import { captureGetawayRefFromSearch } from '@app/Dashboard/Getaway/getawayUtils'

/** Critically damped defaults (Apple: bounce only when gesture carries momentum). */
const spring = { type: 'spring' as const, bounce: 0, duration: 0.4 }
const springSnappy = { type: 'spring' as const, bounce: 0, duration: 0.28 }

const staggerParent = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.06, delayChildren: 0.04 },
  },
}

const staggerItem = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: spring },
}

const staggerItemReduced = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.2 } },
}

function AuthHero({ reduceMotion }: { reduceMotion: boolean | null }) {
  return (
    <motion.div
      className="relative mx-auto mb-8 flex h-[7.5rem] w-[7.5rem] items-center justify-center"
      variants={reduceMotion ? staggerItemReduced : staggerItem}
    >
      {!reduceMotion && (
        <>
          {/* Soft radial luminescence behind the mark */}
          <motion.span
            className="absolute inset-0 rounded-full bg-clay/15 blur-2xl"
            animate={{ opacity: [0.35, 0.65, 0.35], scale: [0.92, 1.05, 0.92] }}
            transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut' }}
            aria-hidden
          />
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
          <motion.span
            className="absolute right-6 top-0 h-6 w-6 rounded-full bg-white/[0.06]"
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut', delay: 0.8 }}
            aria-hidden
          />
        </>
      )}
      <motion.div
        className="relative flex h-[5.5rem] w-[5.5rem] items-center justify-center rounded-full border border-clay/20 bg-clay/[0.08] shadow-[0_0_40px_rgba(52,211,153,0.15),inset_0_1px_0_rgba(255,255,255,0.12)]"
        initial={reduceMotion ? false : { scale: 0.88, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={spring}
      >
        <YurekaBrandMark className="h-12 w-12 rounded-2xl object-cover" />
      </motion.div>
    </motion.div>
  )
}

function AmbientScene({ reduceMotion }: { reduceMotion: boolean | null }) {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 70% 45% at 50% 0%, rgba(52,211,153,0.14), transparent 60%), radial-gradient(circle at 80% 20%, rgba(52,211,153,0.07), transparent 35%)',
        }}
      />
      {!reduceMotion && (
        <>
          <motion.div
            className="absolute left-1/2 top-0 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-clay/[0.08] blur-3xl"
            animate={{ opacity: [0.35, 0.55, 0.35], scale: [1, 1.06, 1] }}
            transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
          />
          {[
            { left: '18%', top: '22%', size: 6, delay: 0 },
            { left: '72%', top: '18%', size: 4, delay: 1.2 },
            { left: '84%', top: '48%', size: 5, delay: 0.6 },
            { left: '12%', top: '58%', size: 3, delay: 2.1 },
            { left: '62%', top: '72%', size: 4, delay: 1.5 },
          ].map((p, i) => (
            <motion.span
              key={i}
              className="absolute rounded-full bg-clay/30"
              style={{
                left: p.left,
                top: p.top,
                width: p.size,
                height: p.size,
                filter: 'blur(0.5px)',
              }}
              animate={{ y: [0, -10, 0], opacity: [0.25, 0.55, 0.25] }}
              transition={{
                duration: 5 + i * 0.4,
                repeat: Infinity,
                ease: 'easeInOut',
                delay: p.delay,
              }}
            />
          ))}
        </>
      )}
    </div>
  )
}

function PrimaryAuthButton({
  busy,
  disabled,
  label,
  successPulse,
}: {
  busy: boolean
  disabled: boolean
  label: string
  successPulse: boolean
}) {
  const reduceMotion = useReducedMotion()

  return (
    <motion.button
      type="submit"
      disabled={disabled}
      whileTap={busy || disabled ? undefined : { scale: 0.98 }}
      animate={
        successPulse
          ? {
              boxShadow: [
                '0 8px 24px rgba(52,211,153,0.28)',
                '0 0 0 12px rgba(52,211,153,0.18)',
                '0 8px 24px rgba(52,211,153,0.28)',
              ],
            }
          : busy
            ? { boxShadow: '0 8px 32px rgba(52,211,153,0.42)' }
            : { boxShadow: '0 8px 24px rgba(52,211,153,0.28)' }
      }
      transition={springSnappy}
      className={`relative mt-2 flex w-full items-center justify-center gap-2 overflow-hidden rounded-full py-3.5 text-[15px] font-semibold tracking-[-0.01em] disabled:opacity-50 ${
        busy
          ? 'bg-[#0a0a0a] text-clay ring-1 ring-clay/25'
          : 'bg-clay text-black'
      }`}
    >
      {/* Specular sheen. decorative only; paused under reduced motion */}
      {!reduceMotion && !busy && (
        <motion.span
          className="pointer-events-none absolute inset-y-0 w-1/3 skew-x-[-18deg] bg-gradient-to-r from-transparent via-white/35 to-transparent"
          initial={{ left: '-40%' }}
          animate={{ left: ['-40%', '140%'] }}
          transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 3.2, ease: 'easeInOut' }}
          aria-hidden
        />
      )}
      <AnimatePresence mode="wait" initial={false}>
        {busy ? (
          <motion.span
            key="busy"
            className="relative z-10 flex items-center justify-center"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={springSnappy}
          >
            <AuthRingLoader size={20} label={label} />
          </motion.span>
        ) : (
          <motion.span
            key="label"
            className="relative z-10"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={springSnappy}
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  )
}

const LoginPage: React.FC = () => {
  const { user, currentUserStatus, isLoading, refreshUserStatus } = useSupabase()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const reduceMotion = useReducedMotion()
  const [busy, setBusy] = useState(false)
  const [successPulse, setSuccessPulse] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const location = useLocation()
  const nextPath = searchParams.get('next') || '/dashboard'
  const modeParam = searchParams.get('mode')
  const isSignup = location.pathname.endsWith('/signup') || modeParam === 'signup'
  const isForgot = modeParam === 'forgot'
  const isEmbedded =
    searchParams.get('embedded') === '1' ||
    (typeof window !== 'undefined' && window.navigator.userAgent.includes('YurekaApp'))
  const oauthReturning =
    searchParams.has('code') ||
    searchParams.has('error') ||
    searchParams.has('error_description')
  const isRecovery = isPasswordRecoveryCallback(
    location.pathname,
    location.search,
    typeof window !== 'undefined' ? window.location.hash : location.hash,
  )

  const item = reduceMotion ? staggerItemReduced : staggerItem

  const setMode = (next: 'signin' | 'signup') => {
    setError(null)
    setInfo(null)
    setSuccessPulse(false)
    if (next === 'signup') {
      navigate(`/signup${nextPath !== '/dashboard' ? `?next=${encodeURIComponent(nextPath)}` : ''}`, {
        replace: true,
      })
      return
    }
    navigate(`/login${nextPath !== '/dashboard' ? `?next=${encodeURIComponent(nextPath)}` : ''}`, {
      replace: true,
    })
  }

  captureGetawayRefFromSearch(location.search)

  useEffect(() => {
    if (document.querySelector('script[src*="accounts.google.com/gsi/client"]')) return
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    document.head.appendChild(s)
  }, [])

  useEffect(() => {
    if (!isRecovery) return
    window.location.replace(`/reset-password${window.location.search}${window.location.hash}`)
  }, [isRecovery])

  useEffect(() => {
    const oauthError = searchParams.get('error_description') || searchParams.get('error')
    if (oauthError) {
      setError(oauthError.replace(/\+/g, ' '))
    }
  }, [searchParams])

  useEffect(() => {
    if (isRecovery) return
    const code = searchParams.get('code')
    if (!code) return
    if (tryHandoffOAuthCodeToNativeApp(code)) return
    const sb = getSupabaseBrowser()
    if (!sb) return
    void sb.auth.getSession().then(({ error: sessionError }) => {
      if (sessionError) setError(sessionError.message)
    })
  }, [searchParams, isRecovery])

  useEffect(() => {
    if (isRecovery) return
    if (isLoading || currentUserStatus === 'loading') return
    if (oauthReturning && !user && !error) return
    if (!user) return

    if (currentUserStatus === 'accepted' || currentUserStatus === 'admin') {
      navigate(nextPath.startsWith('/') ? nextPath : '/dashboard', { replace: true })
      return
    }
    if (!WAITLIST_REQUIRED) {
      navigate(nextPath.startsWith('/') ? nextPath : '/dashboard', { replace: true })
      return
    }
    if (
      currentUserStatus === 'pending' ||
      currentUserStatus === 'on-hold' ||
      currentUserStatus === 'rejected'
    ) {
      navigate('/waiting', { replace: true })
      return
    }
    if (currentUserStatus === 'none') {
      navigate('/join-waitlist', { replace: true })
    }
  }, [user, currentUserStatus, isLoading, navigate, nextPath, oauthReturning, error, isRecovery])

  const handleGmail = async () => {
    setError(null)
    setInfo(null)
    setBusy(true)
    const result = await signInWithGmail(authCallbackUrl(nextPath))
    if (result.error) {
      setError(result.error)
      setBusy(false)
    }
  }

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setSuccessPulse(false)
    if (!email.trim() || !password) {
      setError('Email and password are required')
      return
    }
    if (isSignup) {
      if (password.length < 8) {
        setError('Password must be at least 8 characters')
        return
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match')
        return
      }
    }
    setBusy(true)
    const result = isSignup
      ? await signUpWithEmail({
          email,
          password,
          fullName,
          emailRedirectTo: authCallbackUrl(nextPath),
        })
      : await signInWithEmail(email, password)
    if (result.error) {
      setBusy(false)
      setError(result.error)
      return
    }
    if ('needsEmailConfirm' in result && result.needsEmailConfirm) {
      setBusy(false)
      setInfo('Check your inbox to confirm this email, then sign in to open your dashboard.')
      return
    }
    setSuccessPulse(true)
    try {
      await refreshUserStatus()
    } catch {
      /* navigate effect still handles open-waitlist signed-in users */
    }
    setBusy(false)
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setInfo(null)
    if (!email.trim()) {
      setError('Please enter your email')
      return
    }
    setBusy(true)
    const result = await resetPasswordForEmail(email)
    setBusy(false)
    if (result.error) {
      setError(result.error)
      return
    }
    setInfo('If an account exists for this email, we will send you a password reset link.')
  }

  if (isRecovery || isLoading || (oauthReturning && !user && !error)) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#070707]">
        <AuthRingLoader size={40} label="Signing you in" />
      </div>
    )
  }

  const title = isForgot
    ? 'Reset your password'
    : isSignup
      ? 'Create your account'
      : 'Sign in to continue'

  const primaryLabel = isForgot ? 'Send reset link' : isSignup ? 'Create account' : 'Sign in'

  return (
    <div
      className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[#070707] px-5 sm:px-6"
      style={{
        paddingTop: 'max(1.5rem, env(safe-area-inset-top, 0px))',
        paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom, 0px))',
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif',
      }}
    >
      {!isEmbedded && <AmbientScene reduceMotion={reduceMotion} />}

      <motion.div
        className="relative z-10 w-full max-w-[22rem]"
        variants={staggerParent}
        initial="hidden"
        animate="show"
      >
        <AuthHero reduceMotion={reduceMotion} />

        <motion.div className="text-center" variants={item}>
          <h1 className="text-[1.5rem] font-semibold leading-tight tracking-[-0.03em] text-white">
            {title}
          </h1>
          {isForgot && (
            <p className="mt-2 text-[14px] leading-relaxed text-white/45">
              Enter your email and we will send a reset link.
            </p>
          )}
        </motion.div>

        {isForgot && (
          <motion.div className="mt-4 text-center" variants={item}>
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              transition={springSnappy}
              className="text-[13px] font-medium text-clay/90"
              onClick={() => navigate(`/login?next=${encodeURIComponent(nextPath)}`, { replace: true })}
              disabled={busy}
            >
              Back to sign in
            </motion.button>
          </motion.div>
        )}

        <motion.div className="mt-7 space-y-3" variants={item}>
          {!supabaseConfigured && (
            <p className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-[13px] leading-relaxed text-amber-100/90">
              Sign-in is temporarily unavailable. Please try again later.
            </p>
          )}

          <AnimatePresence>
            {error && (
              <motion.p
                key="error"
                role="alert"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={springSnappy}
                className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-[13px] leading-relaxed text-red-100/90"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {info && (
              <motion.p
                key="info"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={springSnappy}
                className="rounded-2xl border border-clay/25 bg-clay/10 px-4 py-3 text-[13px] leading-relaxed text-clay"
              >
                {info}
              </motion.p>
            )}
          </AnimatePresence>

          <form onSubmit={isForgot ? handleForgotPassword : handleEmailAuth} className="space-y-3">
            {isSignup && (
              <AuthPillField
                id="full-name"
                label="Full name"
                value={fullName}
                onChange={setFullName}
                autoComplete="name"
                placeholder="Full name"
                icon={<User size={18} strokeWidth={1.75} />}
              />
            )}
            <AuthPillField
              id="email"
              label="Email"
              type="email"
              value={email}
              onChange={setEmail}
              autoComplete="email"
              required
              placeholder="Email"
              icon={<Mail size={18} strokeWidth={1.75} />}
            />
            {!isForgot && (
              <>
                <AuthPillField
                  id="password"
                  label="Password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={setPassword}
                  autoComplete={isSignup ? 'new-password' : 'current-password'}
                  required
                  minLength={isSignup ? 8 : undefined}
                  placeholder="Password"
                  trailing={
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.92 }}
                      whileHover={{ scale: 1.05 }}
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
                {isSignup && (
                  <AuthPillField
                    id="confirm-password"
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
                        whileHover={{ scale: 1.05 }}
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
                )}
              </>
            )}

            <PrimaryAuthButton
              busy={busy}
              disabled={busy || !supabaseConfigured}
              label={primaryLabel}
              successPulse={successPulse}
            />
          </form>

          {!isForgot && !isSignup && (
            <p className="px-1 pt-2 text-center text-[12px] leading-relaxed text-white/45">
              Google accounts need Continue with Google, or Forgot password to create an email password.
            </p>
          )}

          {!isForgot && !isSignup && (
            <p className="pt-1 text-center">
              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                transition={springSnappy}
                className="text-[13px] font-medium text-clay/85 hover:text-clay"
                onClick={() =>
                  navigate(`/login?mode=forgot&next=${encodeURIComponent(nextPath)}`, { replace: true })
                }
                disabled={busy}
              >
                Forgot password?
              </motion.button>
            </p>
          )}

          {!isForgot && (
            <>
              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/8" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-[#070707] px-3 text-[12px] font-medium text-white/30">or</span>
                </div>
              </div>

              <motion.button
                type="button"
                onClick={handleGmail}
                disabled={busy || !supabaseConfigured}
                whileTap={busy ? undefined : { scale: 0.98 }}
                transition={springSnappy}
                className="flex w-full items-center justify-center gap-3 rounded-full border border-white/12 bg-white/[0.04] py-3.5 text-[15px] font-semibold tracking-[-0.01em] text-white transition-colors hover:border-white/20 hover:bg-white/[0.06] disabled:opacity-50"
              >
                {busy ? (
                  <AuthRingLoader size={20} label="Connecting to Google" />
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" aria-hidden>
                      <path
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        fill="#4285F4"
                      />
                      <path
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        fill="#34A853"
                      />
                      <path
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        fill="#FBBC05"
                      />
                      <path
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        fill="#EA4335"
                      />
                    </svg>
                    Continue with Google
                  </>
                )}
              </motion.button>
              <GoogleSignInScopeNote className="text-center text-[11px] leading-relaxed text-white/35" />
            </>
          )}
        </motion.div>

        {!isForgot && (
          <motion.p className="mt-8 text-center text-[14px] text-white/45" variants={item}>
            {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              transition={springSnappy}
              className="font-semibold text-clay hover:text-clay/90"
              onClick={() => setMode(isSignup ? 'signin' : 'signup')}
            >
              {isSignup ? 'Sign in' : 'Sign up'}
            </motion.button>
          </motion.p>
        )}

        <motion.nav
          className="mt-8 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[12px] font-medium text-white/30"
          aria-label="Auth footer"
          variants={item}
        >
          <Link to="/dashboard" className="transition-colors hover:text-white/55">
            Dashboard
          </Link>
          <a href={landingUrl('/')} className="transition-colors hover:text-white/55">
            Home
          </a>
          <a href={landingUrl('/privacy-policy')} className="transition-colors hover:text-white/55">
            Privacy
          </a>
          <a href={landingUrl('/terms-of-service')} className="transition-colors hover:text-white/55">
            Terms
          </a>
        </motion.nav>
      </motion.div>
    </div>
  )
}

export default LoginPage

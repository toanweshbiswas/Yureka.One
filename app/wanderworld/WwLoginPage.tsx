import React, { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Loader2, LogIn, UserPlus } from 'lucide-react'
import { motion } from 'motion/react'
import { useSupabase } from '@shared/SupabaseProvider'
import {
  getSupabaseBrowser,
  resetPasswordForEmail,
  signInWithEmail,
  signInWithGmail,
  signUpWithEmail,
  supabaseConfigured,
  wanderworldAuthCallbackUrl,
  wanderworldResetPasswordCallbackUrl,
} from '@shared/auth'
import { landingUrl } from '@shared/hosts'
import { isPasswordRecoveryCallback } from '@shared/oauthHandoff'
import { WwLogo } from './wwBrand'
import { wwHomePath, wwLoginPath, wwResetPath, wwSignupPath } from './wwPaths'

function safeWwNext(raw: string | null) {
  const home = wwHomePath()
  const next = (raw || home).startsWith('/') ? raw || home : `/${raw || home}`
  // Never follow app dashboard / waitlist after WW auth.
  if (
    next.startsWith('/dashboard') ||
    next.startsWith('/login') ||
    next.startsWith('/waiting') ||
    next.startsWith('/join-waitlist') ||
    next.startsWith('/admin') ||
    next.startsWith('/brand')
  ) {
    return home
  }
  return next
}

const WwLoginPage: React.FC = () => {
  const { user, isLoading } = useSupabase()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [email, setEmail] = useState(() => searchParams.get('email') || '')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fullName, setFullName] = useState('')

  const location = useLocation()
  const nextPath = safeWwNext(searchParams.get('next'))
  const modeParam = searchParams.get('mode')
  const isSignup = location.pathname.endsWith('/signup') || modeParam === 'signup'
  const isForgot = modeParam === 'forgot'
  const oauthReturning =
    searchParams.has('code') ||
    searchParams.has('error') ||
    searchParams.has('error_description')
  const isRecovery = isPasswordRecoveryCallback(
    location.pathname,
    location.search,
    typeof window !== 'undefined' ? window.location.hash : location.hash,
  )

  const setMode = (next: 'signin' | 'signup') => {
    setError(null)
    setInfo(null)
    const dest = next === 'signup' ? wwSignupPath() : wwLoginPath()
    navigate(`${dest}?next=${encodeURIComponent(nextPath)}`, { replace: true })
  }

  useEffect(() => {
    if (!isRecovery) return
    window.location.replace(`${wwResetPath()}${window.location.search}${window.location.hash}`)
  }, [isRecovery])

  useEffect(() => {
    const oauthError = searchParams.get('error_description') || searchParams.get('error')
    if (oauthError) setError(oauthError.replace(/\+/g, ' '))
  }, [searchParams])

  useEffect(() => {
    if (isRecovery) return
    if (!searchParams.has('code')) return
    const sb = getSupabaseBrowser()
    if (!sb) return
    void sb.auth.getSession().then(({ error: sessionError }) => {
      if (sessionError) setError(sessionError.message)
    })
  }, [searchParams, isRecovery])

  useEffect(() => {
    if (isRecovery) return
    if (isLoading) return
    if (oauthReturning && !user && !error) return
    if (!user) return
    navigate(nextPath, { replace: true })
  }, [user, isLoading, navigate, nextPath, oauthReturning, error, isRecovery])

  const onGoogle = async () => {
    setBusy(true)
    setError(null)
    const result = await signInWithGmail(wanderworldAuthCallbackUrl(nextPath))
    if (result.error) {
      setError(result.error)
      setBusy(false)
    }
  }

  const onEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabaseConfigured) {
      setError('Sign-in is temporarily unavailable.')
      return
    }
    setBusy(true)
    setError(null)
    setInfo(null)
    if (isForgot) {
      const result = await resetPasswordForEmail(email, wanderworldResetPasswordCallbackUrl())
      setBusy(false)
      if (result.error) setError(result.error)
      else setInfo('Check your email for a reset link.')
      return
    }
    if (isSignup) {
      if (password !== confirmPassword) {
        setBusy(false)
        setError('Passwords do not match')
        return
      }
      const result = await signUpWithEmail({
        email,
        password,
        fullName,
        emailRedirectTo: wanderworldAuthCallbackUrl(nextPath),
      })
      setBusy(false)
      if (result.error) setError(result.error)
      else if (result.needsEmailConfirm) setInfo('Check your email to confirm, then sign in.')
      else setInfo('Account created.')
      return
    }
    const result = await signInWithEmail(email, password)
    setBusy(false)
    if (result.error) setError(result.error)
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden px-5 py-10">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(245,197,24,0.08),transparent_55%),#080808]"
        aria-hidden
      />
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
        className="relative z-[1] w-full max-w-md rounded-[2rem] border border-white/[0.08] bg-white/[0.04] p-8 shadow-[0_1px_0_rgba(255,255,255,0.05)_inset] backdrop-blur-xl"
      >
        <div className="flex flex-col items-center text-center">
          <WwLogo size="hero" />
          <h1 className="sr-only">WanderWorld</h1>
          {(isForgot || isSignup) && (
            <p className="mt-4 text-sm text-white/45">
              {isForgot ? 'Reset password' : 'Create your account'}
            </p>
          )}
        </div>

        {error && (
          <p className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs text-red-200">
            {error}
          </p>
        )}
        {info && (
          <p className="mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-100">
            {info}
          </p>
        )}

        {!isForgot && (
          <button
            type="button"
            onClick={onGoogle}
            disabled={busy || isLoading}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-3.5 text-[11px] font-black uppercase tracking-[0.2em] text-black transition active:scale-[0.97] disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
            Continue with Google
          </button>
        )}

        <form onSubmit={onEmail} className="mt-5 space-y-3">
          {isSignup && !isForgot && (
            <input
              className="w-full rounded-2xl border border-white/10 bg-black/50 px-4 py-3.5 text-sm text-white"
              placeholder="Full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          )}
          <input
            className="w-full rounded-2xl border border-white/10 bg-black/50 px-4 py-3.5 text-sm text-white"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          {!isForgot && (
            <input
              className="w-full rounded-2xl border border-white/10 bg-black/50 px-4 py-3.5 text-sm text-white"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
          )}
          {isSignup && !isForgot && (
            <input
              className="w-full rounded-2xl border border-white/10 bg-black/50 px-4 py-3.5 text-sm text-white"
              type="password"
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={8}
              required
            />
          )}
          <button
            type="submit"
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-clay py-4 text-[11px] font-black uppercase tracking-[0.25em] text-black transition active:scale-[0.97] disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : isSignup ? <UserPlus className="h-4 w-4" /> : null}
            {isForgot ? 'Send reset link' : isSignup ? 'Create account' : 'Sign in'}
          </button>
        </form>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-[10px] font-black uppercase tracking-[0.25em] text-white/35">
          {!isForgot && (
            <button type="button" onClick={() => setMode(isSignup ? 'signin' : 'signup')}>
              {isSignup ? 'Have an account?' : 'Need an account?'}
            </button>
          )}
          <button
            type="button"
            onClick={() =>
              navigate(`${wwLoginPath()}?mode=forgot&next=${encodeURIComponent(nextPath)}`, { replace: true })
            }
          >
            Forgot password
          </button>
          <Link to={landingUrl('/')}>Yureka</Link>
        </div>
      </motion.div>
    </div>
  )
}

export default WwLoginPage

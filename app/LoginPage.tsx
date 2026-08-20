import React, { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { motion } from 'motion/react'
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
import { tryHandoffOAuthCodeToNativeApp } from '@shared/nativeAppHandoff'
import { isPasswordRecoveryCallback } from '@shared/oauthHandoff'
import YurekaBrandMark from '@shared/YurekaBrandMark'

const LoginPage: React.FC = () => {
  const { user, currentUserStatus, isLoading } = useSupabase()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fullName, setFullName] = useState('')

  const location = useLocation()
  const nextPath = searchParams.get('next') || '/dashboard'
  const modeParam = searchParams.get('mode')
  const isSignup = location.pathname.endsWith('/signup') || modeParam === 'signup'
  const isForgot = modeParam === 'forgot'
  // Running inside the Yureka native app's WebView — hide decorative web chrome.
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

  const setMode = (next: 'signin' | 'signup') => {
    setError(null)
    setInfo(null)
    if (next === 'signup') {
      navigate(`/signup${nextPath !== '/dashboard' ? `?next=${encodeURIComponent(nextPath)}` : ''}`, { replace: true })
      return
    }
    navigate(`/login${nextPath !== '/dashboard' ? `?next=${encodeURIComponent(nextPath)}` : ''}`, { replace: true })
  }

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
      ? await signUpWithEmail({ email, password, fullName })
      : await signInWithEmail(email, password)
    setBusy(false)
    if (result.error) {
      setError(result.error)
      return
    }
    if ('needsEmailConfirm' in result && result.needsEmailConfirm) {
      setInfo('Check your inbox to confirm this email, then sign in. If you are new, join the waitlist after confirming.')
      return
    }
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
    setInfo('If an account exists for this email, we’ll send you a password reset link.')
  }

  if (
    isRecovery ||
    isLoading ||
    (oauthReturning && !user && !error)
  ) {
    return (
      <div className="min-h-screen bg-[#080808] flex items-center justify-center">
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
      {!isEmbedded && <div className="fixed inset-0 pointer-events-none opacity-[0.04]" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />}
      {!isEmbedded && <div className="fixed top-1/4 -left-1/4 w-[50%] h-[50%] bg-clay/10 blur-[120px] rounded-full pointer-events-none" />}

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
        className="relative z-10 w-full max-w-md bg-white/[0.04] border border-white/10 rounded-[2rem] sm:rounded-[2.5rem] p-7 sm:p-10 text-center shadow-2xl"
      >
        <YurekaBrandMark className="w-14 h-14 rounded-2xl object-cover mx-auto mb-8 shadow-[0_0_24px_rgba(0,147,59,0.28)]" />
        <h1 className="text-3xl md:text-4xl font-heading font-black text-white uppercase tracking-tighter mb-3">
          {isForgot ? 'Reset password' : isSignup ? 'Create account' : 'Welcome back'}
        </h1>
        <p className="text-sm text-white/40 mb-8 leading-relaxed">
          {isForgot
            ? 'Enter your email and we’ll send you a password reset link.'
            : isSignup
              ? 'Sign up with email. Dashboard access still goes through the waitlist unless you were invited.'
              : 'Sign in with email or Gmail. New here? Create an account, then join the waitlist.'}
        </p>

        {!isForgot && (
          <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-black/40 border border-white/10 mb-7">
            <button
              type="button"
              onClick={() => setMode('signin')}
              className={`rounded-xl py-2.5 text-[10px] font-black uppercase tracking-[0.18em] ${
                !isSignup ? 'bg-clay text-black' : 'text-white/40 hover:text-white'
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => setMode('signup')}
              className={`rounded-xl py-2.5 text-[10px] font-black uppercase tracking-[0.18em] ${
                isSignup ? 'bg-clay text-black' : 'text-white/40 hover:text-white'
              }`}
            >
              Sign up
            </button>
          </div>
        )}

        {isForgot && (
          <div className="mb-7 text-left">
            <button
              type="button"
              className="text-[10px] font-black uppercase tracking-[0.18em] text-white/40 hover:text-white transition-colors"
              onClick={() => navigate(`/login?next=${encodeURIComponent(nextPath)}`, { replace: true })}
              disabled={busy}
            >
              Back to sign in
            </button>
          </div>
        )}

        {!supabaseConfigured && (
          <p className="mb-6 text-xs text-amber-200/90 bg-amber-500/10 border border-amber-500/20 rounded-2xl px-4 py-3">
            Sign-in is temporarily unavailable. Please try again later.
          </p>
        )}

        {error && (
          <p className="mb-6 text-xs text-red-200 bg-red-500/10 border border-red-500/20 rounded-2xl px-4 py-3">
            {error}
          </p>
        )}
        {info && (
          <p className="mb-6 text-xs text-clay bg-clay/10 border border-clay/20 rounded-2xl px-4 py-3">
            {info}
          </p>
        )}

        <form onSubmit={isForgot ? handleForgotPassword : handleEmailAuth} className="space-y-3 text-left mb-5">
          {isSignup && (
            <input
              className="w-full rounded-2xl bg-black/50 border border-white/10 px-4 py-3.5 text-sm text-white focus:outline-none focus:border-clay/40"
              placeholder="Full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="name"
            />
          )}
          <input
            className="w-full rounded-2xl bg-black/50 border border-white/10 px-4 py-3.5 text-sm text-white focus:outline-none focus:border-clay/40"
            placeholder="Email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
          {!isForgot && (
            <input
              className="w-full rounded-2xl bg-black/50 border border-white/10 px-4 py-3.5 text-sm text-white focus:outline-none focus:border-clay/40"
              placeholder={isSignup ? 'Password (min 8 characters)' : 'Password'}
              type="password"
              required
              minLength={isSignup ? 8 : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={isSignup ? 'new-password' : 'current-password'}
            />
          )}
          {!isForgot && !isSignup && (
            <div className="flex justify-end -mt-1">
              <button
                type="button"
                className="text-[10px] font-black uppercase tracking-[0.18em] text-white/40 hover:text-white transition-colors"
                onClick={() => navigate(`/login?mode=forgot&next=${encodeURIComponent(nextPath)}`, { replace: true })}
                disabled={busy}
              >
                Forgot password?
              </button>
            </div>
          )}
          {isSignup && (
            <input
              className="w-full rounded-2xl bg-black/50 border border-white/10 px-4 py-3.5 text-sm text-white focus:outline-none focus:border-clay/40"
              placeholder="Confirm password"
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
          )}
          <button
            type="submit"
            disabled={busy || !supabaseConfigured}
            className="w-full bg-clay text-black py-4 rounded-2xl font-black text-[11px] uppercase tracking-[0.25em] flex items-center justify-center gap-3 hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
          >
            {busy ? (
              <Loader2 size={18} className="animate-spin" />
            ) : isForgot ? (
              'Send reset link'
            ) : isSignup ? (
              'Create account'
            ) : (
              'Sign in'
            )}
          </button>
        </form>

        {!isForgot && (
          <div className="relative my-5">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10" /></div>
          <span className="relative bg-[#121212] px-3 text-[10px] font-black uppercase tracking-[0.25em] text-white/30">or</span>
          </div>
        )}

        {!isForgot && (
          <button
            type="button"
            onClick={handleGmail}
            disabled={busy || !supabaseConfigured}
            className="w-full bg-white text-black py-4 rounded-2xl font-black text-[11px] uppercase tracking-[0.25em] flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-95 transition-all touch-manipulation disabled:opacity-50"
          >
            {busy ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <>
                <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden>
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
                Continue with Gmail
              </>
            )}
          </button>
        )}

        <p className="mt-8 text-[10px] font-black uppercase tracking-[0.35em] text-white/25">
          <Link to="/join-waitlist" className="hover:text-clay transition-colors">
            Join the waitlist
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

export default LoginPage

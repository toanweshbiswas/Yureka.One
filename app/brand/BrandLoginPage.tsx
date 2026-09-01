import React, { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Loader2, LogIn, UserPlus } from 'lucide-react'
import { motion } from 'motion/react'
import { useSupabase } from '@shared/SupabaseProvider'
import {
  brandAuthCallbackUrl,
  brandResetPasswordCallbackUrl,
  getSupabaseBrowser,
  resetPasswordForEmail,
  signInWithEmail,
  signInWithGmail,
  signUpWithEmail,
  supabaseConfigured,
} from '@shared/auth'
import { landingUrl } from '@shared/hosts'
import { GoogleSignInScopeNote } from '@shared/GmailLimitedUseNotice'
import { isPasswordRecoveryCallback } from '@shared/oauthHandoff'

const BrandLoginPage: React.FC = () => {
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
  const nextPath = searchParams.get('next') || '/brand'
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
    const dest = next === 'signup' ? '/brand/signup' : '/brand/login'
    navigate(`${dest}?next=${encodeURIComponent(nextPath)}`, { replace: true })
  }

  useEffect(() => {
    if (!isRecovery) return
    window.location.replace(`/brand/reset-password${window.location.search}${window.location.hash}`)
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
    navigate(nextPath.startsWith('/brand') ? nextPath : '/brand', { replace: true })
  }, [user, isLoading, navigate, nextPath, oauthReturning, error, isRecovery])

  const handleGmail = async () => {
    setError(null)
    setInfo(null)
    setBusy(true)
    const result = await signInWithGmail(brandAuthCallbackUrl(nextPath))
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
      ? await signUpWithEmail({
          email,
          password,
          fullName,
          emailRedirectTo: brandAuthCallbackUrl(nextPath),
        })
      : await signInWithEmail(email, password)
    setBusy(false)
    if (result.error) {
      setError(result.error)
      return
    }
    if ('needsEmailConfirm' in result && result.needsEmailConfirm) {
      setInfo('Check your inbox to confirm this email, then sign in to the brand portal.')
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
    const result = await resetPasswordForEmail(email, brandResetPasswordCallbackUrl())
    setBusy(false)
    if (result.error) {
      setError(result.error)
      return
    }
    setInfo('If an account exists for this email, we’ll send you a password reset link.')
  }

  if (isRecovery || isLoading || (oauthReturning && !user && !error)) {
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
      <div className="fixed inset-0 pointer-events-none opacity-[0.04]" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-md bg-white/[0.04] border border-white/10 rounded-[2rem] sm:rounded-[2.5rem] p-7 sm:p-10 text-center shadow-2xl"
      >
        <div className="w-14 h-14 rounded-2xl bg-clay/15 border border-clay/25 flex items-center justify-center mx-auto mb-8">
          {isSignup ? <UserPlus className="text-clay" size={24} /> : <LogIn className="text-clay" size={24} />}
        </div>
        <h1 className="text-3xl md:text-4xl font-heading font-black text-white uppercase tracking-tighter mb-3">
          {isForgot ? 'Reset password' : isSignup ? 'Join the portal' : 'Brand portal'}
        </h1>
        <p className="text-sm text-white/40 mb-8 leading-relaxed">
          {isForgot
            ? 'Enter the email you were invited with.'
            : isSignup
              ? 'Create an account with the email Yureka invited. Access is invite-only.'
              : 'Sign in with the email your Yureka admin invited.'}
        </p>

        {!isForgot && (
          <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-black/40 border border-white/10 mb-7">
            <button type="button" onClick={() => setMode('signin')} className={`rounded-xl py-2.5 text-[10px] font-black uppercase tracking-[0.18em] ${!isSignup ? 'bg-clay text-black' : 'text-white/40 hover:text-white'}`}>
              Sign in
            </button>
            <button type="button" onClick={() => setMode('signup')} className={`rounded-xl py-2.5 text-[10px] font-black uppercase tracking-[0.18em] ${isSignup ? 'bg-clay text-black' : 'text-white/40 hover:text-white'}`}>
              Sign up
            </button>
          </div>
        )}

        {error && <p className="mb-6 text-xs text-red-200 bg-red-500/10 border border-red-500/20 rounded-2xl px-4 py-3">{error}</p>}
        {info && <p className="mb-6 text-xs text-clay bg-clay/10 border border-clay/20 rounded-2xl px-4 py-3">{info}</p>}

        <form onSubmit={isForgot ? handleForgotPassword : handleEmailAuth} className="space-y-3 text-left mb-5">
          {isSignup && (
            <input className="w-full rounded-2xl bg-black/50 border border-white/10 px-4 py-3.5 text-sm text-white focus:outline-none focus:border-clay/40" placeholder="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" />
          )}
          <input className="w-full rounded-2xl bg-black/50 border border-white/10 px-4 py-3.5 text-sm text-white focus:outline-none focus:border-clay/40" placeholder="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          {!isForgot && (
            <input className="w-full rounded-2xl bg-black/50 border border-white/10 px-4 py-3.5 text-sm text-white focus:outline-none focus:border-clay/40" placeholder={isSignup ? 'Password (min 8 characters)' : 'Password'} type="password" required minLength={isSignup ? 8 : undefined} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={isSignup ? 'new-password' : 'current-password'} />
          )}
          {!isForgot && !isSignup && (
            <div className="flex justify-end -mt-1">
              <button type="button" className="text-[10px] font-black uppercase tracking-[0.18em] text-white/40 hover:text-white" onClick={() => navigate(`/brand/login?mode=forgot&next=${encodeURIComponent(nextPath)}`, { replace: true })}>
                Forgot password?
              </button>
            </div>
          )}
          {isSignup && (
            <input className="w-full rounded-2xl bg-black/50 border border-white/10 px-4 py-3.5 text-sm text-white focus:outline-none focus:border-clay/40" placeholder="Confirm password" type="password" required minLength={8} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" />
          )}
          <button type="submit" disabled={busy || !supabaseConfigured} className="w-full bg-clay text-black py-4 rounded-2xl font-black text-[11px] uppercase tracking-[0.25em] flex items-center justify-center gap-3 disabled:opacity-50">
            {busy ? <Loader2 size={18} className="animate-spin" /> : isForgot ? 'Send reset link' : isSignup ? 'Create account' : 'Sign in'}
          </button>
        </form>

        {!isForgot && (
          <>
          <button type="button" onClick={handleGmail} disabled={busy || !supabaseConfigured} className="w-full bg-white text-black py-4 rounded-2xl font-black text-[11px] uppercase tracking-[0.25em] flex items-center justify-center gap-3 disabled:opacity-50">
            Continue with Google
          </button>
          <GoogleSignInScopeNote variant="ops" className="mt-3 text-center text-[11px] leading-relaxed text-white/35" />
          </>
        )}

        <p className="mt-8 text-[10px] font-black uppercase tracking-[0.35em] text-white/25">
          <a href={landingUrl('/for-brands')} className="hover:text-clay">Partnership deck</a>
          <span className="mx-3">·</span>
          <Link to="/brand/login?mode=forgot" className="hover:text-clay">Need help?</Link>
        </p>
      </motion.div>
    </div>
  )
}

export default BrandLoginPage

import React, { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { establishRecoverySession, friendlyAuthError, getSupabaseBrowser } from '@shared/auth'
import { WwLogo } from './wwBrand'
import { wwHomePath, wwLoginPath } from './wwPaths'

const WwResetPasswordPage: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const next = useMemo(() => searchParams.get('next') || wwHomePath(), [searchParams])
  const [busy, setBusy] = useState(true)
  const [canReset, setCanReset] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const { session, error: sessionError } = await establishRecoverySession()
      if (cancelled) return
      if (!session?.user) {
        setError(friendlyAuthError(sessionError))
        setBusy(false)
        return
      }
      setCanReset(true)
      setBusy(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canReset) {
      setError('This reset link is invalid or expired.')
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
      setError('Password reset is temporarily unavailable.')
      return
    }
    setUpdating(true)
    const { error: updateError } = await sb.auth.updateUser({ password })
    setUpdating(false)
    if (updateError) {
      setError(friendlyAuthError(updateError.message))
      return
    }
    navigate(next.startsWith('/') ? next : wwHomePath(), { replace: true })
  }

  return (
    <div className="min-h-dvh bg-[#080808] flex items-center justify-center px-5">
      <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-white/[0.04] p-8">
        <div className="mb-6 flex justify-center">
          <WwLogo size="inline" />
        </div>
        <h1 className="mb-2 text-2xl font-black uppercase tracking-tighter text-white">New password</h1>
        <p className="mb-6 text-sm text-white/40">Set a password for your WanderWorld account.</p>
        {busy && <Loader2 className="mx-auto animate-spin text-clay" />}
        {error && (
          <p className="mb-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs text-red-200">
            {error}
          </p>
        )}
        {canReset && (
          <form onSubmit={handleUpdate} className="space-y-3">
            <input
              className="w-full rounded-2xl border border-white/10 bg-black/50 px-4 py-3.5 text-sm text-white"
              type="password"
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
            <input
              className="w-full rounded-2xl border border-white/10 bg-black/50 px-4 py-3.5 text-sm text-white"
              type="password"
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={8}
              required
            />
            <button
              type="submit"
              disabled={updating}
              className="w-full rounded-2xl bg-clay py-4 text-[11px] font-black uppercase tracking-[0.25em] text-black transition active:scale-[0.97] disabled:opacity-50"
            >
              {updating ? 'Saving…' : 'Save password'}
            </button>
          </form>
        )}
        <p className="mt-6 text-center text-[10px] font-black uppercase tracking-[0.3em] text-white/30">
          <Link to={wwLoginPath()}>Back to login</Link>
        </p>
      </div>
    </div>
  )
}

export default WwResetPasswordPage

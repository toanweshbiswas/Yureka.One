import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  LogIn, LogOut, Loader2, Search, CheckCircle, XCircle, PauseCircle,
  Clock, RefreshCw, Filter, ShieldCheck, Users, Coins, Plus, Trash2, KeyRound,
  Activity, Gift, LayoutDashboard, BookOpen, Layers, Pencil, ArrowDownAZ,
} from 'lucide-react'
import { normalizeEmail } from '@backend/lib/mail/emailAddress'
import type { AdminOverview } from '@backend/lib/admin/overview'
import { GiftOrdersTab, OverviewTab, UsersTab, ScoreBadge, ScoreSignals, UserScoreAnalysis } from './admin/ActivityViews'
import { DeletionsTab } from './admin/DeletionsTab'
import BlogsTab from './admin/BlogsTab'
import ClubHub, { type ClubSubTab } from './admin/ClubHub'
import { compareWaitlistRows, type WaitlistSortKey } from './admin/listSort'
import {
  Callout,
  ConfirmDialog,
  EmptyState,
  FieldLabel,
  ImageUrlField,
  PageHeader,
  Surface,
  fieldClass,
  ghostBtnClass,
  pressClass,
  primaryBtnClass,
  secondaryBtnClass,
  surfaceClass,
} from './admin/ui'

type AdminRole = 'viewer' | 'admin' | 'superadmin'
type Tab = 'overview' | 'waitlist' | 'users' | 'deletions' | 'gifts' | 'club' | 'ledger' | 'blogs' | 'admins'

const ADMIN_TOKEN_KEY = 'yureka_admin_token'
const ADMIN_ROLE_KEY = 'yureka_admin_role'
const ADMIN_EMAIL_KEY = 'yureka_admin_email'

interface Envelope<T> {
  data: T | null
  status: number
  error?: string
}

async function adminFetch<T>(path: string, token: string | null, init?: RequestInit): Promise<Envelope<T>> {
  try {
    const headers: Record<string, string> = {
      ...(token ? { 'X-Admin-Session': token } : {}),
    }
    if (init?.body) headers['Content-Type'] = 'application/json'
    const res = await fetch(path, {
      ...init,
      headers: {
        ...headers,
        ...(init?.headers || {}),
      },
    })
    const json = (await res.json()) as Envelope<T>
    if (!res.ok && !json.error) {
      return { data: null, status: res.status, error: `Request failed (${res.status})` }
    }
    return json
  } catch {
    return { data: null, status: 503, error: 'Admin API unreachable' }
  }
}

function formatPaise(paise: number) {
  return `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

function formatSignedPaise(paise: number) {
  const sign = paise > 0 ? '+' : paise < 0 ? '−' : ''
  return `${sign}${formatPaise(Math.abs(paise))}`
}

function rupeesToPaise(raw: string): number | null {
  const n = Number(String(raw).trim().replace(/,/g, ''))
  if (!Number.isFinite(n)) return null
  return Math.round(n * 100)
}

const STATUS_TABS = [
  { id: 'all', label: 'All', icon: Filter },
  { id: 'pending', label: 'Pending', icon: Clock },
  { id: 'accepted', label: 'Accepted', icon: CheckCircle },
  { id: 'on_hold', label: 'On Hold', icon: PauseCircle },
  { id: 'rejected', label: 'Rejected', icon: XCircle },
] as const

const AdminDashboard: React.FC = () => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(ADMIN_TOKEN_KEY))
  const [role, setRole] = useState<AdminRole | null>(() => localStorage.getItem(ADMIN_ROLE_KEY) as AdminRole | null)
  const [email, setEmail] = useState(() => localStorage.getItem(ADMIN_EMAIL_KEY) || '')
  const [password, setPassword] = useState('')
  const [loginEmail, setLoginEmail] = useState('')
  const [authError, setAuthError] = useState<string | null>(null)
  const [signingIn, setSigningIn] = useState(false)
  const [tab, setTab] = useState<Tab>('overview')
  const [clubSub, setClubSub] = useState<ClubSubTab>('offers')
  const [searchParams, setSearchParams] = useSearchParams()
  const inviteToken = searchParams.get('token') || ''

  useEffect(() => {
    const t = searchParams.get('tab')
    if (
      t === 'overview' ||
      t === 'waitlist' ||
      t === 'users' ||
      t === 'deletions' ||
      t === 'gifts' ||
      t === 'club' ||
      t === 'ledger' ||
      t === 'blogs' ||
      t === 'admins'
    ) {
      setTab(t)
    }
  }, [searchParams])
  const [invitePreview, setInvitePreview] = useState<{ email: string; role: string } | null>(null)
  const [invitePreviewError, setInvitePreviewError] = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [settingPassword, setSettingPassword] = useState(false)
  const [inviteNotice, setInviteNotice] = useState<string | null>(null)
  const [inviteNoticeError, setInviteNoticeError] = useState<string | null>(null)

  const persistSession = (data: { token: string; role: AdminRole; email: string }) => {
    localStorage.setItem(ADMIN_TOKEN_KEY, data.token)
    localStorage.setItem(ADMIN_ROLE_KEY, data.role)
    localStorage.setItem(ADMIN_EMAIL_KEY, data.email)
    setToken(data.token)
    setRole(data.role)
    setEmail(data.email)
    setPassword('')
  }

  const canWrite = role === 'admin' || role === 'superadmin'
  const isSuper = role === 'superadmin'

  const logout = () => {
    localStorage.removeItem(ADMIN_TOKEN_KEY)
    localStorage.removeItem(ADMIN_ROLE_KEY)
    localStorage.removeItem(ADMIN_EMAIL_KEY)
    setToken(null)
    setRole(null)
    setEmail('')
  }

  const login = async (e: React.FormEvent) => {
    e.preventDefault()
    setSigningIn(true)
    setAuthError(null)
    const res = await adminFetch<{ token: string; role: AdminRole; email: string }>('/api/admin/login', null, {
      method: 'POST',
      body: JSON.stringify({ email: loginEmail, password }),
    })
    setSigningIn(false)
    if (res.error || !res.data) {
      setAuthError(res.error || 'Login failed')
      return
    }
    persistSession(res.data)
  }

  useEffect(() => {
    // warm session / health — intentionally ignore payload (no stack details in UI)
    adminFetch('/api/admin/health', null).catch(() => {})
  }, [])

  useEffect(() => {
    if (!inviteToken || token) return
    let cancelled = false
    adminFetch<{ email: string; role: string }>(
      `/api/admin/invites/preview?token=${encodeURIComponent(inviteToken)}`,
      null
    ).then((res) => {
      if (cancelled) return
      if (res.error || !res.data) {
        setInvitePreviewError(res.error || 'Invite is invalid or expired')
        return
      }
      setInvitePreview(res.data)
    })
    return () => {
      cancelled = true
    }
  }, [inviteToken, token])

  const acceptInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      setInvitePreviewError('Passwords do not match')
      return
    }
    setSettingPassword(true)
    setInvitePreviewError(null)
    const res = await adminFetch<{ token: string; role: AdminRole; email: string }>(
      '/api/admin/invites/accept',
      null,
      { method: 'POST', body: JSON.stringify({ token: inviteToken, password: newPassword }) }
    )
    setSettingPassword(false)
    if (res.error || !res.data) {
      setInvitePreviewError(res.error || 'Could not set password')
      return
    }
    persistSession(res.data)
    setSearchParams({})
  }

  // ─── Waitlist ───
  const [entries, setEntries] = useState<any[]>([])
  const [wlLoading, setWlLoading] = useState(false)
  const [wlError, setWlError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [waitlistSort, setWaitlistSort] = useState<WaitlistSortKey>('action')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [expandedWaitlistId, setExpandedWaitlistId] = useState<string | null>(null)
  const [overview, setOverview] = useState<AdminOverview | null>(null)
  const [overviewLoading, setOverviewLoading] = useState(false)
  const [overviewError, setOverviewError] = useState<string | null>(null)
  const [ledgerSearch, setLedgerSearch] = useState('')

  const fetchOverview = useCallback(async () => {
    if (!token) return
    setOverviewLoading(true)
    setOverviewError(null)
    const res = await adminFetch<AdminOverview>('/api/admin/overview', token)
    setOverviewLoading(false)
    if (res.status === 401) {
      logout()
      return
    }
    if (res.error || !res.data) {
      setOverviewError(res.error || 'Failed to load overview')
      return
    }
    setOverview(res.data)
  }, [token])

  useEffect(() => {
    if (!token) return
    fetchOverview()
    const t = window.setInterval(fetchOverview, 60000)
    return () => window.clearInterval(t)
  }, [token, fetchOverview])

  const fetchWaitlist = useCallback(async () => {
    if (!token) return
    setWlLoading(true)
    setWlError(null)
    const params = new URLSearchParams()
    if (statusFilter !== 'all') params.set('status', statusFilter)
    if (searchQuery.trim()) params.set('search', searchQuery.trim())
    const res = await adminFetch<any[]>(`/api/admin/waitlist?${params}`, token)
    setWlLoading(false)
    if (res.status === 401) {
      logout()
      return
    }
    if (res.error || !res.data) {
      setWlError(res.error || 'Failed to load')
      return
    }
    setEntries(res.data)
    setSelected(new Set())
  }, [token, statusFilter, searchQuery])

  useEffect(() => {
    const t = window.setTimeout(() => setSearchQuery(search), 280)
    return () => window.clearTimeout(t)
  }, [search])

  const sortedWaitlist = useMemo(() => {
    const list = [...entries]
    list.sort((a, b) => compareWaitlistRows(a, b, waitlistSort))
    return list
  }, [entries, waitlistSort])

  useEffect(() => {
    if (token && tab === 'waitlist') fetchWaitlist()
  }, [token, tab, fetchWaitlist])

  const setStatus = async (id: string, status: string) => {
    const res = await adminFetch(`/api/admin/waitlist/${id}/status`, token, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    })
    if (!res.error) setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, status } : e)))
  }

  const bulkStatus = async (status: string) => {
    const ids = Array.from(selected)
    if (!ids.length) return
    await adminFetch('/api/admin/waitlist/bulk-status', token, {
      method: 'POST',
      body: JSON.stringify({ ids, status }),
    })
    fetchWaitlist()
  }

  const [userInviteEmail, setUserInviteEmail] = useState('')
  const [userInviteName, setUserInviteName] = useState('')
  const [userInvitePassword, setUserInvitePassword] = useState('')
  const [userInvitePassword2, setUserInvitePassword2] = useState('')
  const [userInviteBusy, setUserInviteBusy] = useState(false)
  const [userInviteNotice, setUserInviteNotice] = useState<string | null>(null)
  const [userInviteError, setUserInviteError] = useState<string | null>(null)

  const resetUserInviteForm = () => {
    setUserInviteEmail('')
    setUserInviteName('')
    setUserInvitePassword('')
    setUserInvitePassword2('')
  }

  const inviteAppUser = async (e?: React.SyntheticEvent) => {
    e?.preventDefault()
    setUserInviteNotice(null)
    setUserInviteError(null)
    const email = normalizeEmail(userInviteEmail)
    if (!email) {
      setUserInviteError('Enter a valid email (use a period in the domain, e.g. gmail.com).')
      return
    }
    if (email !== userInviteEmail.trim().toLowerCase()) {
      setUserInviteEmail(email)
    }
    setUserInviteBusy(true)
    const res = await adminFetch<{ inviteEmail?: { sent?: boolean; error?: string; skipped?: string } }>(
      '/api/admin/users/invite',
      token,
      {
        method: 'POST',
        body: JSON.stringify({ email, fullName: userInviteName || undefined }),
      }
    )
    setUserInviteBusy(false)
    if (res.error || !res.data) {
      setUserInviteError(res.error || 'Invite failed')
      return
    }
    if (res.data.inviteEmail && !res.data.inviteEmail.sent) {
      setUserInviteError(
        `User added, but email was not sent: ${res.data.inviteEmail.error || res.data.inviteEmail.skipped || 'unknown error'}`
      )
    } else {
      setUserInviteNotice(`Invite sent to ${email}. They can sign up with that email and a password.`)
    }
    resetUserInviteForm()
    fetchWaitlist()
  }

  const createAppUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setUserInviteNotice(null)
    setUserInviteError(null)
    const email = normalizeEmail(userInviteEmail)
    if (!email) {
      setUserInviteError('Enter a valid email (use a period in the domain, e.g. gmail.com).')
      return
    }
    if (userInvitePassword.length < 8) {
      setUserInviteError('Password must be at least 8 characters.')
      return
    }
    if (userInvitePassword !== userInvitePassword2) {
      setUserInviteError('Passwords do not match.')
      return
    }
    setUserInviteBusy(true)
    const res = await adminFetch<{
      created?: boolean
      passwordUpdated?: boolean
      accountEmail?: { sent?: boolean; error?: string; skipped?: string }
    }>(
      '/api/admin/users/create',
      token,
      {
        method: 'POST',
        body: JSON.stringify({
          email,
          password: userInvitePassword,
          fullName: userInviteName || undefined,
        }),
      }
    )
    setUserInviteBusy(false)
    if (res.error || !res.data) {
      setUserInviteError(res.error || 'Could not create user')
      return
    }
    const created = res.data.created !== false
    const mail = res.data.accountEmail
    const base = created
      ? `Account created for ${email}. They can sign in with this email and password.`
      : `Account for ${email} already existed — password was updated and waitlist access is approved.`
    if (mail && !mail.sent) {
      setUserInviteError(`${base} Email was not sent: ${mail.error || mail.skipped || 'unknown error'}`)
    } else {
      setUserInviteNotice(base)
    }
    resetUserInviteForm()
    fetchWaitlist()
  }

  // ─── Offers ───
  const [offers, setOffers] = useState<any[]>([])
  const [offersLoading, setOffersLoading] = useState(false)
  const [offerError, setOfferError] = useState<string | null>(null)
  const [deletingOfferId, setDeletingOfferId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string } | null>(null)
  const [offerForm, setOfferForm] = useState({
    title: '',
    merchant: '',
    url: '',
    category: 'marketplace',
    description: '',
    imageUrl: '',
    rewardPaise: 2500,
    rewardLabel: '₹25 Goldback',
    active: true,
  })

  const fetchOffers = useCallback(async () => {
    if (!token) return
    setOffersLoading(true)
    const res = await adminFetch<any[]>('/api/admin/offers', token)
    setOffersLoading(false)
    if (res.data) setOffers(res.data)
  }, [token])

  useEffect(() => {
    if (token && (tab === 'club' && clubSub === 'offers')) fetchOffers()
  }, [token, tab, clubSub, fetchOffers])

  const saveOffer = async (e: React.FormEvent) => {
    e.preventDefault()
    setOfferError(null)
    const res = await adminFetch('/api/admin/offers', token, {
      method: 'POST',
      body: JSON.stringify(offerForm),
    })
    if (res.error) {
      setOfferError(res.error)
      return
    }
    setOfferForm({
      title: '',
      merchant: '',
      url: '',
      category: 'marketplace',
      description: '',
      imageUrl: '',
      rewardPaise: 2500,
      rewardLabel: '₹25 Goldback',
      active: true,
    })
    fetchOffers()
  }

  const removeOffer = async (id: string) => {
    if (!id || deletingOfferId) return
    setOfferError(null)
    setDeletingOfferId(id)
    const previous = offers
    setOffers((prev) => prev.filter((o) => o.id !== id))
    const res = await adminFetch<{ deleted?: boolean }>(
      `/api/admin/offers/${encodeURIComponent(id)}`,
      token,
      { method: 'DELETE' },
    )
    setDeletingOfferId(null)
    setPendingDelete(null)
    if (res.error) {
      setOffers(previous)
      setOfferError(res.error)
      return
    }
    fetchOffers()
  }

  // ─── Ledger ───
  const [ledger, setLedger] = useState<any[]>([])
  const [accounts, setAccounts] = useState<any[]>([])
  const [adjustTarget, setAdjustTarget] = useState<{
    userId: string
    label: string
    balancePaise: number
    pickUser?: boolean
  } | null>(null)
  const [adjustMode, setAdjustMode] = useState<'set' | 'delta'>('set')
  const [adjustRupees, setAdjustRupees] = useState('')
  const [adjustNote, setAdjustNote] = useState('')
  const [adjustBusy, setAdjustBusy] = useState(false)
  const [adjustError, setAdjustError] = useState<string | null>(null)
  const [adjustNotice, setAdjustNotice] = useState<string | null>(null)

  const fetchLedger = useCallback(async () => {
    if (!token) return
    const [l, a] = await Promise.all([
      adminFetch<any[]>('/api/admin/goldback/ledger', token),
      adminFetch<any[]>('/api/admin/goldback/accounts', token),
    ])
    if (l.data) setLedger(l.data)
    if (a.data) setAccounts(a.data)
  }, [token])

  useEffect(() => {
    if (token && tab === 'ledger') fetchLedger()
  }, [token, tab, fetchLedger])

  const sortedAccounts = useMemo(() => {
    const list = [...accounts]
    const s = ledgerSearch.trim().toLowerCase()
    const filtered = !s
      ? list
      : list.filter((a) => {
          const member = overview?.users.find((u) => {
            const k = String(a.userId || '').toLowerCase()
            return u.key === k || (u.email && u.email === k)
          })
          const hay = `${a.userId} ${member?.name || ''} ${member?.email || ''}`.toLowerCase()
          return hay.includes(s)
        })
    filtered.sort((a, b) => (Number(b.balancePaise) || 0) - (Number(a.balancePaise) || 0))
    return filtered
  }, [accounts, ledgerSearch, overview?.users])

  const sortedLedger = useMemo(() => {
    const list = [...ledger]
    list.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
    const s = ledgerSearch.trim().toLowerCase()
    if (!s) return list
    return list.filter((e) => {
      const title = String(e.meta?.title || e.meta?.note || e.type || '')
      return `${e.userId} ${title} ${e.type} ${e.status}`.toLowerCase().includes(s)
    })
  }, [ledger, ledgerSearch])

  const openGoldbackAdjust = (account: { userId: string; balancePaise: number }, label: string) => {
    setAdjustTarget({
      userId: account.userId,
      label,
      balancePaise: Number(account.balancePaise) || 0,
    })
    setAdjustMode('set')
    setAdjustRupees(String((Number(account.balancePaise) || 0) / 100))
    setAdjustNote('')
    setAdjustError(null)
  }

  const openGoldbackCredit = () => {
    setAdjustTarget({
      userId: '',
      label: 'Member',
      balancePaise: 0,
      pickUser: true,
    })
    setAdjustMode('delta')
    setAdjustRupees('')
    setAdjustNote('')
    setAdjustError(null)
  }

  const closeGoldbackAdjust = () => {
    if (adjustBusy) return
    setAdjustTarget(null)
    setAdjustError(null)
  }

  const submitGoldbackAdjust = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token || !adjustTarget || !canWrite) return
    const rawId = String(adjustTarget.userId || '').trim()
    const userId = rawId.includes('@') ? rawId.toLowerCase() : rawId
    if (!userId) {
      setAdjustError('Enter the member email or user id.')
      return
    }
    const paise = rupeesToPaise(adjustRupees)
    if (paise == null) {
      setAdjustError('Enter a valid amount in rupees (e.g. 25 or 12.50).')
      return
    }
    if (adjustMode === 'set' && paise < 0) {
      setAdjustError('Balance cannot be negative.')
      return
    }
    if (adjustMode === 'delta' && paise === 0) {
      setAdjustError('Delta must be non-zero.')
      return
    }

    setAdjustBusy(true)
    setAdjustError(null)
    setAdjustNotice(null)
    const label = adjustTarget.pickUser ? userId : adjustTarget.label
    const res = await adminFetch<{ balance?: { balancePaise: number }; entry?: { amountPaise: number } }>(
      '/api/admin/goldback/adjust',
      token,
      {
        method: 'POST',
        body: JSON.stringify({
          userId,
          ...(adjustMode === 'set' ? { balancePaise: paise } : { deltaPaise: paise }),
          note: adjustNote.trim() || undefined,
        }),
      },
    )
    setAdjustBusy(false)
    if (res.error || !res.data) {
      setAdjustError(res.error || 'Could not update Goldback')
      return
    }
    const next = res.data.balance?.balancePaise
    setAdjustNotice(
      next != null
        ? `Updated ${label} to ${formatPaise(next)}`
        : `Updated Goldback for ${label}`,
    )
    setAdjustTarget(null)
    fetchLedger()
  }

  // ─── Admins ───
  const [admins, setAdmins] = useState<any[]>([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<AdminRole>('admin')

  const fetchAdmins = useCallback(async () => {
    if (!token || !isSuper) return
    const res = await adminFetch<any[]>('/api/admin/team', token)
    if (res.data) setAdmins(res.data)
  }, [token, isSuper])

  useEffect(() => {
    if (token && tab === 'admins') fetchAdmins()
  }, [token, tab, fetchAdmins])

  const addAdmin = async (e: React.FormEvent) => {
    e.preventDefault()
    setInviteNotice(null)
    setInviteNoticeError(null)
    const email = normalizeEmail(inviteEmail)
    if (!email) {
      setInviteNoticeError('Enter a valid email (use a period in the domain, e.g. gmail.com).')
      return
    }
    const res = await adminFetch<{ inviteEmail?: { sent?: boolean; error?: string; skipped?: string } }>(
      '/api/admin/team',
      token,
      {
        method: 'POST',
        body: JSON.stringify({ email, role: inviteRole }),
      }
    )
    if (res.error || !res.data) {
      setInviteNoticeError(res.error || 'Invite failed')
      return
    }
    if (res.data.inviteEmail && !res.data.inviteEmail.sent) {
      setInviteNoticeError(
        `Admin added, but email was not sent: ${res.data.inviteEmail.error || res.data.inviteEmail.skipped || 'unknown error'}`
      )
    } else {
      setInviteNotice(`Invite sent to ${email}. They must set a password from the email link.`)
    }
    setInviteEmail('')
    fetchAdmins()
  }

  const pendingCount = overview?.kpis.pending ?? entries.filter((e) => e.status === 'pending').length
  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      pending: 'bg-amber-500/15 text-amber-300 border-amber-500/25',
      accepted: 'bg-clay/15 text-clay border-clay/30',
      on_hold: 'bg-white/10 text-white/50 border-white/15',
      rejected: 'bg-red-500/15 text-red-300 border-red-500/25',
    }
    return map[status] || 'bg-white/10 text-white/40 border-white/10'
  }

  if (!token) {
    const showSetPassword = Boolean(inviteToken)
    return (
      <div className="min-h-dvh bg-[#070707] text-white flex items-center justify-center p-6">
        {showSetPassword ? (
          <form onSubmit={acceptInvite} className={`relative w-full max-w-[400px] ${surfaceClass} p-8 space-y-5`}>
            <div className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-clay text-black">
              <KeyRound size={20} />
            </div>
            <div>
              <h1 className="text-[28px] font-semibold tracking-[-0.022em] leading-tight">Set your password</h1>
              <p className="text-[15px] text-white/45 mt-2 leading-relaxed">
                {invitePreview
                  ? `Create a password for ${invitePreview.email} (${invitePreview.role}).`
                  : 'Create a password to open admin.'}
              </p>
            </div>
            <label className="block">
              <FieldLabel>New password</FieldLabel>
              <input
                type="password"
                className={fieldClass}
                placeholder="At least 8 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
              />
            </label>
            <label className="block">
              <FieldLabel>Confirm password</FieldLabel>
              <input
                type="password"
                className={fieldClass}
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
              />
            </label>
            {invitePreviewError && <Callout tone="error">{invitePreviewError}</Callout>}
            <button
              type="submit"
              disabled={settingPassword || !invitePreview}
              className={`${primaryBtnClass} w-full`}
            >
              {settingPassword ? <Loader2 className="animate-spin" size={16} /> : <KeyRound size={16} />}
              Save password
            </button>
          </form>
        ) : (
        <form onSubmit={login} className={`relative w-full max-w-[400px] ${surfaceClass} p-8 space-y-5`}>
          <div className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-clay text-black">
            <ShieldCheck size={20} />
          </div>
          <div>
            <h1 className="text-[28px] font-semibold tracking-[-0.022em] leading-tight">Admin</h1>
            <p className="text-[15px] text-white/45 mt-2 leading-relaxed">
              Waitlist, offers, and Goldback in one place.
            </p>
          </div>
          <label className="block">
            <FieldLabel>Email</FieldLabel>
            <input
              className={fieldClass}
              placeholder="Email"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              autoComplete="username"
            />
          </label>
          <label className="block">
            <FieldLabel>Password</FieldLabel>
            <input
              type="password"
              className={fieldClass}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>
          {authError && <Callout tone="error">{authError}</Callout>}
          <button type="submit" disabled={signingIn} className={`${primaryBtnClass} w-full`}>
            {signingIn ? <Loader2 className="animate-spin" size={16} /> : <LogIn size={16} />}
            Sign in
          </button>
          <p className="text-[13px] text-white/30 text-center">
            Invited? Open the link in your email to set a password.
          </p>
        </form>
        )}
      </div>
    )
  }

  const tabs: { id: Tab; label: string; icon: any; hide?: boolean; hint?: string }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'waitlist', label: 'Waitlist', icon: Users, hint: pendingCount ? `${pendingCount} pending` : undefined },
    { id: 'users', label: 'Users', icon: Activity, hint: overview ? String(overview.users.length) : undefined },
    { id: 'deletions', label: 'Deletions', icon: Trash2 },
    { id: 'gifts', label: 'Gift cards', icon: Gift },
    { id: 'club', label: 'Club', icon: Layers },
    { id: 'blogs', label: 'Blog', icon: BookOpen },
    { id: 'ledger', label: 'Goldback', icon: Coins },
    { id: 'admins', label: 'Admins', icon: ShieldCheck, hide: !isSuper },
  ]
  const navGroups: { label: string; ids: Tab[] }[] = [
    { label: 'Monitor', ids: ['overview'] },
    { label: 'People', ids: ['waitlist', 'users', 'deletions'] },
    { label: 'Commerce', ids: ['gifts', 'club', 'ledger'] },
    { label: 'Site', ids: ['blogs'] },
    { label: 'Access', ids: ['admins'] },
  ]
  const visibleTabs = tabs.filter((t) => !t.hide)
  const renderNavButton = (t: (typeof tabs)[number], compact = false) => (
    <button
      key={t.id}
      type="button"
      onClick={() => {
        setTab(t.id)
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev)
          next.set('tab', t.id)
          return next
        }, { replace: true })
      }}
      className={`${pressClass} ${
        compact
          ? `shrink-0 rounded-[12px] px-3.5 py-2 text-[14px] font-medium ${
              tab === t.id ? 'bg-white text-black' : 'bg-white/[0.06] text-white/55'
            }`
          : `w-full flex items-center gap-3 rounded-[12px] px-3 py-2.5 text-left ${
              tab === t.id ? 'bg-white text-black' : 'text-white/50 hover:bg-white/[0.05] hover:text-white'
            }`
      }`}
    >
      {!compact && <t.icon size={16} />}
      <span className={compact ? '' : 'text-[15px] font-medium flex-1'}>{t.label}</span>
      {!compact && t.hint && tab !== t.id && (
        <span className="text-[12px] font-medium text-amber-200/80">{t.hint}</span>
      )}
    </button>
  )

  return (
    <div className="min-h-dvh bg-[#070707] text-white flex">
      <aside className="hidden md:flex w-[232px] shrink-0 flex-col border-r border-white/[0.06] bg-black/45 backdrop-blur-2xl backdrop-saturate-150 p-4">
        <div className="flex items-center gap-3 px-2 mb-8">
          <div className="h-9 w-9 rounded-[12px] bg-clay flex items-center justify-center text-black">
            <ShieldCheck size={16} />
          </div>
          <div>
            <p className="text-[17px] font-semibold tracking-[-0.02em] leading-none">Yureka</p>
            <p className="text-[12px] text-white/40 mt-1">Admin</p>
          </div>
        </div>
        <nav className="flex-1 space-y-5">
          {navGroups.map((group) => {
            const items = visibleTabs.filter((t) => group.ids.includes(t.id))
            if (!items.length) return null
            return (
              <div key={group.label}>
                <p className="px-3 mb-1.5 text-[12px] font-medium text-white/35">{group.label}</p>
                <div className="space-y-0.5">{items.map((t) => renderNavButton(t))}</div>
              </div>
            )
          })}
        </nav>
        <div className="mt-auto pt-4 border-t border-white/[0.06] space-y-2">
          <div className="px-3">
            <p className="text-[13px] font-medium truncate">{email}</p>
            <p className="text-[12px] text-white/35 mt-0.5 capitalize">{role}</p>
          </div>
          <button type="button" onClick={logout} className={`${ghostBtnClass} w-full justify-start text-white/40 hover:text-red-300`}>
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="md:hidden sticky top-0 z-20 border-b border-white/[0.06] bg-black/50 backdrop-blur-xl px-4 py-3 flex items-center justify-between gap-3">
          <p className="text-[17px] font-semibold tracking-[-0.02em]">Admin</p>
          <button type="button" onClick={logout} className={`${pressClass} text-white/40 p-2`} aria-label="Sign out">
            <LogOut size={16} />
          </button>
        </header>
        <nav className="md:hidden flex gap-2 overflow-x-auto px-4 py-3 border-b border-white/[0.06]">
          {visibleTabs.map((t) => renderNavButton(t, true))}
        </nav>

        <main className="flex-1 p-5 md:p-8 max-w-6xl w-full mx-auto">
        {tab === 'overview' && (
          <OverviewTab data={overview} loading={overviewLoading} error={overviewError} onRefresh={fetchOverview} />
        )}
        {tab === 'users' && (
          <UsersTab
            data={overview}
            loading={overviewLoading}
            token={token}
            canWrite={canWrite}
            onRefresh={fetchOverview}
          />
        )}
        {tab === 'deletions' && <DeletionsTab token={token} canWrite={canWrite} />}
        {tab === 'gifts' && <GiftOrdersTab data={overview} loading={overviewLoading} />}
        {tab === 'waitlist' && (
          <section className="space-y-6">
            <PageHeader
              title="Waitlist"
              subtitle="Approve members, invite by email, or create an account with a password."
            />
            {canWrite && (
              <form
                noValidate
                onSubmit={createAppUser}
                className={`${surfaceClass} flex flex-col gap-2 p-4`}
              >
                <div className="flex flex-wrap gap-2">
                <input
                  className="rounded-xl bg-black/40 border border-white/10 px-3 py-2.5 text-sm flex-1 min-w-[160px] focus:outline-none focus:border-clay/35"
                  placeholder="User email…"
                  type="text"
                  inputMode="email"
                  autoComplete="off"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  required
                  value={userInviteEmail}
                  onChange={(e) => {
                    setUserInviteEmail(e.target.value)
                    if (userInviteError) setUserInviteError(null)
                  }}
                  onBlur={() => {
                    const next = normalizeEmail(userInviteEmail)
                    if (next) setUserInviteEmail(next)
                  }}
                />
                <input
                  className="rounded-xl bg-black/40 border border-white/10 px-3 py-2.5 text-sm flex-1 min-w-[140px] focus:outline-none focus:border-clay/35"
                  placeholder="Name (optional)"
                  autoComplete="off"
                  value={userInviteName}
                  onChange={(e) => setUserInviteName(e.target.value)}
                />
                </div>
                <div className="flex flex-wrap gap-2">
                <input
                  className="rounded-xl bg-black/40 border border-white/10 px-3 py-2.5 text-sm flex-1 min-w-[140px] focus:outline-none focus:border-clay/35"
                  placeholder="Password (min 8 chars)"
                  type="password"
                  autoComplete="new-password"
                  value={userInvitePassword}
                  onChange={(e) => setUserInvitePassword(e.target.value)}
                />
                <input
                  className="rounded-xl bg-black/40 border border-white/10 px-3 py-2.5 text-sm flex-1 min-w-[140px] focus:outline-none focus:border-clay/35"
                  placeholder="Confirm password"
                  type="password"
                  autoComplete="new-password"
                  value={userInvitePassword2}
                  onChange={(e) => setUserInvitePassword2(e.target.value)}
                />
                </div>
                <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={userInviteBusy}
                  className={primaryBtnClass}
                >
                  {userInviteBusy ? 'Saving…' : 'Create account'}
                </button>
                <button
                  type="button"
                  disabled={userInviteBusy}
                  onClick={inviteAppUser}
                  className={secondaryBtnClass}
                >
                  Invite only
                </button>
                </div>
                <p className="text-[11px] text-white/35 leading-relaxed">
                  Create account signs them in immediately with this password. If the email already exists, the password is reset. Invite only emails them to pick their own password.
                </p>
              </form>
            )}
            {userInviteNotice && <Callout tone="ok">{userInviteNotice}</Callout>}
            {userInviteError && <Callout tone="error">{userInviteError}</Callout>}
            <div className="flex flex-wrap gap-2 items-center">
              {STATUS_TABS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setStatusFilter(s.id)}
                  className={`${pressClass} rounded-[12px] px-3.5 py-2 text-[14px] font-medium ${
                    statusFilter === s.id ? 'bg-white text-black' : 'bg-white/[0.06] text-white/50 hover:text-white'
                  }`}
                >
                  {s.label}
                </button>
              ))}
              <div className="flex-1 min-w-[8px] hidden sm:block" />
              <div className="relative w-full sm:w-auto flex-1 sm:flex-none min-w-0 sm:min-w-[11rem]">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                <input
                  className="rounded-xl bg-black/40 border border-white/10 pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:border-clay/35 w-full sm:w-44"
                  placeholder="Search…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <button
                type="button"
                onClick={fetchWaitlist}
                className={`${pressClass} rounded-xl border border-white/10 bg-white/[0.03] p-2.5 text-white/45 hover:text-white shrink-0`}
                aria-label="Refresh waitlist"
              >
                <RefreshCw size={14} />
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 items-center">
              <span className="text-[11px] text-white/30 mr-1 flex items-center gap-1">
                <ArrowDownAZ size={12} /> Sort
              </span>
              {(
                [
                  { id: 'action' as const, label: 'Needs action' },
                  { id: 'newest' as const, label: 'Newest' },
                  { id: 'score' as const, label: 'Score' },
                  { id: 'name' as const, label: 'Name' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setWaitlistSort(opt.id)}
                  className={`${pressClass} rounded-[10px] px-2.5 py-1.5 text-[12px] font-medium ${
                    waitlistSort === opt.id ? 'bg-white text-black' : 'bg-white/[0.06] text-white/50 hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
              <span className="text-[12px] text-white/35 tabular-nums ml-auto">
                {sortedWaitlist.length} entr{sortedWaitlist.length === 1 ? 'y' : 'ies'}
              </span>
            </div>

            {canWrite && selected.size > 0 && (
              <div className="sticky top-2 z-10 flex flex-wrap gap-2 rounded-2xl border border-clay/25 bg-black/80 backdrop-blur-xl px-4 py-3 shadow-xl">
                <span className="text-xs text-white/50 self-center mr-1">{selected.size} selected</span>
                <button type="button" onClick={() => bulkStatus('accepted')} className={`${pressClass} rounded-xl bg-clay text-black px-3 py-2 text-xs font-black`}>Accept</button>
                <button type="button" onClick={() => bulkStatus('on_hold')} className={`${pressClass} rounded-xl bg-white/10 px-3 py-2 text-xs font-bold`}>Hold</button>
                <button type="button" onClick={() => bulkStatus('rejected')} className={`${pressClass} rounded-xl bg-red-500/20 text-red-300 px-3 py-2 text-xs font-bold`}>Reject</button>
              </div>
            )}

            {wlLoading ? (
              <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-clay" /></div>
            ) : wlError ? (
              <Callout tone="error">{wlError}</Callout>
            ) : (
              <div className="space-y-2.5">
                {sortedWaitlist.map((e) => {
                  const open = expandedWaitlistId === e.id
                  return (
                  <div
                    key={e.id}
                    className={`rounded-2xl border border-white/[0.07] bg-white/[0.02] transition ${open ? 'bg-white/[0.035]' : 'hover:bg-white/[0.035]'}`}
                  >
                    <div
                      className="p-4 flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 sm:gap-4 cursor-pointer"
                      onClick={() => setExpandedWaitlistId(open ? null : e.id)}
                    >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                    {canWrite && (
                      <input
                        type="checkbox"
                        className="accent-emerald-400 h-4 w-4 shrink-0"
                        checked={selected.has(e.id)}
                        onClick={(ev) => ev.stopPropagation()}
                        onChange={() =>
                          setSelected((prev) => {
                            const n = new Set(prev)
                            if (n.has(e.id)) n.delete(e.id)
                            else n.add(e.id)
                            return n
                          })
                        }
                      />
                    )}
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/5 text-sm font-black text-clay">
                      {(e.fullName || e.email || '?')[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold truncate">{e.fullName || '—'}</p>
                      <p className="text-white/40 text-xs mt-0.5 truncate">{e.email}</p>
                      {e.createdAt ? (
                        <p className="text-white/25 text-[10px] mt-0.5 tabular-nums">
                          Joined {new Date(e.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      ) : null}
                    </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 pl-0 sm:pl-0">
                    <span className={`text-[9px] uppercase tracking-[0.2em] font-black border px-2.5 py-1 rounded-lg ${statusBadge(e.status)}`}>
                      {e.status.replace('_', ' ')}
                    </span>
                    <div className="min-w-[9rem]">
                    <ScoreBadge score={e.yurekaScore} decision={e.scoreDecision} />
                    <ScoreSignals metrics={e.scoreMetrics} />
                    </div>
                    {canWrite && (
                      <div className="flex gap-1.5 w-full sm:w-auto sm:ml-auto" onClick={(ev) => ev.stopPropagation()}>
                        <button type="button" onClick={() => setStatus(e.id, 'accepted')} className="flex-1 sm:flex-none text-[10px] px-2.5 py-1.5 rounded-lg bg-clay/15 text-clay font-bold hover:bg-clay/25 active:scale-[0.97]">Accept</button>
                        <button type="button" onClick={() => setStatus(e.id, 'on_hold')} className="flex-1 sm:flex-none text-[10px] px-2.5 py-1.5 rounded-lg bg-white/8 font-bold hover:bg-white/12 active:scale-[0.97]">Hold</button>
                        <button type="button" onClick={() => setStatus(e.id, 'rejected')} className="flex-1 sm:flex-none text-[10px] px-2.5 py-1.5 rounded-lg bg-red-500/15 text-red-300 font-bold hover:bg-red-500/25 active:scale-[0.97]">Reject</button>
                      </div>
                    )}
                    </div>
                    </div>
                    {open ? (
                      <div className="px-4 pb-4 border-t border-white/[0.06]">
                        <UserScoreAnalysis metrics={e.scoreMetrics} />
                      </div>
                    ) : null}
                  </div>
                  )
                })}
                {!sortedWaitlist.length && (
                  <EmptyState>
                    {search.trim() ? 'No waitlist entries match that search' : 'No waitlist entries for this filter'}
                  </EmptyState>
                )}
              </div>
            )}
          </section>
        )}

        {tab === 'blogs' && <BlogsTab token={token} canWrite={canWrite} />}

        {tab === 'club' && (
          <ClubHub
            sub={clubSub}
            onSubChange={setClubSub}
            token={token}
            canWrite={canWrite}
            offersPanel={
              <div className="space-y-6">
                {canWrite && (
                  <form onSubmit={saveOffer} className={`${surfaceClass} p-5 grid md:grid-cols-2 gap-3`}>
                    <h3 className="md:col-span-2 text-[15px] font-semibold tracking-[-0.015em] text-white flex items-center gap-2">
                      <Plus size={16} /> New offer
                    </h3>
                    <input className={fieldClass} placeholder="Title" value={offerForm.title} onChange={(e) => setOfferForm({ ...offerForm, title: e.target.value })} required />
                    <input className={fieldClass} placeholder="Merchant" value={offerForm.merchant} onChange={(e) => setOfferForm({ ...offerForm, merchant: e.target.value })} required />
                    <input className={`${fieldClass} md:col-span-2`} placeholder="URL" value={offerForm.url} onChange={(e) => setOfferForm({ ...offerForm, url: e.target.value })} required />
                    <ImageUrlField
                      className="md:col-span-2"
                      label="Offer image"
                      value={offerForm.imageUrl}
                      onChange={(imageUrl) => setOfferForm({ ...offerForm, imageUrl })}
                      token={token}
                      canWrite={canWrite}
                      placeholder="or paste an image URL"
                      previewClassName="h-28 w-full max-w-xs object-cover rounded-[14px] border border-white/10"
                    />
                    <input className={fieldClass} placeholder="Category" value={offerForm.category} onChange={(e) => setOfferForm({ ...offerForm, category: e.target.value })} />
                    <input className={fieldClass} placeholder="Reward label" value={offerForm.rewardLabel} onChange={(e) => setOfferForm({ ...offerForm, rewardLabel: e.target.value })} />
                    <input type="number" className={fieldClass} placeholder="Reward paise" value={offerForm.rewardPaise} onChange={(e) => setOfferForm({ ...offerForm, rewardPaise: Number(e.target.value) })} />
                    <textarea className={`${fieldClass} md:col-span-2`} placeholder="Description" rows={2} value={offerForm.description} onChange={(e) => setOfferForm({ ...offerForm, description: e.target.value })} />
                    <button type="submit" className={`${primaryBtnClass} md:col-span-2`}>Publish offer</button>
                  </form>
                )}

                {offerError && <Callout tone="error">{offerError}</Callout>}
                {offersLoading ? (
                  <div className="py-16 flex justify-center"><Loader2 className="animate-spin text-clay" /></div>
                ) : (
                  <div className="grid md:grid-cols-2 gap-3">
                    {offers.map((o) => (
                      <Surface key={o.id} className="p-5">
                        <div className="flex justify-between gap-3">
                          <div>
                            <p className="text-[17px] font-semibold tracking-[-0.015em]">{o.title}</p>
                            <p className="text-white/40 text-[13px] mt-1">{o.merchant} · {o.category}</p>
                          </div>
                          <span className="text-clay text-[13px] font-semibold shrink-0 bg-clay/10 rounded-full px-2.5 py-1 h-fit">
                            {o.rewardLabel || formatPaise(o.rewardPaise)}
                          </span>
                        </div>
                        <p className="text-white/45 text-[15px] mt-3 line-clamp-2 leading-relaxed">{o.description}</p>
                        <div className="mt-4 flex items-center justify-between">
                          <span className={`text-[12px] font-medium capitalize rounded-full px-2.5 py-1 ${o.active ? 'text-clay bg-clay/10' : 'text-white/35 bg-white/5'}`}>
                            {o.active ? 'Live' : 'Off'}
                          </span>
                          {canWrite && (
                            <button
                              type="button"
                              onClick={() => setPendingDelete({ id: o.id, title: o.title })}
                              disabled={deletingOfferId === o.id}
                              className={`${pressClass} text-red-300/60 hover:text-red-300 p-2 rounded-[10px] hover:bg-red-500/10 disabled:opacity-40`}
                              aria-label={`Delete ${o.title}`}
                            >
                              {deletingOfferId === o.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                            </button>
                          )}
                        </div>
                      </Surface>
                    ))}
                    {!offers.length && <EmptyState>No offers yet</EmptyState>}
                  </div>
                )}
                <ConfirmDialog
                  open={Boolean(pendingDelete)}
                  title="Delete this offer?"
                  body={pendingDelete ? `${pendingDelete.title} will be removed from the catalog. Members will no longer earn Goldback from it.` : ''}
                  confirmLabel="Delete offer"
                  busy={Boolean(pendingDelete && deletingOfferId === pendingDelete.id)}
                  onCancel={() => setPendingDelete(null)}
                  onConfirm={() => pendingDelete && removeOffer(pendingDelete.id)}
                />
              </div>
            }
          />
        )}

        {tab === 'ledger' && (
          <section className="space-y-8">
            <PageHeader
              title="Goldback"
              subtitle="Balances and earn ledger across members. Admins can edit any balance."
              actions={
                <div className="flex items-center gap-2">
                  {canWrite && (
                    <button type="button" onClick={openGoldbackCredit} className={secondaryBtnClass}>
                      <Plus size={16} />
                      Credit member
                    </button>
                  )}
                  <button type="button" onClick={fetchLedger} className={ghostBtnClass} aria-label="Refresh Goldback">
                    <RefreshCw size={14} />
                    Refresh
                  </button>
                </div>
              }
            />
            {adjustNotice && <Callout tone="ok">{adjustNotice}</Callout>}
            <div className="relative max-w-md">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                className={`${fieldClass} pl-9`}
                placeholder="Search accounts or ledger…"
                value={ledgerSearch}
                onChange={(e) => setLedgerSearch(e.target.value)}
              />
            </div>
            <div>
              <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-white/35 mb-3">
                Accounts · highest balance first
              </h3>
              <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
                {sortedAccounts.map((a) => {
                  const member = overview?.users.find((u) => {
                    const k = String(a.userId || '').toLowerCase()
                    return u.key === k || (u.email && u.email === k)
                  })
                  const label = member?.name || member?.email || a.userId
                  return (
                  <div key={a.userId} className="rounded-2xl border border-white/[0.07] bg-gradient-to-br from-clay/10 to-transparent p-5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold truncate text-white">{label}</p>
                        {member?.email && member.email !== label ? (
                          <p className="text-[10px] text-white/35 truncate mt-0.5">{member.email}</p>
                        ) : (
                          <p className="text-[10px] text-white/30 truncate mt-0.5 uppercase tracking-wider">{a.userId}</p>
                        )}
                      </div>
                      {canWrite && (
                        <button
                          type="button"
                          onClick={() => openGoldbackAdjust(a, String(label))}
                          className={`${ghostBtnClass} !px-2 !py-1.5 shrink-0 text-clay hover:text-clay`}
                          aria-label={`Edit Goldback for ${label}`}
                        >
                          <Pencil size={14} />
                          Edit
                        </button>
                      )}
                    </div>
                    <p className="text-3xl font-black text-white mt-2 tabular-nums tracking-tight">{formatPaise(a.balancePaise)}</p>
                    <div className="mt-3">
                      <ScoreBadge score={member?.score ?? null} decision={member?.scoreDecision} />
                    </div>
                  </div>
                  )
                })}
                {!sortedAccounts.length && (
                  <div className="col-span-full">
                    <EmptyState>
                      {ledgerSearch.trim() ? 'No accounts match that search' : 'No balances yet — members earn from offers'}
                    </EmptyState>
                  </div>
                )}
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-white/35">Ledger · newest first</h3>
                <button type="button" onClick={fetchLedger} className="text-white/30 hover:text-white p-1" aria-label="Refresh ledger">
                  <RefreshCw size={14} />
                </button>
              </div>
              <div className="space-y-2">
                {sortedLedger.map((e) => {
                  const amount = Number(e.amountPaise) || 0
                  const title = String(e.meta?.title || e.meta?.note || e.type)
                  return (
                  <div key={e.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3.5 flex justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <p className="font-bold truncate">{title}</p>
                      <p className="text-[10px] text-white/30 uppercase tracking-widest mt-1 truncate">{e.userId} · {e.type} · {e.status}</p>
                    </div>
                    <span className={`font-black tabular-nums shrink-0 ${amount < 0 ? 'text-red-300' : 'text-clay'}`}>
                      {formatSignedPaise(amount)}
                    </span>
                  </div>
                  )
                })}
                {!sortedLedger.length && (
                  <EmptyState>
                    {ledgerSearch.trim() ? 'No ledger rows match that search' : 'No ledger entries yet'}
                  </EmptyState>
                )}
              </div>
            </div>

            {adjustTarget && (
              <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
                <button
                  type="button"
                  className="absolute inset-0 bg-black/55 backdrop-blur-sm"
                  aria-label="Cancel"
                  onClick={closeGoldbackAdjust}
                />
                <form
                  onSubmit={submitGoldbackAdjust}
                  className={`${surfaceClass} relative w-full max-w-md p-5 space-y-4 shadow-[0_24px_80px_rgba(0,0,0,0.55)]`}
                >
                  <div>
                    <h2 className="text-[20px] font-semibold tracking-[-0.02em] leading-tight">Edit Goldback</h2>
                    <p className="text-[15px] text-white/50 mt-2 leading-relaxed">
                      {adjustTarget.pickUser
                        ? 'Credit or set balance for any member by email / user id.'
                        : `${adjustTarget.label} · current ${formatPaise(adjustTarget.balancePaise)}`}
                    </p>
                  </div>

                  {adjustTarget.pickUser && (
                    <label className="block">
                      <FieldLabel>Member email / user id</FieldLabel>
                      <input
                        className={fieldClass}
                        type="text"
                        inputMode="email"
                        autoComplete="off"
                        autoCapitalize="none"
                        spellCheck={false}
                        list="goldback-member-options"
                        value={adjustTarget.userId}
                        onChange={(e) =>
                          setAdjustTarget((prev) =>
                            prev ? { ...prev, userId: e.target.value, label: e.target.value.trim() || 'Member' } : prev,
                          )
                        }
                        placeholder="member@email.com"
                        autoFocus
                      />
                      <datalist id="goldback-member-options">
                        {(overview?.users || []).slice(0, 200).map((u) => (
                          <option key={u.key || u.email} value={u.email || u.key}>
                            {u.name || u.email || u.key}
                          </option>
                        ))}
                      </datalist>
                    </label>
                  )}

                  <div className="flex gap-2 rounded-xl bg-black/30 p-1 border border-white/10">
                    {([
                      { id: 'set' as const, label: 'Set balance' },
                      { id: 'delta' as const, label: 'Add / subtract' },
                    ]).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setAdjustMode(opt.id)
                          setAdjustRupees(
                            opt.id === 'set' && !adjustTarget.pickUser
                              ? String(adjustTarget.balancePaise / 100)
                              : '',
                          )
                          setAdjustError(null)
                        }}
                        className={`flex-1 rounded-[10px] px-3 py-2 text-[13px] font-semibold ${
                          adjustMode === opt.id
                            ? 'bg-clay text-black'
                            : 'text-white/50 hover:text-white'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  <label className="block">
                    <FieldLabel>
                      {adjustMode === 'set' ? 'New balance (₹)' : 'Delta (₹, use − to debit)'}
                    </FieldLabel>
                    <input
                      className={fieldClass}
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      value={adjustRupees}
                      onChange={(e) => setAdjustRupees(e.target.value)}
                      placeholder={adjustMode === 'set' ? '25.00' : '10 or -5'}
                      autoFocus={!adjustTarget.pickUser}
                    />
                  </label>

                  <label className="block">
                    <FieldLabel>Note (optional)</FieldLabel>
                    <input
                      className={fieldClass}
                      type="text"
                      value={adjustNote}
                      onChange={(e) => setAdjustNote(e.target.value)}
                      placeholder="Reason for this adjustment"
                      maxLength={200}
                    />
                  </label>

                  {adjustError && <Callout tone="error">{adjustError}</Callout>}

                  <div className="flex gap-2">
                    <button type="button" className={`${secondaryBtnClass} flex-1`} onClick={closeGoldbackAdjust} disabled={adjustBusy}>
                      Cancel
                    </button>
                    <button type="submit" className={`${primaryBtnClass} flex-1`} disabled={adjustBusy}>
                      {adjustBusy ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          Saving…
                        </>
                      ) : (
                        'Save'
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </section>
        )}

        {tab === 'admins' && isSuper && (
          <section className="space-y-6">
            <PageHeader title="Admins" subtitle="Who can open this console." />
            <form noValidate onSubmit={addAdmin} className="flex flex-wrap gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
              <input
                className="rounded-xl bg-black/40 border border-white/10 px-3 py-2.5 text-sm flex-1 min-w-[200px] focus:outline-none focus:border-clay/35"
                placeholder="email@…"
                type="text"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onBlur={() => {
                  const next = normalizeEmail(inviteEmail)
                  if (next) setInviteEmail(next)
                }}
              />
              <select className="rounded-xl bg-black/40 border border-white/10 px-3 py-2.5 text-sm" value={inviteRole} onChange={(e) => setInviteRole(e.target.value as AdminRole)}>
                <option value="viewer">viewer</option>
                <option value="admin">admin</option>
                <option value="superadmin">superadmin</option>
              </select>
              <button type="submit" className={primaryBtnClass}>Invite</button>
            </form>
            {inviteNotice && <Callout tone="ok">{inviteNotice}</Callout>}
            {inviteNoticeError && <Callout tone="error">{inviteNoticeError}</Callout>}
            <div className="space-y-2">
              {[...admins]
                .sort((a, b) => {
                  const rank: Record<string, number> = { superadmin: 0, admin: 1, viewer: 2 }
                  const ra = rank[a.role] ?? 9
                  const rb = rank[b.role] ?? 9
                  if (ra !== rb) return ra - rb
                  return String(a.email).localeCompare(String(b.email))
                })
                .map((a) => (
                <div key={a.id} className="rounded-2xl border border-white/[0.07] px-4 py-4 flex justify-between items-center gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-xl bg-clay/15 text-clay flex items-center justify-center text-xs font-black shrink-0">
                      {a.email[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold truncate">{a.email}</p>
                      <p className="text-white/30 text-xs">
                        {a.fullName || '—'}
                        {a.invitePending ? ' · waiting to set password' : a.hasPassword ? ' · password set' : ''}
                      </p>
                    </div>
                  </div>
                  <span className="text-[9px] uppercase tracking-[0.2em] font-black text-clay border border-clay/30 bg-clay/10 px-2.5 py-1 rounded-lg shrink-0">{a.role}</span>
                </div>
              ))}
              {!admins.length && <EmptyState>No admins yet — invite someone above</EmptyState>}
            </div>
          </section>
        )}
        </main>
      </div>
    </div>
  )
}

export default AdminDashboard

import React, { useCallback, useEffect, useState } from 'react'
import { Loader2, Send, RefreshCw } from 'lucide-react'
import {
  Callout,
  EmptyState,
  FieldLabel,
  PageHeader,
  fieldClass,
  pressClass,
  primaryBtnClass,
} from './ui'

interface Envelope<T> {
  data: T | null
  status: number
  error?: string
}

type NotifRow = {
  id: string
  userId: string
  email: string | null
  title: string
  body: string
  type: string
  createdAt: string
}

async function adminFetch<T>(path: string, token: string | null, init?: RequestInit): Promise<Envelope<T>> {
  try {
    const headers: Record<string, string> = {
      ...(token ? { 'X-Admin-Session': token } : {}),
    }
    if (init?.body) headers['Content-Type'] = 'application/json'
    const res = await fetch(path, { ...init, headers: { ...headers, ...(init?.headers || {}) } })
    const json = (await res.json()) as Envelope<T>
    if (!res.ok && !json.error) return { data: null, status: res.status, error: `Request failed (${res.status})` }
    return json
  } catch {
    return { data: null, status: 503, error: 'Admin API unreachable' }
  }
}

function timeAgo(iso: string) {
  const ms = Date.now() - new Date(iso).getTime()
  if (!Number.isFinite(ms) || ms < 0) return 'just now'
  const m = Math.floor(ms / 60000)
  if (m < 60) return `${Math.max(1, m)}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function PushTab({ token, canWrite }: { token: string | null; canWrite: boolean }) {
  const [rows, setRows] = useState<NotifRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [form, setForm] = useState({
    title: '',
    body: '',
    mode: 'one' as 'one' | 'broadcast',
    audience: 'accepted',
    email: '',
    href: '/dashboard',
    confirmBroadcast: false,
  })

  const load = useCallback(async () => {
    setLoading(true)
    const res = await adminFetch<NotifRow[]>('/api/admin/notifications?limit=80', token)
    if (!res.data) {
      setError(res.error || 'Failed to load')
      setLoading(false)
      return
    }
    setRows(res.data)
    setError(null)
    setLoading(false)
  }, [token])

  useEffect(() => {
    void load()
  }, [load])

  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canWrite) return
    setSending(true)
    setError(null)
    setNotice(null)

    if (form.mode === 'one' && !form.email.trim().includes('@')) {
      setSending(false)
      setError('Enter a member email for one-user notifications')
      return
    }
    if (form.mode === 'broadcast' && !form.confirmBroadcast) {
      setSending(false)
      setError('Confirm broadcast before sending to everyone in the audience')
      return
    }

    const payload: Record<string, unknown> = {
      title: form.title,
      body: form.body,
      href: form.href || '/dashboard',
      type: 'info',
      mode: form.mode,
    }
    if (form.mode === 'one') {
      payload.email = form.email.trim().toLowerCase()
    } else {
      payload.audience = form.audience
      payload.confirmBroadcast = true
    }

    const res = await adminFetch<{ sent: number; failed: number; recipients: number; mode?: string }>(
      '/api/admin/notifications/broadcast',
      token,
      { method: 'POST', body: JSON.stringify(payload) },
    )
    setSending(false)
    if (res.error || !res.data) {
      setError(res.error || 'Broadcast failed')
      return
    }
    setNotice(
      form.mode === 'one'
        ? `Sent to ${form.email.trim().toLowerCase()}`
        : `Broadcast sent ${res.data.sent} of ${res.data.recipients} · failed ${res.data.failed}`,
    )
    setForm((f) => ({ ...f, title: '', body: '', confirmBroadcast: false }))
    void load()
  }

  return (
    <section className="space-y-6">
      <PageHeader
        title="Push notifications"
        subtitle="In-app inbox only. One-user sends stay private. broadcasts copy the same message to every recipient."
      />
      {canWrite && (
        <form onSubmit={send} className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 space-y-3">
          <div className="grid sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setForm({ ...form, mode: 'one', confirmBroadcast: false })}
              className={`rounded-xl px-3 py-2.5 text-xs font-bold border ${
                form.mode === 'one' ? 'border-clay/50 bg-clay/15 text-clay' : 'border-white/10 text-white/50'
              }`}
            >
              One user
            </button>
            <button
              type="button"
              onClick={() => setForm({ ...form, mode: 'broadcast' })}
              className={`rounded-xl px-3 py-2.5 text-xs font-bold border ${
                form.mode === 'broadcast' ? 'border-amber-400/40 bg-amber-400/10 text-amber-200' : 'border-white/10 text-white/50'
              }`}
            >
              Broadcast audience
            </button>
          </div>
          <label className="block">
            <FieldLabel>Title</FieldLabel>
            <input className={fieldClass} required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </label>
          <label className="block">
            <FieldLabel>Body</FieldLabel>
            <textarea className={fieldClass} required rows={3} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
          </label>
          {form.mode === 'one' ? (
            <label className="block">
              <FieldLabel>Member email</FieldLabel>
              <input
                className={fieldClass}
                type="email"
                required
                placeholder="name@gmail.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </label>
          ) : (
            <div className="space-y-3 rounded-xl border border-amber-400/20 bg-amber-400/5 p-3">
              <label className="block">
                <FieldLabel>Audience</FieldLabel>
                <select
                  className={fieldClass}
                  value={form.audience}
                  onChange={(e) => setForm({ ...form, audience: e.target.value })}
                >
                  <option value="accepted">Accepted members</option>
                  <option value="pending">Pending waitlist</option>
                  <option value="all">Everyone on waitlist</option>
                </select>
              </label>
              <p className="text-[12px] text-amber-100/70 leading-snug">
                The same title/body is copied to every person. Do not put one member&apos;s name in the title unless you intend that.
              </p>
              <label className="flex items-start gap-2 text-[12px] text-white/70">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={form.confirmBroadcast}
                  onChange={(e) => setForm({ ...form, confirmBroadcast: e.target.checked })}
                />
                I understand this sends to the whole audience
              </label>
            </div>
          )}
          <label className="block">
            <FieldLabel>Deep link</FieldLabel>
            <input className={fieldClass} value={form.href} onChange={(e) => setForm({ ...form, href: e.target.value })} />
          </label>
          <button type="submit" disabled={sending} className={primaryBtnClass}>
            {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            {form.mode === 'one' ? 'Send to one user' : 'Broadcast'}
          </button>
        </form>
      )}
      {notice && <Callout tone="ok">{notice}</Callout>}
      {error && <Callout tone="error">{error}</Callout>}
      <div className="flex items-center justify-between">
        <p className="text-[12px] font-medium text-white/40">Recent</p>
        <button type="button" onClick={() => void load()} className={`${pressClass} text-white/40 p-2`}>
          <RefreshCw size={14} />
        </button>
      </div>
      {loading ? (
        <div className="py-12 flex justify-center"><Loader2 className="animate-spin text-clay" /></div>
      ) : (
        <div className="space-y-2">
          {rows.map((n) => (
            <div key={n.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
              <div className="flex justify-between gap-3">
                <p className="font-semibold text-[15px]">{n.title}</p>
                <span className="text-[11px] text-white/35 shrink-0">{timeAgo(n.createdAt)}</span>
              </div>
              <p className="text-[13px] text-white/45 mt-1 line-clamp-2">{n.body}</p>
              <p className="text-[11px] text-white/30 mt-2 truncate">{n.email || n.userId}</p>
            </div>
          ))}
          {!rows.length && <EmptyState>No notifications yet</EmptyState>}
        </div>
      )}
    </section>
  )
}

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
    audience: 'accepted',
    email: '',
    href: '/dashboard',
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
    const payload: Record<string, unknown> = {
      title: form.title,
      body: form.body,
      href: form.href || '/dashboard',
      type: 'info',
    }
    if (form.email.trim()) {
      payload.email = form.email.trim().toLowerCase()
    } else {
      payload.audience = form.audience
    }
    const res = await adminFetch<{ sent: number; failed: number; recipients: number }>(
      '/api/admin/notifications/broadcast',
      token,
      { method: 'POST', body: JSON.stringify(payload) },
    )
    setSending(false)
    if (res.error || !res.data) {
      setError(res.error || 'Broadcast failed')
      return
    }
    setNotice(`Sent ${res.data.sent} of ${res.data.recipients} · failed ${res.data.failed}`)
    setForm((f) => ({ ...f, title: '', body: '' }))
    void load()
  }

  return (
    <section className="space-y-6">
      <PageHeader title="Push notifications" subtitle="Inbox notifications for members (in-app)." />
      {canWrite && (
        <form onSubmit={send} className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 space-y-3">
          <label className="block">
            <FieldLabel>Title</FieldLabel>
            <input className={fieldClass} required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </label>
          <label className="block">
            <FieldLabel>Body</FieldLabel>
            <textarea className={fieldClass} required rows={3} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
          </label>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block">
              <FieldLabel>Audience</FieldLabel>
              <select
                className={fieldClass}
                value={form.audience}
                onChange={(e) => setForm({ ...form, audience: e.target.value })}
                disabled={Boolean(form.email.trim())}
              >
                <option value="accepted">Accepted members</option>
                <option value="pending">Pending waitlist</option>
                <option value="all">Everyone on waitlist</option>
              </select>
            </label>
            <label className="block">
              <FieldLabel>Or single email</FieldLabel>
              <input
                className={fieldClass}
                type="email"
                placeholder="optional…"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </label>
          </div>
          <label className="block">
            <FieldLabel>Deep link</FieldLabel>
            <input className={fieldClass} value={form.href} onChange={(e) => setForm({ ...form, href: e.target.value })} />
          </label>
          <button type="submit" disabled={sending} className={primaryBtnClass}>
            {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Send push
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

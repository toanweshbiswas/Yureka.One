import React, { useCallback, useEffect, useState } from 'react'
import { Loader2, Save } from 'lucide-react'
import {
  Callout,
  FieldLabel,
  SectionHeading,
  fieldClass,
  primaryBtnClass,
  surfaceClass,
} from './ui'

interface Envelope<T> {
  data: T | null
  status: number
  error?: string
}

type Config = {
  enabled: boolean
  pointsPerHundredInr: number
  maxPercentOfOrder: number
  notes: string
  updatedAt: string
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

export default function RewardPointsCommissionTab({
  token,
  canWrite,
}: {
  token: string | null
  canWrite: boolean
}) {
  const [form, setForm] = useState<Config>({
    enabled: true,
    pointsPerHundredInr: 10,
    maxPercentOfOrder: 30,
    notes: '',
    updatedAt: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    const res = await adminFetch<Config>('/api/admin/commission/reward-points', token)
    setLoading(false)
    if (!res.data) {
      setError(res.error || 'Failed to load reward points rates')
      return
    }
    setForm(res.data)
  }, [token])

  useEffect(() => {
    void load()
  }, [load])

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canWrite || saving) return
    setSaving(true)
    setError(null)
    setNotice(null)
    const res = await adminFetch<Config>('/api/admin/commission/reward-points', token, {
      method: 'PUT',
      body: JSON.stringify({
        enabled: form.enabled,
        pointsPerHundredInr: Math.max(0, Math.round(Number(form.pointsPerHundredInr) || 0)),
        maxPercentOfOrder: Math.min(100, Math.max(0, Number(form.maxPercentOfOrder) || 0)),
        notes: form.notes,
      }),
    })
    setSaving(false)
    if (!res.data) {
      setError(res.error || 'Failed to save')
      return
    }
    setForm(res.data)
    setNotice('Reward points rates saved')
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="animate-spin text-clay" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Reward points commission structure"
        subtitle="Default earn rates for reward points. Per-member balances are overridden on the Users tab. not here."
      />

      {error && <Callout tone="error">{error}</Callout>}
      {notice && <Callout tone="ok">{notice}</Callout>}

      <form onSubmit={save} className={`${surfaceClass} grid gap-4 p-5 md:grid-cols-2`}>
        <div className="md:col-span-2 flex items-center gap-2">
          <label className="flex min-h-[46px] items-center gap-2 text-[14px] text-white/70">
            <input
              type="checkbox"
              checked={form.enabled}
              disabled={!canWrite}
              onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
              className="h-4 w-4 rounded border-white/20"
            />
            Earn rates enabled
          </label>
        </div>
        <div>
          <FieldLabel>Points per ₹100 spend</FieldLabel>
          <input
            type="number"
            min={0}
            step={1}
            disabled={!canWrite}
            className={fieldClass}
            value={form.pointsPerHundredInr}
            onChange={(e) => setForm({ ...form, pointsPerHundredInr: Number(e.target.value) })}
          />
          <p className="mt-1 text-[12px] text-white/40">Default earn rate applied to eligible spend.</p>
        </div>
        <div>
          <FieldLabel>Max % of order (cap)</FieldLabel>
          <input
            type="number"
            min={0}
            max={100}
            step={1}
            disabled={!canWrite}
            className={fieldClass}
            value={form.maxPercentOfOrder}
            onChange={(e) => setForm({ ...form, maxPercentOfOrder: Number(e.target.value) })}
          />
          <p className="mt-1 text-[12px] text-white/40">Marketing “upto X%” cap.</p>
        </div>
        <div className="md:col-span-2">
          <FieldLabel>Ops notes</FieldLabel>
          <textarea
            rows={3}
            disabled={!canWrite}
            className={fieldClass}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Internal notes for how these rates are applied…"
          />
        </div>
        {form.updatedAt && form.updatedAt !== new Date(0).toISOString() && (
          <p className="md:col-span-2 text-[12px] text-white/35">
            Last updated {new Date(form.updatedAt).toLocaleString('en-IN')}
          </p>
        )}
        {canWrite && (
          <div className="md:col-span-2">
            <button type="submit" disabled={saving} className={primaryBtnClass}>
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Save rates
            </button>
          </div>
        )}
      </form>
    </div>
  )
}

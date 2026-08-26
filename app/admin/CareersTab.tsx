import React, { useCallback, useEffect, useState } from 'react'
import { Briefcase, Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import {
  Callout,
  ConfirmDialog,
  EmptyState,
  FieldLabel,
  PageHeader,
  Surface,
  fieldClass,
  pressClass,
  primaryBtnClass,
  secondaryBtnClass,
} from './ui'

type CareerRow = {
  id: string
  refId: string
  title: string
  department: string
  location: string
  type: string
  description: string
  applyEmail: string
  status: 'draft' | 'published'
  sortOrder: number
}

type Envelope<T> = { data: T | null; status: number; error?: string }

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

const EMPTY_FORM = {
  id: '',
  refId: '',
  title: '',
  department: '',
  location: 'Bengaluru',
  type: 'Full-time',
  description: '',
  applyEmail: 'support@yureka.one',
  status: 'draft' as 'draft' | 'published',
  sortOrder: 0,
}

export default function CareersTab({ token, canWrite }: { token: string | null; canWrite: boolean }) {
  const [roles, setRoles] = useState<CareerRow[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [pendingDelete, setPendingDelete] = useState<CareerRow | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchRoles = useCallback(async () => {
    if (!token) return
    setLoading(true)
    const res = await adminFetch<CareerRow[]>('/api/admin/careers', token)
    setLoading(false)
    if (res.error) {
      setError(res.error)
      return
    }
    setRoles(res.data || [])
  }, [token])

  useEffect(() => {
    void fetchRoles()
  }, [fetchRoles])

  const loadRole = (role: CareerRow) => {
    setForm({
      id: role.id,
      refId: role.refId,
      title: role.title,
      department: role.department,
      location: role.location,
      type: role.type,
      description: role.description || '',
      applyEmail: role.applyEmail || 'support@yureka.one',
      status: role.status === 'published' ? 'published' : 'draft',
      sortOrder: role.sortOrder ?? 0,
    })
    setNotice(null)
    setError(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const resetForm = () => {
    setForm({ ...EMPTY_FORM, sortOrder: roles.length })
    setNotice(null)
    setError(null)
  }

  const saveRole = async () => {
    if (!token || !canWrite) return
    if (!form.title.trim()) {
      setError('Title is required')
      return
    }
    setSaving(true)
    setError(null)
    const path = form.id ? `/api/admin/careers/${encodeURIComponent(form.id)}` : '/api/admin/careers'
    const method = form.id ? 'PATCH' : 'POST'
    const res = await adminFetch<CareerRow>(path, token, {
      method,
      body: JSON.stringify(form),
    })
    setSaving(false)
    if (res.error || !res.data) {
      setError(res.error || 'Save failed')
      return
    }
    setNotice(form.id ? 'Role updated' : 'Role created')
    setForm({
      id: res.data.id,
      refId: res.data.refId,
      title: res.data.title,
      department: res.data.department,
      location: res.data.location,
      type: res.data.type,
      description: res.data.description || '',
      applyEmail: res.data.applyEmail || 'support@yureka.one',
      status: res.data.status,
      sortOrder: res.data.sortOrder ?? 0,
    })
    void fetchRoles()
  }

  const confirmDelete = async () => {
    if (!token || !canWrite || !pendingDelete) return
    setDeletingId(pendingDelete.id)
    const res = await adminFetch<{ deleted: boolean }>(
      `/api/admin/careers/${encodeURIComponent(pendingDelete.id)}`,
      token,
      { method: 'DELETE' },
    )
    setDeletingId(null)
    setPendingDelete(null)
    if (res.error) {
      setError(res.error)
      return
    }
    if (form.id === pendingDelete.id) resetForm()
    setNotice('Role deleted')
    void fetchRoles()
  }

  return (
    <section className="space-y-8">
      <PageHeader
        title="Careers"
        subtitle="Manage open roles on yureka.one/jobs. Draft roles stay hidden from the public page."
        actions={
          canWrite ? (
            <button type="button" onClick={resetForm} className={secondaryBtnClass}>
              <Plus size={16} />
              New role
            </button>
          ) : undefined
        }
      />

      {notice && <Callout tone="ok">{notice}</Callout>}
      {error && <Callout tone="error">{error}</Callout>}

      {canWrite && (
        <Surface className="space-y-4">
          <h3 className="text-[15px] font-semibold text-white">{form.id ? 'Edit role' : 'Create role'}</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <FieldLabel>Title</FieldLabel>
              <input
                className={fieldClass}
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Founding AI Engineer"
              />
            </div>
            <div>
              <FieldLabel>Ref ID</FieldLabel>
              <input
                className={fieldClass}
                value={form.refId}
                onChange={(e) => setForm((f) => ({ ...f, refId: e.target.value }))}
                placeholder="ENG-001"
              />
            </div>
            <div>
              <FieldLabel>Department</FieldLabel>
              <input
                className={fieldClass}
                value={form.department}
                onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
                placeholder="Engineering"
              />
            </div>
            <div>
              <FieldLabel>Location</FieldLabel>
              <input
                className={fieldClass}
                value={form.location}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              />
            </div>
            <div>
              <FieldLabel>Type</FieldLabel>
              <input
                className={fieldClass}
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                placeholder="Full-time"
              />
            </div>
            <div>
              <FieldLabel>Sort order</FieldLabel>
              <input
                type="number"
                className={fieldClass}
                value={form.sortOrder}
                onChange={(e) => setForm((f) => ({ ...f, sortOrder: Number(e.target.value) || 0 }))}
              />
            </div>
            <div className="md:col-span-2">
              <FieldLabel>Apply email</FieldLabel>
              <input
                type="email"
                className={fieldClass}
                value={form.applyEmail}
                onChange={(e) => setForm((f) => ({ ...f, applyEmail: e.target.value }))}
              />
            </div>
            <div className="md:col-span-2">
              <FieldLabel>Description</FieldLabel>
              <textarea
                rows={4}
                className={fieldClass}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="What the role owns, who it is for, and what great looks like."
              />
            </div>
            <div>
              <FieldLabel>Status</FieldLabel>
              <select
                className={fieldClass}
                value={form.status}
                onChange={(e) =>
                  setForm((f) => ({ ...f, status: e.target.value === 'published' ? 'published' : 'draft' }))
                }
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={saving} onClick={() => void saveRole()} className={primaryBtnClass}>
              {saving ? <Loader2 size={16} className="animate-spin" /> : null}
              {form.id ? 'Save changes' : 'Create role'}
            </button>
            {form.id && (
              <button type="button" onClick={resetForm} className={secondaryBtnClass}>
                Cancel edit
              </button>
            )}
          </div>
        </Surface>
      )}

      <Surface>
        <div className="flex items-center justify-between gap-3 mb-4">
          <h3 className="text-[15px] font-semibold text-white">All roles</h3>
          <button type="button" onClick={() => void fetchRoles()} className={secondaryBtnClass}>
            Refresh
          </button>
        </div>
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin text-clay" size={24} />
          </div>
        ) : !roles.length ? (
          <EmptyState>No career roles yet. Create one above.</EmptyState>
        ) : (
          <div className="divide-y divide-white/[0.06]">
            {roles.map((role) => (
              <div key={role.id} className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Briefcase size={14} className="text-clay shrink-0" />
                    <p className="font-semibold text-white truncate">{role.title}</p>
                    <span className="text-[10px] uppercase tracking-[0.18em] text-white/35">{role.refId}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] ${
                        role.status === 'published'
                          ? 'bg-clay/15 text-clay'
                          : 'bg-white/10 text-white/45'
                      }`}
                    >
                      {role.status}
                    </span>
                  </div>
                  <p className="mt-1 text-[13px] text-white/45">
                    {role.department} · {role.location} · {role.type}
                  </p>
                </div>
                {canWrite && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button type="button" onClick={() => loadRole(role)} className={`${pressClass} ${secondaryBtnClass}`}>
                      <Pencil size={14} />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingDelete(role)}
                      disabled={deletingId === role.id}
                      className={`${pressClass} ${secondaryBtnClass} text-red-200/80`}
                    >
                      {deletingId === role.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                      Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Surface>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete role?"
        body={pendingDelete ? `Remove "${pendingDelete.title}" from the careers page.` : ''}
        confirmLabel="Delete"
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => void confirmDelete()}
      />
    </section>
  )
}

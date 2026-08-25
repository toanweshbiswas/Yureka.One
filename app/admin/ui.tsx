import React, { useState } from 'react'
import { Loader2, Upload } from 'lucide-react'

export const fieldClass =
  'w-full rounded-[14px] bg-white/[0.06] border border-white/10 px-3.5 py-[11px] text-[15px] leading-snug text-white placeholder:text-white/32 outline-none focus:border-white/28 transition-[border-color] duration-150'

export const pressClass =
  'active:scale-[0.97] transition-transform duration-100 ease-out motion-reduce:transform-none motion-reduce:transition-none'

export const primaryBtnClass =
  `inline-flex items-center justify-center gap-2 rounded-[14px] bg-clay text-black font-semibold text-[15px] px-5 py-3 ${pressClass} disabled:opacity-40 disabled:pointer-events-none`

export const secondaryBtnClass =
  `inline-flex items-center justify-center gap-2 rounded-[14px] bg-white/[0.08] border border-white/10 text-white font-medium text-[15px] px-5 py-3 ${pressClass} disabled:opacity-40`

export const ghostBtnClass =
  `inline-flex items-center justify-center gap-2 rounded-[14px] text-white/55 hover:text-white hover:bg-white/[0.06] font-medium text-[14px] px-3 py-2 ${pressClass}`

export const surfaceClass =
  'rounded-[18px] border border-white/[0.08] bg-white/[0.04] backdrop-blur-xl backdrop-saturate-150'

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: string
  actions?: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-7">
      <div className="min-w-0">
        <h1 className="text-[28px] font-semibold tracking-[-0.022em] leading-tight text-white">{title}</h1>
        {subtitle ? (
          <p className="text-[15px] text-white/45 mt-1.5 leading-relaxed max-w-xl">{subtitle}</p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2 shrink-0">{actions}</div> : null}
    </div>
  )
}

/** Compact section heading for nested admin panels */
export function SectionHeading({
  title,
  subtitle,
}: {
  title: string
  subtitle?: string
}) {
  return (
    <div className="mb-3">
      <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-white">{title}</h2>
      {subtitle ? (
        <p className="mt-1 text-[13px] leading-snug text-white/45">{subtitle}</p>
      ) : null}
    </div>
  )
}

export function Surface({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`${surfaceClass} ${className}`}>{children}</div>
}

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="block text-[13px] font-medium text-white/50 mb-1.5">{children}</span>
}

export function Callout({
  tone = 'neutral',
  children,
}: {
  tone?: 'neutral' | 'ok' | 'error'
  children: React.ReactNode
}) {
  const map = {
    neutral: 'border-white/10 bg-white/[0.04] text-white/70',
    ok: 'border-clay/20 bg-clay/10 text-clay',
    error: 'border-red-400/20 bg-red-500/10 text-red-200',
  }
  return <p className={`rounded-[14px] border px-3.5 py-2.5 text-[14px] leading-relaxed ${map[tone]}`}>{children}</p>
}

export function StatusPill({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode
  tone?: 'neutral' | 'ok' | 'warn' | 'bad'
}) {
  const map = {
    ok: 'bg-clay/12 text-clay',
    warn: 'bg-amber-400/12 text-amber-200',
    bad: 'bg-red-500/12 text-red-200',
    neutral: 'bg-white/[0.06] text-white/50',
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[12px] font-medium capitalize ${map[tone]}`}>
      {children}
    </span>
  )
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="text-center text-[15px] text-white/35 py-16">{children}</p>
}

/** Upload to Supabase (via admin blogs/upload) or paste a URL — used across Club forms. */
export function ImageUrlField({
  label = 'Image',
  value,
  onChange,
  token,
  canWrite,
  placeholder = 'or paste an image URL',
  previewClassName = 'h-24 w-24 object-contain rounded-[14px] border border-white/10 bg-black/30 p-2',
  className = '',
}: {
  label?: string
  value: string
  onChange: (url: string) => void
  token: string | null
  canWrite: boolean
  placeholder?: string
  previewClassName?: string
  className?: string
}) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onFile = async (file: File | undefined) => {
    if (!file || !canWrite) return
    if (!token) {
      setError('Sign in again to upload')
      return
    }
    setError(null)
    setUploading(true)
    try {
      const res = await fetch('/api/admin/blogs/upload?kind=club', {
        method: 'POST',
        headers: {
          'X-Admin-Session': token,
          'Content-Type': file.type || 'image/jpeg',
          'X-Filename': file.name,
          'X-Image-Kind': 'club',
        },
        body: file,
      })
      const json = (await res.json()) as { data?: { url?: string }; error?: string }
      if (!res.ok || json.error || !json.data?.url) {
        throw new Error(json.error || `Upload failed (${res.status})`)
      }
      onChange(json.data.url)
    } catch (e: any) {
      setError(e?.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <FieldLabel>{label}</FieldLabel>
      <div className="flex flex-col sm:flex-row gap-3">
        <label
          className={`${secondaryBtnClass} cursor-pointer shrink-0 ${
            uploading || !canWrite ? 'opacity-50 pointer-events-none' : ''
          }`}
        >
          {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
          {uploading ? 'Uploading…' : 'Upload image'}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
            className="hidden"
            disabled={uploading || !canWrite}
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              void onFile(file)
            }}
          />
        </label>
        <input
          className={fieldClass}
          placeholder={placeholder}
          value={value}
          onChange={(e) => {
            setError(null)
            onChange(e.target.value)
          }}
          disabled={!canWrite}
        />
      </div>
      {error ? <Callout tone="error">{error}</Callout> : null}
      {value ? <img src={value} alt="" className={previewClassName} /> : null}
    </div>
  )
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = 'Delete',
  busy,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  body: string
  confirmLabel?: string
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/55 backdrop-blur-sm"
        aria-label="Cancel"
        onClick={onCancel}
      />
      <div className={`${surfaceClass} relative w-full max-w-sm p-5 space-y-4 shadow-[0_24px_80px_rgba(0,0,0,0.55)]`}>
        <div>
          <h2 className="text-[20px] font-semibold tracking-[-0.02em] leading-tight">{title}</h2>
          <p className="text-[15px] text-white/50 mt-2 leading-relaxed">{body}</p>
        </div>
        <div className="flex gap-2">
          <button type="button" className={`${secondaryBtnClass} flex-1`} onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className={`${primaryBtnClass} flex-1 !bg-red-500 !text-white`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Deleting…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

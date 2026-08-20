import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Plus, Trash2, Mail, Pencil, ImagePlus, Upload } from 'lucide-react'
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
  surfaceClass,
} from './ui'

type BlogRow = {
  id: string
  title: string
  slug: string
  excerpt: string
  content: string
  contentFormat?: 'html' | 'markdown'
  author: string
  category: string
  image: string
  featured?: boolean
  status?: 'draft' | 'published'
  notifiedAt?: string | null
  createdAt?: string
  updatedAt?: string
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

function slugFromTitle(title: string) {
  const slug = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
  return slug || 'post'
}

const EMPTY_FORM = {
  id: '',
  title: '',
  slug: '',
  excerpt: '',
  content: '',
  author: 'Yureka Editorial',
  category: 'Blog',
  image: '',
  featured: false,
  status: 'draft' as 'draft' | 'published',
  notify: false,
}

export default function BlogsTab({ token, canWrite }: { token: string | null; canWrite: boolean }) {
  const [posts, setPosts] = useState<BlogRow[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [slugLocked, setSlugLocked] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<BlogRow | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [notifyingId, setNotifyingId] = useState<string | null>(null)
  const [uploadingCover, setUploadingCover] = useState(false)
  const [uploadingInline, setUploadingInline] = useState(false)

  const uploadImage = async (file: File, kind: 'cover' | 'inline') => {
    if (!token) throw new Error('Sign in again')
    const res = await fetch(`/api/admin/blogs/upload?kind=${kind}`, {
      method: 'POST',
      headers: {
        'X-Admin-Session': token,
        'Content-Type': file.type || 'image/jpeg',
        'X-Filename': file.name,
        'X-Image-Kind': kind,
      },
      body: file,
    })
    const json = (await res.json()) as Envelope<{ url: string }>
    if (!res.ok || json.error || !json.data?.url) {
      throw new Error(json.error || `Upload failed (${res.status})`)
    }
    return json.data.url
  }

  const onCoverFile = async (file: File | undefined) => {
    if (!file || !canWrite) return
    setError(null)
    setUploadingCover(true)
    try {
      const url = await uploadImage(file, 'cover')
      setForm((prev) => ({ ...prev, image: url }))
      setNotice('Cover image uploaded to Supabase')
    } catch (e: any) {
      setError(e?.message || 'Cover upload failed')
    } finally {
      setUploadingCover(false)
    }
  }

  const onInlineFile = async (file: File | undefined) => {
    if (!file || !canWrite) return
    setError(null)
    setUploadingInline(true)
    try {
      const url = await uploadImage(file, 'inline')
      const tag = `<p><img src="${url}" alt="" /></p>`
      setForm((prev) => ({
        ...prev,
        content: prev.content ? `${prev.content.trim()}\n${tag}` : tag,
      }))
      setNotice('Image uploaded and added to the article body')
    } catch (e: any) {
      setError(e?.message || 'Image upload failed')
    } finally {
      setUploadingInline(false)
    }
  }

  const fetchPosts = useCallback(async () => {
    if (!token) return
    setLoading(true)
    const res = await adminFetch<BlogRow[]>('/api/admin/blogs', token)
    setLoading(false)
    if (res.error) {
      setError(res.error)
      return
    }
    setPosts(res.data || [])
  }, [token])

  useEffect(() => {
    void fetchPosts()
  }, [fetchPosts])

  const autoSlug = useMemo(() => slugFromTitle(form.title), [form.title])
  const urlSlug = slugLocked ? form.slug : autoSlug

  const loadPost = (post: BlogRow) => {
    setForm({
      id: post.id,
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt || '',
      content: post.content || '',
      author: post.author || 'Yureka Editorial',
      category: post.category || 'Blog',
      image: post.image || '',
      featured: Boolean(post.featured),
      status: post.status === 'published' ? 'published' : 'draft',
      notify: false,
    })
    setSlugLocked(true)
    setNotice(null)
    setError(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const resetForm = () => {
    setForm(EMPTY_FORM)
    setSlugLocked(false)
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canWrite) return
    setSaving(true)
    setError(null)
    setNotice(null)
    const payload = {
      ...form,
      slug: urlSlug,
      contentFormat: 'html' as const,
    }
    const path = form.id ? `/api/admin/blogs/${encodeURIComponent(form.id)}` : '/api/admin/blogs'
    const res = await adminFetch<BlogRow>(path, token, {
      method: form.id ? 'PATCH' : 'POST',
      body: JSON.stringify(payload),
    })
    setSaving(false)
    if (res.error) {
      setError(res.error)
      return
    }
    const queued = (res.data as any)?.notify?.queued
    setNotice(
      queued
        ? `Saved. ${form.status === 'published' ? 'Live on /blog/' + urlSlug + '. Emails are sending to all users.' : 'Draft stored.'}`
        : form.status === 'published'
          ? `Published at /blog/${urlSlug}`
          : 'Draft saved'
    )
    resetForm()
    fetchPosts()
  }

  const remove = async (id: string) => {
    setDeletingId(id)
    const res = await adminFetch('/api/admin/blogs/' + encodeURIComponent(id), token, { method: 'DELETE' })
    setDeletingId(null)
    setPendingDelete(null)
    if (res.error) {
      setError(res.error)
      return
    }
    if (form.id === id) resetForm()
    fetchPosts()
  }

  const notify = async (post: BlogRow) => {
    setNotifyingId(post.id)
    setError(null)
    const res = await adminFetch<{ sent: number; failed: number; total: number }>(
      `/api/admin/blogs/${encodeURIComponent(post.id)}/notify`,
      token,
      { method: 'POST' }
    )
    setNotifyingId(null)
    if (res.error) {
      setError(res.error)
      return
    }
    setNotice(`Emailed ${res.data?.sent || 0} of ${res.data?.total || 0} users about “${post.title}”.`)
    fetchPosts()
  }

  return (
    <section className="space-y-6">
      <PageHeader
        title="Blog"
        subtitle="Paste HTML, publish to yureka.one/blog, and optionally email every member."
      />

      {canWrite && (
        <form onSubmit={save} className={`${surfaceClass} p-5 space-y-4`}>
          <h3 className="text-[15px] font-semibold tracking-[-0.015em] text-white flex items-center gap-2">
            <Plus size={16} /> {form.id ? 'Edit post' : 'New post'}
          </h3>
          <div className="grid md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <FieldLabel>Title</FieldLabel>
              <input
                className={fieldClass}
                placeholder="How Yureka turns spend into gold"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
              />
            </div>
            <div className="md:col-span-2">
              <FieldLabel>URL (from title)</FieldLabel>
              <div className="flex items-center gap-2">
                <span className="text-[13px] text-white/35 shrink-0">yureka.one/blog/</span>
                <input
                  className={fieldClass}
                  value={urlSlug}
                  onChange={(e) => {
                    setSlugLocked(true)
                    setForm({ ...form, slug: e.target.value })
                  }}
                  placeholder="auto-from-title"
                />
              </div>
            </div>
            <div>
              <FieldLabel>Author</FieldLabel>
              <input className={fieldClass} value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} />
            </div>
            <div>
              <FieldLabel>Category</FieldLabel>
              <input className={fieldClass} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            </div>
            <div className="md:col-span-2 space-y-3">
              <FieldLabel>Cover image</FieldLabel>
              <div className="flex flex-col sm:flex-row gap-3">
                <label className={`${secondaryBtnClass} cursor-pointer ${uploadingCover ? 'opacity-50 pointer-events-none' : ''}`}>
                  {uploadingCover ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  {uploadingCover ? 'Uploading…' : 'Upload to Supabase'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                    className="hidden"
                    disabled={uploadingCover || !canWrite}
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      e.target.value = ''
                      void onCoverFile(file)
                    }}
                  />
                </label>
                <input
                  className={fieldClass}
                  placeholder="or paste an image URL"
                  value={form.image}
                  onChange={(e) => setForm({ ...form, image: e.target.value })}
                />
              </div>
              {form.image ? (
                <img src={form.image} alt="" className="h-36 w-full max-w-md object-cover rounded-[14px] border border-white/10" />
              ) : null}
            </div>
            <div className="md:col-span-2">
              <FieldLabel>Excerpt</FieldLabel>
              <textarea
                className={fieldClass}
                rows={2}
                placeholder="One-line pull quote for cards and email"
                value={form.excerpt}
                onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
              />
            </div>
            <div className="md:col-span-2">
              <div className="flex items-center justify-between gap-3 mb-2">
                <FieldLabel>Body (paste HTML)</FieldLabel>
                <label className={`${secondaryBtnClass} cursor-pointer text-[13px] py-2 ${uploadingInline ? 'opacity-50 pointer-events-none' : ''}`}>
                  {uploadingInline ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}
                  {uploadingInline ? 'Uploading…' : 'Add image'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                    className="hidden"
                    disabled={uploadingInline || !canWrite}
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      e.target.value = ''
                      void onInlineFile(file)
                    }}
                  />
                </label>
              </div>
              <textarea
                className={`${fieldClass} font-mono text-[13px] min-h-[220px]`}
                rows={12}
                placeholder={'<p>Paste article HTML here…</p>'}
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                required
              />
            </div>
          </div>

          {form.content && (
            <div className="rounded-[14px] border border-white/10 bg-black/30 p-4">
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/35 mb-3">Preview</p>
              <div
                className="prose prose-invert prose-sm max-w-none text-white/80"
                dangerouslySetInnerHTML={{ __html: form.content }}
              />
            </div>
          )}

          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-[14px] text-white/70">
              <input
                type="checkbox"
                checked={form.status === 'published'}
                onChange={(e) => setForm({ ...form, status: e.target.checked ? 'published' : 'draft' })}
              />
              Publish now
            </label>
            <label className="flex items-center gap-2 text-[14px] text-white/70">
              <input
                type="checkbox"
                checked={form.featured}
                onChange={(e) => setForm({ ...form, featured: e.target.checked })}
              />
              Featured
            </label>
            <label className="flex items-center gap-2 text-[14px] text-white/70">
              <input
                type="checkbox"
                checked={form.notify}
                disabled={form.status !== 'published'}
                onChange={(e) => setForm({ ...form, notify: e.target.checked })}
              />
              Email all users
            </label>
          </div>

          <div className="flex gap-2">
            <button type="submit" disabled={saving} className={primaryBtnClass}>
              {saving ? <Loader2 size={16} className="animate-spin" /> : null}
              {form.id ? 'Save post' : form.status === 'published' ? 'Publish' : 'Save draft'}
            </button>
            {form.id ? (
              <button type="button" className={secondaryBtnClass} onClick={resetForm}>
                New post
              </button>
            ) : null}
          </div>
        </form>
      )}

      {error && <Callout tone="error">{error}</Callout>}
      {notice && <Callout tone="ok">{notice}</Callout>}

      {loading ? (
        <div className="py-16 flex justify-center"><Loader2 className="animate-spin text-clay" /></div>
      ) : (
        <div className="grid gap-3">
          {posts.map((p) => (
            <Surface key={p.id} className="p-5">
              <div className="flex justify-between gap-3">
                {p.image ? (
                  <img src={p.image} alt="" className="h-16 w-24 object-cover rounded-[10px] border border-white/10 shrink-0" />
                ) : null}
                <div className="min-w-0 flex-1">
                  <p className="text-[17px] font-semibold tracking-[-0.015em]">{p.title}</p>
                  <p className="text-white/40 text-[13px] mt-1 truncate">
                    /blog/{p.slug} · {p.category} · {p.author}
                  </p>
                </div>
                <span className={`text-[12px] font-medium capitalize rounded-full px-2.5 py-1 h-fit ${p.status === 'published' ? 'text-clay bg-clay/10' : 'text-white/35 bg-white/5'}`}>
                  {p.status || 'draft'}
                </span>
              </div>
              {p.excerpt ? <p className="text-white/45 text-[15px] mt-3 line-clamp-2 leading-relaxed">{p.excerpt}</p> : null}
              {canWrite && (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button type="button" className={secondaryBtnClass} onClick={() => loadPost(p)}>
                    <Pencil size={14} /> Edit
                  </button>
                  {p.status === 'published' && (
                    <button
                      type="button"
                      className={secondaryBtnClass}
                      disabled={notifyingId === p.id}
                      onClick={() => notify(p)}
                    >
                      {notifyingId === p.id ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
                      {p.notifiedAt ? 'Email again' : 'Email users'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setPendingDelete(p)}
                    className={`${pressClass} text-red-300/60 hover:text-red-300 p-2 rounded-[10px] hover:bg-red-500/10 ml-auto`}
                    aria-label={`Delete ${p.title}`}
                  >
                    {deletingId === p.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  </button>
                </div>
              )}
            </Surface>
          ))}
          {!posts.length && <EmptyState>No journal posts yet</EmptyState>}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete this post?"
        body={pendingDelete ? `${pendingDelete.title} will be removed from the journal.` : ''}
        confirmLabel="Delete post"
        busy={Boolean(pendingDelete && deletingId === pendingDelete.id)}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && remove(pendingDelete.id)}
      />
    </section>
  )
}

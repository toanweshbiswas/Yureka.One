import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { excerptFromHtml, estimateReadTime, looksLikeHtml, sanitizeBlogHtml, slugFromTitle } from './blogHtml.js'

export type BlogContentFormat = 'html' | 'markdown'

export interface CmsBlog {
  id: string
  title: string
  slug: string
  excerpt: string
  content: string
  contentFormat: BlogContentFormat
  author: string
  category: string
  image: string
  featured: boolean
  readTime: string
  status: 'draft' | 'published'
  notifiedAt: string | null
  createdAt: string
  updatedAt: string
  publishedAt: string | null
}

export type BlogInput = Partial<CmsBlog> & { title: string }

interface BlogFileStore {
  posts: CmsBlog[]
}

function forceFileMode() {
  return (process.env.BLOG_STORE || '').toLowerCase() === 'file'
}

let supabaseSchemaUnavailable = false

function isMissingSchemaError(message: string | undefined) {
  const text = String(message || '').toLowerCase()
  return (
    text.includes('could not find the table') ||
    text.includes('schema cache') ||
    text.includes('does not exist')
  )
}

function filePath() {
  return path.join(process.cwd(), 'data', 'blogs_store.json')
}

function emptyStore(): BlogFileStore {
  return { posts: [] }
}

function readFileStore(): BlogFileStore {
  const p = filePath()
  try {
    if (!fs.existsSync(p)) {
      const snap = emptyStore()
      fs.mkdirSync(path.dirname(p), { recursive: true })
      fs.writeFileSync(p, JSON.stringify(snap, null, 2))
      return snap
    }
    const raw = JSON.parse(fs.readFileSync(p, 'utf-8')) as BlogFileStore
    if (!Array.isArray(raw.posts)) raw.posts = []
    return raw
  } catch {
    const snap = emptyStore()
    writeFileStore(snap)
    return snap
  }
}

function writeFileStore(snap: BlogFileStore) {
  fs.mkdirSync(path.dirname(filePath()), { recursive: true })
  fs.writeFileSync(filePath(), JSON.stringify(snap, null, 2))
}

function getSupabase(): SupabaseClient | null {
  if (forceFileMode() || supabaseSchemaUnavailable) return null
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || ''
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

function mapRow(row: any): CmsBlog {
  const content = String(row.content || '')
  const format: BlogContentFormat =
    row.content_format || row.contentFormat || (looksLikeHtml(content) ? 'html' : 'markdown')
  return {
    id: String(row.id),
    title: String(row.title || ''),
    slug: String(row.slug || ''),
    excerpt: String(row.excerpt || ''),
    content,
    contentFormat: format === 'markdown' ? 'markdown' : 'html',
    author: String(row.author || 'Yureka Editorial'),
    category: String(row.category || 'Blog'),
    image: String(row.image || ''),
    featured: Boolean(row.featured),
    readTime: String(row.read_time || row.readTime || estimateReadTime(content)),
    status: row.status === 'published' ? 'published' : 'draft',
    notifiedAt: row.notified_at || row.notifiedAt || null,
    createdAt: row.created_at || row.createdAt || new Date().toISOString(),
    updatedAt: row.updated_at || row.updatedAt || new Date().toISOString(),
    publishedAt: row.published_at || row.publishedAt || null,
  }
}

function toApi(blog: CmsBlog) {
  return {
    id: blog.id,
    title: blog.title,
    slug: blog.slug,
    excerpt: blog.excerpt,
    content: blog.content,
    contentFormat: blog.contentFormat,
    author: blog.author,
    category: blog.category,
    image: blog.image,
    featured: blog.featured,
    readTime: blog.readTime,
    status: blog.status,
    notifiedAt: blog.notifiedAt,
    createdAt: blog.createdAt,
    updatedAt: blog.updatedAt,
    publishedAt: blog.publishedAt,
    date: blog.publishedAt || blog.createdAt,
  }
}

export function blogToApi(blog: CmsBlog) {
  return toApi(blog)
}

function uniqueSlug(desired: string, existing: CmsBlog[], exceptId?: string): string {
  const base = slugFromTitle(desired)
  let slug = base
  let n = 2
  const taken = (s: string) => existing.some((p) => p.slug === s && p.id !== exceptId)
  while (taken(slug)) {
    slug = `${base}-${n}`
    n += 1
  }
  return slug
}

function normalizeInput(input: BlogInput, existing: CmsBlog[], previous?: CmsBlog | null): CmsBlog {
  const now = new Date().toISOString()
  const rawContent = String(input.content ?? previous?.content ?? '')
  const format: BlogContentFormat =
    input.contentFormat === 'markdown' || (!input.contentFormat && previous?.contentFormat === 'markdown' && !looksLikeHtml(rawContent))
      ? 'markdown'
      : 'html'
  const content = format === 'html' ? sanitizeBlogHtml(rawContent) : rawContent
  const title = String(input.title || previous?.title || '').trim()
  const slugSource =
    String(input.slug || '').trim() ||
    (previous && title === previous.title ? previous.slug : title)
  const status: CmsBlog['status'] =
    input.status === 'published' ? 'published' : input.status === 'draft' ? 'draft' : previous?.status || 'draft'
  const published =
    status === 'published' ? previous?.publishedAt || now : previous?.status === 'published' ? previous.publishedAt : null

  return {
    id: previous?.id || input.id || randomUUID(),
    title,
    slug: uniqueSlug(slugSource, existing, previous?.id),
    excerpt: String(input.excerpt || previous?.excerpt || excerptFromHtml(content)).trim(),
    content,
    contentFormat: format,
    author: String(input.author || previous?.author || 'Yureka Editorial').trim() || 'Yureka Editorial',
    category: String(input.category || previous?.category || 'Blog').trim() || 'Blog',
    image: String(input.image || previous?.image || '').trim(),
    featured: input.featured ?? previous?.featured ?? false,
    readTime: String(input.readTime || previous?.readTime || estimateReadTime(content)),
    status,
    notifiedAt: previous?.notifiedAt || null,
    createdAt: previous?.createdAt || now,
    updatedAt: now,
    publishedAt: published,
  }
}

export async function listBlogs(opts?: { includeDrafts?: boolean }): Promise<CmsBlog[]> {
  const sb = getSupabase()
  if (sb) {
    let q = sb.from('cms_blogs').select('*').order('created_at', { ascending: false })
    if (!opts?.includeDrafts) q = q.eq('status', 'published')
    const { data, error } = await q
    if (error) {
      if (isMissingSchemaError(error.message)) supabaseSchemaUnavailable = true
      else console.warn('[blogs] supabase list failed:', error.message)
    } else if (data) {
      return data.map(mapRow)
    }
  }
  const posts = readFileStore().posts.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return opts?.includeDrafts ? posts : posts.filter((p) => p.status === 'published')
}

export async function getBlogBySlug(slug: string, opts?: { includeDrafts?: boolean }): Promise<CmsBlog | null> {
  const normalized = String(slug || '').trim().toLowerCase()
  if (!normalized) return null
  const sb = getSupabase()
  if (sb) {
    const { data, error } = await sb.from('cms_blogs').select('*').eq('slug', normalized).maybeSingle()
    if (error) {
      if (isMissingSchemaError(error.message)) supabaseSchemaUnavailable = true
      else console.warn('[blogs] supabase get failed:', error.message)
    } else if (data) {
      const blog = mapRow(data)
      if (!opts?.includeDrafts && blog.status !== 'published') return null
      return blog
    }
  }
  const blog = readFileStore().posts.find((p) => p.slug === normalized) || null
  if (!blog) return null
  if (!opts?.includeDrafts && blog.status !== 'published') return null
  return blog
}

export async function getBlogById(id: string): Promise<CmsBlog | null> {
  const sb = getSupabase()
  if (sb) {
    const { data, error } = await sb.from('cms_blogs').select('*').eq('id', id).maybeSingle()
    if (error) {
      if (isMissingSchemaError(error.message)) supabaseSchemaUnavailable = true
    } else if (data) return mapRow(data)
  }
  return readFileStore().posts.find((p) => p.id === id) || null
}

export async function upsertBlog(input: BlogInput): Promise<CmsBlog> {
  const existing = await listBlogs({ includeDrafts: true })
  const previous = input.id ? existing.find((p) => p.id === input.id) || null : null
  const next = normalizeInput(input, existing, previous)

  const sb = getSupabase()
  if (sb) {
    const row = {
      id: next.id,
      title: next.title,
      slug: next.slug,
      excerpt: next.excerpt,
      content: next.content,
      content_format: next.contentFormat,
      author: next.author,
      category: next.category,
      image: next.image,
      featured: next.featured,
      read_time: next.readTime,
      status: next.status,
      notified_at: next.notifiedAt,
      created_at: next.createdAt,
      updated_at: next.updatedAt,
      published_at: next.publishedAt,
    }
    const { data, error } = await sb.from('cms_blogs').upsert(row).select('*').single()
    if (error) {
      if (isMissingSchemaError(error.message)) supabaseSchemaUnavailable = true
      else throw new Error(error.message)
    } else if (data) {
      return mapRow(data)
    }
  }

  const snap = readFileStore()
  const idx = snap.posts.findIndex((p) => p.id === next.id)
  if (idx >= 0) snap.posts[idx] = next
  else snap.posts.unshift(next)
  writeFileStore(snap)
  return next
}

export async function deleteBlog(id: string): Promise<boolean> {
  const sb = getSupabase()
  if (sb) {
    const { error } = await sb.from('cms_blogs').delete().eq('id', id)
    if (error) {
      if (isMissingSchemaError(error.message)) supabaseSchemaUnavailable = true
      else throw new Error(error.message)
    } else {
      return true
    }
  }
  const snap = readFileStore()
  const next = snap.posts.filter((p) => p.id !== id)
  if (next.length === snap.posts.length) return false
  snap.posts = next
  writeFileStore(snap)
  return true
}

export async function markBlogNotified(id: string): Promise<CmsBlog | null> {
  const blog = await getBlogById(id)
  if (!blog) return null
  blog.notifiedAt = new Date().toISOString()
  blog.updatedAt = blog.notifiedAt
  return upsertBlog(blog)
}

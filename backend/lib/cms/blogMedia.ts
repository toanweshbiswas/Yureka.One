import { randomUUID } from 'crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export const BLOG_IMAGE_BUCKET = 'blog-images'
export const BLOG_IMAGE_MAX_BYTES = 8 * 1024 * 1024

const ALLOWED: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
}

let bucketReady = false

function serviceClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || ''
  if (!url || !key) {
    throw new Error('Supabase Storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.')
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

function extFrom(name: string, contentType: string) {
  const fromType = ALLOWED[contentType.toLowerCase()]
  if (fromType) return fromType
  const m = String(name || '').toLowerCase().match(/\.([a-z0-9]+)$/)
  const ext = m?.[1]
  if (ext && ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'].includes(ext)) {
    return ext === 'jpeg' ? 'jpg' : ext
  }
  return null
}

async function ensureBucket(sb: SupabaseClient) {
  if (bucketReady) return
  const existing = await sb.storage.getBucket(BLOG_IMAGE_BUCKET)
  if (existing.error || !existing.data) {
    const created = await sb.storage.createBucket(BLOG_IMAGE_BUCKET, {
      public: true,
      fileSizeLimit: `${BLOG_IMAGE_MAX_BYTES}`,
      allowedMimeTypes: Object.keys(ALLOWED),
    })
    if (created.error && !String(created.error.message || '').toLowerCase().includes('already exists')) {
      throw new Error(created.error.message)
    }
  } else if (!existing.data.public) {
    await sb.storage.updateBucket(BLOG_IMAGE_BUCKET, { public: true })
  }
  bucketReady = true
}

export async function uploadBlogImage(opts: {
  buffer: Buffer
  filename?: string
  contentType?: string
  kind?: 'cover' | 'inline'
}): Promise<{ url: string; path: string; bucket: string }> {
  const contentType = String(opts.contentType || '').toLowerCase() || 'image/jpeg'
  if (!ALLOWED[contentType]) {
    throw new Error('Only JPG, PNG, WebP, GIF, or AVIF images are allowed')
  }
  if (!opts.buffer?.length) throw new Error('Empty file')
  if (opts.buffer.length > BLOG_IMAGE_MAX_BYTES) {
    throw new Error('Image must be 8MB or smaller')
  }

  const ext = extFrom(opts.filename || '', contentType)
  if (!ext) throw new Error('Could not determine image type')

  const folder = opts.kind === 'inline' ? 'inline' : 'covers'
  const path = `${folder}/${randomUUID()}.${ext}`
  const sb = serviceClient()
  await ensureBucket(sb)

  const uploaded = await sb.storage.from(BLOG_IMAGE_BUCKET).upload(path, opts.buffer, {
    contentType,
    upsert: false,
    cacheControl: '31536000',
  })
  if (uploaded.error) throw new Error(uploaded.error.message)

  const { data } = sb.storage.from(BLOG_IMAGE_BUCKET).getPublicUrl(path)
  if (!data?.publicUrl) throw new Error('Upload succeeded but no public URL was returned')
  return { url: data.publicUrl, path, bucket: BLOG_IMAGE_BUCKET }
}

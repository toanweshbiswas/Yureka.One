export function slugFromTitle(title: string): string {
  const slug = String(title || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
  return slug || 'post'
}

export function looksLikeHtml(content: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(String(content || '').trim())
}

/** Strip executable markup from admin-pasted HTML. Admin is trusted, this is a belt. */
export function sanitizeBlogHtml(html: string): string {
  return String(html || '')
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
    .replace(/<\/?(?:iframe|object|embed|link|meta|form|input|button)[^>]*>/gi, '')
    .replace(/\son\w+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, '')
    .replace(/(href|src)\s*=\s*(['"])\s*javascript:[^'"]*\2/gi, '$1=$2#$2')
}

export function estimateReadTime(content: string): string {
  const text = String(content || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const words = text ? text.split(' ').length : 0
  const mins = Math.max(1, Math.ceil(words / 200))
  return `${mins} min read`
}

export function excerptFromHtml(content: string, fallback = ''): string {
  const text = String(content || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!text) return fallback
  return text.length > 220 ? `${text.slice(0, 217).trim()}…` : text
}

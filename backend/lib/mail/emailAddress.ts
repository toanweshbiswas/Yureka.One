const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Fix common typos (gmail,com) and return a sendable address, or empty if still invalid. */
export function normalizeEmail(raw: string): string {
  let value = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')

  const at = value.lastIndexOf('@')
  if (at > 0) {
    const local = value.slice(0, at)
    let domain = value.slice(at + 1)
    domain = domain.replace(/,/g, '.').replace(/\.{2,}/g, '.').replace(/^\.+|\.+$/g, '')
    value = `${local}@${domain}`
  }

  return EMAIL_RE.test(value) ? value : ''
}

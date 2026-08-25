/** UA helpers shared by PWA presence (no DOM). */

export function isIosDeviceUa(ua: string): boolean {
  return /iPad|iPhone|iPod/i.test(ua || '')
}

export function isAndroidDeviceUa(ua: string): boolean {
  const s = ua || ''
  if (/Android/i.test(s)) return true
  if (/Linux/i.test(s) && /Mobile|wv\)/i.test(s) && !isIosDeviceUa(s)) return true
  return false
}

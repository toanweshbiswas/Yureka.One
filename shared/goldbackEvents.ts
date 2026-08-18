/** Cross-tab / keep-alive events for Goldback balance sync */

export const GOLDBACK_UPDATED = 'yureka:goldback-updated'

export type GoldbackUpdatedDetail = {
  balancePaise?: number
  userId?: string
}

export function notifyGoldbackUpdated(detail: GoldbackUpdatedDetail = {}) {
  try {
    window.dispatchEvent(new CustomEvent(GOLDBACK_UPDATED, { detail }))
  } catch {
    /* ignore */
  }
}

export function onGoldbackUpdated(handler: (detail: GoldbackUpdatedDetail) => void) {
  const fn = (e: Event) => handler((e as CustomEvent<GoldbackUpdatedDetail>).detail || {})
  window.addEventListener(GOLDBACK_UPDATED, fn)
  return () => window.removeEventListener(GOLDBACK_UPDATED, fn)
}

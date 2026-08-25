import { cacheInvalidate } from '@shared/dashboardCache'

export const CATALOG_EVENT = 'yureka:catalog'

type RevisionPayload = { revision: number; updatedAt: string }

const STORAGE_KEY = 'yureka:catalog-revision'
// Was 8s — too chatty on mobile (cache bust + refetch storms). Admin edits are rare.
const POLL_MS = 60_000

let started = false
let lastRevision: number | null = null
let pollTimer: ReturnType<typeof setInterval> | null = null

function readStoredRevision(): number | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const n = Number(raw)
    return Number.isFinite(n) ? n : null
  } catch {
    return null
  }
}

function writeStoredRevision(n: number) {
  try {
    sessionStorage.setItem(STORAGE_KEY, String(n))
  } catch {
    /* ignore */
  }
}

async function fetchRevision(): Promise<RevisionPayload | null> {
  try {
    const res = await fetch('/api/catalog/revision', { cache: 'no-store' })
    if (!res.ok) return null
    const json = (await res.json()) as { data?: RevisionPayload }
    if (!json.data || typeof json.data.revision !== 'number') return null
    return json.data
  } catch {
    return null
  }
}

function notifyCatalogChanged(revision: number) {
  // Drop stale dashboard caches so remounts / reloads don't show admin-old data.
  cacheInvalidate('offers:')
  cacheInvalidate('goldback')
  cacheInvalidate('gift')
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(CATALOG_EVENT, { detail: { revision } }),
    )
  }
}

async function checkOnce(forceNotify = false) {
  const snap = await fetchRevision()
  if (!snap) return
  const prev = lastRevision ?? readStoredRevision()
  lastRevision = snap.revision
  writeStoredRevision(snap.revision)
  if (forceNotify || (prev != null && prev !== snap.revision)) {
    notifyCatalogChanged(snap.revision)
  }
}

function startPolling() {
  if (pollTimer) return
  pollTimer = setInterval(() => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
    void checkOnce(false)
  }, POLL_MS)
}

function stopPolling() {
  if (!pollTimer) return
  clearInterval(pollTimer)
  pollTimer = null
}

/**
 * Start watching admin catalog revisions. Safe to call once from DashboardLayout.
 * Fires `yureka:catalog` when Super Browse / offers (etc.) change.
 */
export function startCatalogSync() {
  if (typeof window === 'undefined' || started) return () => {}
  started = true
  lastRevision = readStoredRevision()

  void checkOnce(false)
  startPolling()

  const onVisible = () => {
    if (document.visibilityState === 'visible') {
      void checkOnce(false)
      startPolling()
    } else {
      stopPolling()
    }
  }
  const onFocus = () => {
    void checkOnce(false)
  }

  document.addEventListener('visibilitychange', onVisible)
  window.addEventListener('focus', onFocus)

  return () => {
    started = false
    stopPolling()
    document.removeEventListener('visibilitychange', onVisible)
    window.removeEventListener('focus', onFocus)
  }
}

/** React-friendly: run `onUpdate` whenever the catalog revision changes. */
export function onCatalogUpdate(onUpdate: (revision: number) => void) {
  if (typeof window === 'undefined') return () => {}
  const handler = (e: Event) => {
    const detail = (e as CustomEvent<{ revision: number }>).detail
    onUpdate(detail?.revision ?? Date.now())
  }
  window.addEventListener(CATALOG_EVENT, handler)
  return () => window.removeEventListener(CATALOG_EVENT, handler)
}

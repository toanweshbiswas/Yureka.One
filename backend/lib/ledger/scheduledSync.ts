import { listDueLedgerConnections } from './connections.js'
import { runBackgroundLedgerSync } from './scanService.js'
import { resolveLedgerUserId } from './cache.js'

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

export async function runScheduledLedgerSyncs(): Promise<{ attempted: number; ok: number }> {
  if (process.env.LEDGER_BACKGROUND_SYNC === 'false') {
    return { attempted: 0, ok: 0 }
  }

  const due = await listDueLedgerConnections({ minDaysSinceSync: 7, limit: 20 })
  let ok = 0

  for (const conn of due) {
    const authEmail = conn.gmail
    const userId =
      conn.userId ||
      (await resolveLedgerUserId({ authEmail, gmailEmail: conn.gmail })) ||
      conn.userId

    const success = await runBackgroundLedgerSync({
      userId,
      authEmail,
      gmail: conn.gmail,
      refreshToken: conn.refreshToken,
    })
    if (success) ok += 1
  }

  if (due.length) {
    console.log(`[ledger-sync] background complete: ${ok}/${due.length} ok`)
  }
  return { attempted: due.length, ok }
}

export function scheduleWeeklyLedgerSync(): void {
  if (process.env.LEDGER_BACKGROUND_SYNC === 'false') {
    console.log('[ledger-sync] background sync disabled (LEDGER_BACKGROUND_SYNC=false)')
    return
  }

  console.log('[ledger-sync] weekly background Gmail sync scheduled (checks hourly)')
  const tick = () => {
    void runScheduledLedgerSyncs().catch((err) => {
      console.error('[ledger-sync] scheduled run failed:', err)
    })
  }

  setTimeout(tick, 2 * 60_000)
  setInterval(tick, WEEK_MS)
}

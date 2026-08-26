import { readLedgerCache, writeLedgerCache, type LedgerStoreRecord } from './cache.js'
import {
  getLedgerConnection,
  getPrimaryLedgerConnection,
  markLedgerConnectionSync,
  saveLedgerConnection,
} from './connections.js'
import { exchangeGoogleAuthCode, refreshGoogleAccessToken } from './googleOAuth.js'
import { runGmailScanner } from './scannerRunner.js'
import type { ScanResult } from './types.js'
import { consumeLedgerResync, getLedgerResyncQuota } from './resyncQuota.js'

export type LedgerScanOptions = {
  userId: string
  authEmail: string
  accessToken?: string
  authCode?: string
  redirectUri?: string
  refreshToken?: string
  forceFull?: boolean
  persistScore?: boolean
  consumeQuota?: boolean
}

export type LedgerScanResult = {
  saved: LedgerStoreRecord
  score?: ScanResult['score']
  resyncQuota?: Awaited<ReturnType<typeof getLedgerResyncQuota>>
  error?: string
  details?: string
}

/** Compute Gmail newer_than window from last scan (overlap buffer included). */
export function computeSinceDays(scannedAt?: string | null, forceFull?: boolean): number | undefined {
  if (forceFull) return undefined
  if (!scannedAt) return undefined
  const parsed = Date.parse(scannedAt)
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined
  const days = Math.ceil((Date.now() - parsed) / 86_400_000) + 3
  return Math.min(Math.max(days, 7), 730)
}

async function resolveAccessToken(opts: LedgerScanOptions): Promise<string> {
  if (opts.accessToken?.trim()) return opts.accessToken.trim()

  if (opts.authCode?.trim()) {
    const exchanged = await exchangeGoogleAuthCode({
      code: opts.authCode.trim(),
      redirectUri: opts.redirectUri,
    })
    if (exchanged.refreshToken) {
      await saveLedgerConnection({
        userId: opts.userId,
        gmail: opts.authEmail.trim().toLowerCase(),
        refreshToken: exchanged.refreshToken,
      })
    }
    return exchanged.accessToken
  }

  const refresh =
    opts.refreshToken ||
    (await getPrimaryLedgerConnection(opts.userId))?.refreshToken ||
    null
  if (!refresh) {
    throw new Error('AUTH_EXPIRED')
  }
  const refreshed = await refreshGoogleAccessToken(refresh)
  if (refreshed.refreshToken) {
    const conn = await getPrimaryLedgerConnection(opts.userId)
    if (conn) {
      await saveLedgerConnection({
        userId: opts.userId,
        gmail: conn.gmail,
        refreshToken: refreshed.refreshToken,
      })
    }
  }
  return refreshed.accessToken
}

export async function runLedgerScan(opts: LedgerScanOptions): Promise<LedgerScanResult> {
  const authEmail = opts.authEmail.trim().toLowerCase()

  if (opts.consumeQuota !== false) {
    const quota = await getLedgerResyncQuota(authEmail)
    if (!quota.allowed) {
      return {
        saved: { profile: {}, transactions: [] },
        resyncQuota: quota,
        error: 'RESYNC_LIMIT',
        details: `You can resync inbox ${quota.limit} times every ${quota.windowDays} days.`,
      }
    }
  }

  const existing = await readLedgerCache({ userId: opts.userId, authEmail })
  const sinceDays = computeSinceDays(existing.scannedAt, opts.forceFull)

  let accessToken: string
  try {
    accessToken = await resolveAccessToken(opts)
  } catch (e: any) {
    const msg = e?.message || 'AUTH_EXPIRED'
    return {
      saved: existing,
      error: msg === 'AUTH_EXPIRED' ? 'AUTH_EXPIRED' : msg,
      details: String(e?.message || e),
    }
  }

  const result = await runGmailScanner({
    accessToken,
    fallbackData: {
      email: authEmail,
      sinceDays,
      incremental: sinceDays != null,
    },
    mode: 'full',
    timeoutMs: 180_000,
  })

  if (result.error) {
    const isAuth =
      result.error === 'AUTH_EXPIRED' || String(result.error).includes('AUTH_EXPIRED')
    return {
      saved: existing,
      error: isAuth ? 'AUTH_EXPIRED' : result.error,
      details: result.details,
    }
  }

  const saved = await writeLedgerCache({ userId: opts.userId, authEmail, result })
  const gmail =
    String((saved.profile as any)?.email || '').trim().toLowerCase() || authEmail

  const conn = await getLedgerConnection(opts.userId, gmail)
  if (conn) {
    await markLedgerConnectionSync({ userId: opts.userId, gmail, error: null })
  }

  let scoreOut = saved.score || result.score || null
  if (opts.persistScore !== false && result.score && Number.isFinite(Number(result.score.score))) {
    const { persistScoreToWaitlist } = await import('../waitlist/score.js')
    const { refineYurekaScore } = await import('../waitlist/scoreRefine.js')
    try {
      const refined = await refineYurekaScore({
        ...(result.score as any),
        metrics: (result.score as any)?.metrics as Record<string, unknown>,
      })
      await persistScoreToWaitlist({
        email: authEmail,
        profile: saved.profile as { name?: string } | undefined,
        score: refined,
        notify: true,
        refine: false,
      })
      scoreOut = refined
    } catch (err) {
      console.error('[ledger-scan] persist score failed:', err)
    }
  }

  let resyncQuota = await getLedgerResyncQuota(authEmail)
  if (opts.consumeQuota !== false) {
    try {
      resyncQuota = await consumeLedgerResync(authEmail)
    } catch (err) {
      console.error('[ledger-scan] resync quota update failed:', err)
    }
  }

  return { saved, score: scoreOut, resyncQuota }
}

/** Background sync using stored refresh token (does not consume manual resync quota). */
export async function runBackgroundLedgerSync(opts: {
  userId: string
  authEmail: string
  gmail: string
  refreshToken: string
}): Promise<boolean> {
  try {
    const accessToken = (await refreshGoogleAccessToken(opts.refreshToken)).accessToken
    const existing = await readLedgerCache({
      userId: opts.userId,
      authEmail: opts.authEmail,
      gmail: opts.gmail,
    })
    const sinceDays = computeSinceDays(existing.scannedAt, false)

    const result = await runGmailScanner({
      accessToken,
      fallbackData: {
        email: opts.authEmail,
        sinceDays,
        incremental: sinceDays != null,
      },
      mode: 'full',
      timeoutMs: 180_000,
    })

    if (result.error) {
      await markLedgerConnectionSync({
        userId: opts.userId,
        gmail: opts.gmail,
        error: result.error,
      })
      return false
    }

    await writeLedgerCache({ userId: opts.userId, authEmail: opts.authEmail, result })
    await markLedgerConnectionSync({ userId: opts.userId, gmail: opts.gmail, error: null })
    return true
  } catch (e: any) {
    await markLedgerConnectionSync({
      userId: opts.userId,
      gmail: opts.gmail,
      error: e?.message || 'background sync failed',
    })
    return false
  }
}

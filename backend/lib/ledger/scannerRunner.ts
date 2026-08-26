import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { spawn } from 'child_process'
import { filterMarketingTransactions } from './marketingFilter.js'
import type { ScanResult } from './types.js'

export type { ScanResult } from './types.js'
export type { LedgerStoreRecord } from './cache.js'
export {
  readLedgerCache,
  writeLedgerCache,
  resolveLedgerUserId,
  ledgerCachePath,
  ledgerUserFilePath,
  legacyEmailFilePath,
} from './cache.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..', '..', '..')

function resolvePythonExecutable(): string {
  const candidates = [
    path.join(ROOT, 'venv', 'bin', 'python3'),
    path.join(process.cwd(), 'venv', 'bin', 'python3'),
    path.join(ROOT, 'venv', 'bin', 'python'),
    path.join(process.cwd(), 'venv', 'bin', 'python'),
  ]
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate
  }
  return 'python3'
}

export function runGmailScanner(opts: {
  accessToken: string
  fallbackData?: Record<string, unknown>
  mode?: 'full' | 'profile_only'
  timeoutMs?: number
}): Promise<ScanResult> {
  const { accessToken, fallbackData = {}, mode = 'full', timeoutMs = 180_000 } = opts
  const pythonExecutable = resolvePythonExecutable()
  const script = path.join(ROOT, 'backend', 'scripts', 'scanner.py')
  const args = [script, accessToken || '', JSON.stringify(fallbackData || {})]
  if (mode === 'profile_only') args.push('profile_only')

  return new Promise((resolve) => {
    const child = spawn(pythonExecutable, args, { cwd: ROOT })
    let output = ''
    let errorOutput = ''
    let settled = false

    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      try {
        child.kill('SIGKILL')
      } catch {
        // ignore
      }
      resolve({ error: `Gmail scan timed out after ${timeoutMs}ms` })
    }, timeoutMs)

    child.stdout.on('data', (d) => {
      output += d.toString()
    })
    child.stderr.on('data', (d) => {
      errorOutput += d.toString()
    })
    child.on('error', (err) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve({ error: err.message || 'Failed to start scanner' })
    })
    child.on('close', (code) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (code !== 0) {
        console.error('[ledger] scanner exit', code, errorOutput.slice(0, 500))
        resolve({
          error: 'Deep scanner script failed to execute',
          details: errorOutput.slice(0, 2000),
        })
        return
      }
      try {
        const result = JSON.parse(output.trim()) as ScanResult
        resolve({
          ...result,
          transactions: filterMarketingTransactions(result.transactions),
        })
      } catch (e: any) {
        console.error('[ledger] invalid scanner JSON', e?.message, output.slice(0, 300))
        resolve({ error: 'Invalid JSON output from deep scanner script', details: output.slice(0, 500) })
      }
    })
  })
}

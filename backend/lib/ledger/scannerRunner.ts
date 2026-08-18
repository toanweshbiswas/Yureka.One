import fs from 'fs'
import fsp from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { spawn } from 'child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..', '..', '..')

export type ScanResult = {
  profile?: Record<string, unknown>
  transactions?: Array<Record<string, unknown>>
  score?: { score?: number; decision?: string; metrics?: unknown }
  error?: string
  details?: string
}

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

function safeEmailKey(email: string) {
  return email
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._@+-]/g, '_')
    .slice(0, 180)
}

export function ledgerCachePath(email?: string | null) {
  const dir = path.join(ROOT, 'data', 'financial_cache')
  if (!email) return path.join(ROOT, 'data', 'financial_cache.json')
  return path.join(dir, `${safeEmailKey(email)}.json`)
}

export async function readLedgerCache(email?: string | null): Promise<ScanResult> {
  const paths = [
    email ? ledgerCachePath(email) : null,
    path.join(ROOT, 'data', 'financial_cache.json'),
  ].filter(Boolean) as string[]

  for (const p of paths) {
    try {
      const raw = await fsp.readFile(p, 'utf-8')
      const data = JSON.parse(raw) as ScanResult
      if (email) {
        const cachedEmail = String((data.profile as any)?.email || '').toLowerCase()
        if (cachedEmail && cachedEmail !== email.toLowerCase()) continue
      }
      return data
    } catch {
      // try next
    }
  }
  return { profile: {}, transactions: [] }
}

export async function writeLedgerCache(email: string | null | undefined, result: ScanResult) {
  const target = ledgerCachePath(email || String((result.profile as any)?.email || ''))
  await fsp.mkdir(path.dirname(target), { recursive: true })
  await fsp.writeFile(target, JSON.stringify(result, null, 2))
  // Keep legacy global cache for older clients.
  try {
    await fsp.writeFile(path.join(ROOT, 'data', 'financial_cache.json'), JSON.stringify(result, null, 2))
  } catch {
    // ignore
  }
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
        resolve(result)
      } catch (e: any) {
        console.error('[ledger] invalid scanner JSON', e?.message, output.slice(0, 300))
        resolve({ error: 'Invalid JSON output from deep scanner script', details: output.slice(0, 500) })
      }
    })
  })
}

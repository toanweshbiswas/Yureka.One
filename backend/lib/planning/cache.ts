import fs from 'fs'
import fsp from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import type { PlanningTransaction } from './types.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..')

function safeKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._@+-]/g, '_')
    .slice(0, 180)
}

export function planningCachePath(userId: string, gmail: string) {
  return path.join(ROOT, 'data', 'planning_cache', safeKey(userId), `${safeKey(gmail)}.json`)
}

export async function readPlanningCache(userId: string, gmail: string): Promise<PlanningTransaction[]> {
  try {
    const raw = await fsp.readFile(planningCachePath(userId, gmail), 'utf-8')
    const data = JSON.parse(raw) as { transactions?: PlanningTransaction[] }
    return Array.isArray(data.transactions) ? data.transactions : []
  } catch {
    return []
  }
}

export async function writePlanningCache(
  userId: string,
  gmail: string,
  transactions: PlanningTransaction[],
): Promise<void> {
  const target = planningCachePath(userId, gmail)
  await fsp.mkdir(path.dirname(target), { recursive: true })
  await fsp.writeFile(
    target,
    JSON.stringify(
      {
        gmail,
        userId,
        scannedAt: new Date().toISOString(),
        transactions,
      },
      null,
      2,
    ),
  )
}

export async function deletePlanningCache(userId: string, gmail: string): Promise<void> {
  const target = planningCachePath(userId, gmail)
  try {
    await fsp.unlink(target)
  } catch {
    // ignore
  }
}

export function planningCacheDirExists(userId: string) {
  return fs.existsSync(path.join(ROOT, 'data', 'planning_cache', safeKey(userId)))
}

import fs from 'fs'
import path from 'path'

export type RewardPointsCommissionConfig = {
  enabled: boolean
  /** Points credited per ₹100 of eligible spend (default earn rate). */
  pointsPerHundredInr: number
  /** Cap as % of order value (marketing “upto 30%”). */
  maxPercentOfOrder: number
  notes: string
  updatedAt: string
}

const DEFAULTS: RewardPointsCommissionConfig = {
  enabled: true,
  pointsPerHundredInr: 10,
  maxPercentOfOrder: 30,
  notes: '',
  updatedAt: new Date(0).toISOString(),
}

function filePath() {
  return path.join(process.cwd(), 'data', 'reward_points_commission.json')
}

function readFile(): RewardPointsCommissionConfig {
  try {
    const raw = fs.readFileSync(filePath(), 'utf8')
    const parsed = JSON.parse(raw) as Partial<RewardPointsCommissionConfig>
    return {
      enabled: parsed.enabled !== false,
      pointsPerHundredInr: Math.max(0, Number(parsed.pointsPerHundredInr) || DEFAULTS.pointsPerHundredInr),
      maxPercentOfOrder: Math.min(100, Math.max(0, Number(parsed.maxPercentOfOrder) || DEFAULTS.maxPercentOfOrder)),
      notes: String(parsed.notes || ''),
      updatedAt: String(parsed.updatedAt || DEFAULTS.updatedAt),
    }
  } catch {
    return { ...DEFAULTS }
  }
}

function writeFile(cfg: RewardPointsCommissionConfig) {
  const dir = path.dirname(filePath())
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(filePath(), JSON.stringify(cfg, null, 2))
}

export function getRewardPointsCommission(): RewardPointsCommissionConfig {
  return readFile()
}

export function saveRewardPointsCommission(
  patch: Partial<Omit<RewardPointsCommissionConfig, 'updatedAt'>>,
): RewardPointsCommissionConfig {
  const prev = readFile()
  const next: RewardPointsCommissionConfig = {
    enabled: patch.enabled !== undefined ? Boolean(patch.enabled) : prev.enabled,
    pointsPerHundredInr:
      patch.pointsPerHundredInr !== undefined
        ? Math.max(0, Math.round(Number(patch.pointsPerHundredInr)))
        : prev.pointsPerHundredInr,
    maxPercentOfOrder:
      patch.maxPercentOfOrder !== undefined
        ? Math.min(100, Math.max(0, Number(patch.maxPercentOfOrder)))
        : prev.maxPercentOfOrder,
    notes: patch.notes !== undefined ? String(patch.notes || '') : prev.notes,
    updatedAt: new Date().toISOString(),
  }
  writeFile(next)
  return next
}

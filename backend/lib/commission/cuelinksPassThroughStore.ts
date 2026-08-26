import fs from 'fs'
import path from 'path'

export type CueLinksPassThroughConfig = {
  /** Default % of CueLinks vendor payout credited as member Goldback. */
  memberSharePercent: number
  /** Optional override per CueLinks campaign id. */
  campaignOverrides: Record<string, number>
  notes: string
  updatedAt: string
}

const DEFAULTS: CueLinksPassThroughConfig = {
  memberSharePercent: 50,
  campaignOverrides: {},
  notes: '',
  updatedAt: new Date(0).toISOString(),
}

function filePath() {
  return path.join(process.cwd(), 'data', 'cuelinks_pass_through.json')
}

function clampPercent(n: number) {
  if (!Number.isFinite(n)) return 0
  return Math.min(100, Math.max(0, n))
}

function readFile(): CueLinksPassThroughConfig {
  try {
    const raw = fs.readFileSync(filePath(), 'utf8')
    const parsed = JSON.parse(raw) as Partial<CueLinksPassThroughConfig>
    const overrides: Record<string, number> = {}
    const src = parsed.campaignOverrides && typeof parsed.campaignOverrides === 'object' ? parsed.campaignOverrides : {}
    for (const [k, v] of Object.entries(src)) {
      const id = String(k).trim()
      if (!id) continue
      overrides[id] = clampPercent(Number(v))
    }
    return {
      memberSharePercent: clampPercent(Number(parsed.memberSharePercent ?? DEFAULTS.memberSharePercent)),
      campaignOverrides: overrides,
      notes: String(parsed.notes || ''),
      updatedAt: String(parsed.updatedAt || DEFAULTS.updatedAt),
    }
  } catch {
    return { ...DEFAULTS, campaignOverrides: {} }
  }
}

function writeFile(cfg: CueLinksPassThroughConfig) {
  const dir = path.dirname(filePath())
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(filePath(), JSON.stringify(cfg, null, 2))
}

export function getCueLinksPassThrough(): CueLinksPassThroughConfig {
  return readFile()
}

export function memberShareForCampaign(campaignId: string | number): number {
  const cfg = readFile()
  const key = String(campaignId)
  if (key && cfg.campaignOverrides[key] != null) return cfg.campaignOverrides[key]
  return cfg.memberSharePercent
}

export function saveCueLinksPassThrough(
  patch: Partial<Omit<CueLinksPassThroughConfig, 'updatedAt'>>,
): CueLinksPassThroughConfig {
  const prev = readFile()
  let overrides = { ...prev.campaignOverrides }
  if (patch.campaignOverrides && typeof patch.campaignOverrides === 'object') {
    overrides = {}
    for (const [k, v] of Object.entries(patch.campaignOverrides)) {
      const id = String(k).trim()
      if (!id) continue
      const n = Number(v)
      if (!Number.isFinite(n)) continue
      overrides[id] = clampPercent(n)
    }
  }
  const next: CueLinksPassThroughConfig = {
    memberSharePercent:
      patch.memberSharePercent !== undefined
        ? clampPercent(Number(patch.memberSharePercent))
        : prev.memberSharePercent,
    campaignOverrides: overrides,
    notes: patch.notes !== undefined ? String(patch.notes || '') : prev.notes,
    updatedAt: new Date().toISOString(),
  }
  writeFile(next)
  return next
}

/** Merge a single campaign override (null/undefined clears). */
export function setCampaignOverride(
  campaignId: string | number,
  percent: number | null | undefined,
): CueLinksPassThroughConfig {
  const prev = readFile()
  const key = String(campaignId).trim()
  if (!key) return prev
  const overrides = { ...prev.campaignOverrides }
  if (percent == null) {
    delete overrides[key]
  } else {
    overrides[key] = clampPercent(Number(percent))
  }
  return saveCueLinksPassThrough({ campaignOverrides: overrides })
}

import fs from 'fs'
import path from 'path'

type RevisionSnap = { revision: number; updatedAt: string }

function filePath() {
  return path.join(process.cwd(), 'data', 'catalog_revision.json')
}

function readSnap(): RevisionSnap {
  try {
    const raw = JSON.parse(fs.readFileSync(filePath(), 'utf-8')) as RevisionSnap
    if (typeof raw?.revision === 'number' && raw.revision >= 0) {
      return {
        revision: Math.floor(raw.revision),
        updatedAt: raw.updatedAt || new Date().toISOString(),
      }
    }
  } catch {
    /* seed */
  }
  return { revision: 1, updatedAt: new Date().toISOString() }
}

function writeSnap(snap: RevisionSnap) {
  const dest = filePath()
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.writeFileSync(dest, JSON.stringify(snap, null, 2))
}

/** Current catalog revision (Super Browse, Goldback offers, etc.). */
export function getCatalogRevision(): RevisionSnap {
  return readSnap()
}

/** Bump after any admin catalog mutation so member apps can refresh live. */
export function bumpCatalogRevision(reason?: string): RevisionSnap {
  const prev = readSnap()
  const next: RevisionSnap = {
    revision: prev.revision + 1,
    updatedAt: new Date().toISOString(),
  }
  writeSnap(next)
  if (reason) {
    console.info(`[catalog] revision ${next.revision} (${reason})`)
  }
  return next
}

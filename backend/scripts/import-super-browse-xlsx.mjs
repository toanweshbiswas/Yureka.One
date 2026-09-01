#!/usr/bin/env node
/**
 * Import Super Browse brands from the Hubble catalog spreadsheet.
 * Usage: node backend/scripts/import-super-browse-xlsx.mjs [path/to/Super Browse.xlsx]
 *
 * Writes shared/superBrowseCatalog.json (tracked). Logo URLs come from column 3;
 * website links in the sheet are often misaligned, so we validate and infer when needed.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { spawnSync } from 'child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '../..')
const DEFAULT_XLSX =
  '/Users/mainaksaha/Library/Containers/net.whatsapp.WhatsApp/Data/tmp/documents/83312F10-4B85-4F8F-B55B-B7096D3845B2/Super Browse.xlsx'
const OUT = path.join(ROOT, 'shared/superBrowseCatalog.json')

const SEED = [
  { id: 'amazon', name: 'Amazon', domain: 'amazon.in', url: 'https://www.amazon.in/ap/signin', cashback: '1%', bg: '#ffffff' },
  { id: 'flipkart', name: 'Flipkart', domain: 'flipkart.com', url: 'https://www.flipkart.com/', cashback: '2%', bg: '#2a55e6' },
  { id: 'myntra', name: 'Myntra', domain: 'myntra.com', url: 'https://www.myntra.com/', cashback: '4%', bg: '#ffffff' },
  { id: 'blinkit', name: 'Blinkit', domain: 'blinkit.com', url: 'https://blinkit.com/', cashback: '2%', bg: '#f8cb46' },
  { id: 'zepto', name: 'Zepto', domain: 'zeptonow.com', url: 'https://www.zeptonow.com/', cashback: '1%', bg: '#3b006a' },
  { id: 'instamart', name: 'Instamart', domain: 'swiggy.com', url: 'https://www.swiggy.com/instamart', bg: '#1b3c6e' },
  { id: 'ajio', name: 'Ajio', domain: 'ajio.com', url: 'https://www.ajio.com/', bg: '#2b2b2b' },
  { id: 'bms', name: 'BookMyShow', domain: 'bookmyshow.com', url: 'https://in.bookmyshow.com/', bg: '#c4242b' },
  { id: 'bigbasket', name: 'Bigbasket', domain: 'bigbasket.com', url: 'https://www.bigbasket.com/', cashback: '3%', bg: '#ffffff' },
  { id: 'meesho', name: 'Meesho', domain: 'meesho.com', url: 'https://www.meesho.com/', bg: '#4a1a5c' },
  { id: 'mmt', name: 'Makemytrip', domain: 'makemytrip.com', url: 'https://www.makemytrip.com/', bg: '#e31e24' },
  { id: 'jiomart', name: 'JioMart', domain: 'jiomart.com', url: 'https://www.jiomart.com/', cashback: '1%', bg: '#d71920' },
]

/** Exact xlsx name (normalized) -> seed id. Only skips duplicate when the name matches the seed label exactly. */
const SEED_BY_EXACT_NAME = new Map(SEED.map((s) => [normKey(s.name), s.id]))

const SLUG_DOMAIN = {
  'amazon-fresh': 'amazon.in',
  'amazon-shopping': 'amazon.in',
  'amazon-pay': 'amazon.in',
  'flipkart': 'flipkart.com',
  'myntra': 'myntra.com',
  'myntra-luxe': 'myntra.com',
  'blinkit': 'blinkit.com',
  'zepto': 'zeptonow.com',
  'swiggy-instamart': 'swiggy.com',
  'ajio': 'ajio.com',
  'ajio-luxe': 'ajio.com',
  'bookmyshow': 'bookmyshow.com',
  'bigbasket': 'bigbasket.com',
  'makemytrip': 'makemytrip.com',
  'makemytrip-bus': 'makemytrip.com',
  'makemytrip-hotel': 'makemytrip.com',
  'makemytrip-rail': 'makemytrip.com',
  'makemytrip-holidays': 'makemytrip.com',
  'meesho': 'meesho.com',
  'jiomart': 'jiomart.com',
  'uber': 'uber.com',
  'kfc': 'online.kfc.co.in',
  'levis': 'levi.in',
  'pantaloons': 'pantaloons.com',
  'behrouz-biryani': 'behrouzbiryani.com',
  'barbeque-nation': 'barbequenation.com',
  'google-play': 'play.google.com',
  'nykaa-man': 'nykaaman.com',
  'nykaa': 'nykaa.com',
  'jockey': 'jockey.in',
  'reliance-smart-bazaar': 'reliancesmartbazaar.com',
  'skechers': 'skechers.in',
  'wakefit': 'wakefit.co',
  'third-wave-coffee': 'thirdwavecoffeeroasters.com',
  'bath-body-works': 'bathandbodyworks.in',
  'chicago-pizza': 'chicagopizza.in',
  'resonate': 'resonate.co.in',
  'solid-square-logo-sfpg': 'litebite.in',
  'pegion': 'pigeon.in',
  'r-b': 'randbfashion.com',
  'lifestyle-online': 'lifestylestores.com',
}

function normKey(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function slugId(name) {
  return String(name || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64) || `store-${Date.now()}`
}

function domainFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./i, '')
  } catch {
    return String(url || '')
      .replace(/^https?:\/\//i, '')
      .split('/')[0]
      .replace(/^www\./i, '')
  }
}

function slugFromLogo(logoUrl) {
  const logo = String(logoUrl || '')
  const m = logo.match(/\/(\d+)-([a-z0-9-]+)-[a-z0-9]+\.(webp|png|jpg)/i)
  if (m) return m[2].toLowerCase()
  const m2 = logo.match(/\/([^/?#]+)\.(webp|png|jpg)/i)
  if (!m2) return ''
  return decodeURIComponent(m2[1])
    .toLowerCase()
    .replace(/solid\s+square\s+logo[_\s-]*/gi, '')
    .replace(/square[_\s-]*icon[_\s-]*/gi, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function urlMatchesBrand(name, url, logoUrl) {
  const n = normKey(name)
  const hostFull = normKey(domainFromUrl(url))
  const hostLabel = normKey(domainFromUrl(url).split('.')[0])

  if (hostLabel.length >= 3 && (hostLabel === n || hostLabel.includes(n) || n.includes(hostLabel))) {
    return true
  }

  const slugCompact = normKey(slugFromLogo(logoUrl))
  if (slugCompact.length >= 3 && hostFull.includes(slugCompact)) return true

  const parts = String(name).toLowerCase().match(/[a-z]{3,}/g) || []
  const hostRaw = domainFromUrl(url).toLowerCase()
  return parts.some((p) => hostRaw.includes(p))
}

function cleanBrandName(name) {
  return String(name || '')
    .replace(/\s*[-–]\s*luxe\s*gift\s*card/gi, '')
    .replace(/\s*luxe\s*gift\s*card/gi, '')
    .replace(/\s*gift\s*card/gi, '')
    .replace(/\s+luxe$/gi, '')
    .trim()
}

function toUrl(domain) {
  const d = String(domain || '').trim().replace(/^www\./i, '')
  if (!d) return 'https://www.example.com/'
  if (d.startsWith('http')) return d.endsWith('/') ? d : `${d}/`
  return `https://www.${d}/`
}

function resolveUrl(name, logoUrl, xlsxUrl) {
  const raw = String(xlsxUrl || '').trim()
  if (/^https?:\/\//i.test(raw)) {
    try {
      new URL(raw)
      // Trust the sheet when the URL plausibly matches the brand; infer only on clear mismatches.
      if (urlMatchesBrand(name, raw, logoUrl)) return raw
    } catch {
      /* fall through */
    }
  }
  return inferUrl(name, logoUrl, '')
}

function inferUrl(name, logoUrl, _xlsxUrl) {
  const slug = slugFromLogo(logoUrl)
  if (slug && SLUG_DOMAIN[slug]) return toUrl(SLUG_DOMAIN[slug])

  const cleaned = cleanBrandName(name)
  const nameSlug = slugId(cleaned)
  if (nameSlug && SLUG_DOMAIN[nameSlug]) return toUrl(SLUG_DOMAIN[nameSlug])

  const compact = (slug || nameSlug).replace(/-/g, '')
  if (compact.length >= 3) {
    return `https://www.${compact}.in/`
  }
  return `https://www.${nameSlug || 'example'}.com/`
}

function readXlsx(xlsxPath) {
  const py = `
import json, openpyxl, sys
path = sys.argv[1]
wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
ws = wb['Catalog']
rows = []
for r in ws.iter_rows(min_row=2, values_only=True):
    if not r or not r[0]:
        continue
    name = str(r[0]).strip()
    url = str(r[1] or '').strip()
    logo = str(r[2] or '').strip()
    rows.append({'name': name, 'url': url, 'logoUrl': logo})
wb.close()
print(json.dumps(rows))
`
  const res = spawnSync('python3', ['-c', py, xlsxPath], { encoding: 'utf-8', maxBuffer: 20 * 1024 * 1024 })
  if (res.status !== 0) {
    console.error(res.stderr || res.stdout)
    throw new Error('Failed to parse xlsx (is openpyxl installed?)')
  }
  return JSON.parse(res.stdout)
}

function buildCatalog(xlsxRows) {
  const now = new Date().toISOString()
  const stores = []
  const byId = new Map()
  const usedIds = new Set()

  for (const seed of SEED) {
    const row = {
      id: seed.id,
      name: seed.name,
      domain: seed.domain,
      url: seed.url,
      logoUrl: null,
      cashback: seed.cashback || null,
      bg: seed.bg,
      active: true,
      sortOrder: stores.length,
      createdAt: now,
      updatedAt: now,
    }
    stores.push(row)
    byId.set(seed.id, row)
    usedIds.add(seed.id)
  }

  let logoUpdates = 0
  let added = 0
  let skippedSeedDup = 0

  for (const item of xlsxRows) {
    const name = String(item.name || '').trim()
    const logoUrl = String(item.logoUrl || '').trim() || null
    if (!name) continue

    const aliasKey = normKey(name)
    const seedId = SEED_BY_EXACT_NAME.get(aliasKey)
    if (seedId && byId.has(seedId)) {
      const seedRow = byId.get(seedId)
      if (logoUrl) {
        seedRow.logoUrl = logoUrl
        logoUpdates++
      }
      skippedSeedDup++
      continue
    }

    let id = slugId(name)
    if (usedIds.has(id)) {
      let n = 2
      while (usedIds.has(`${id}-${n}`)) n++
      id = `${id}-${n}`
    }
    usedIds.add(id)

    const url = resolveUrl(name, logoUrl, item.url)
    const domain = domainFromUrl(url)

    stores.push({
      id,
      name,
      domain,
      url,
      logoUrl,
      cashback: null,
      bg: '#ffffff',
      active: true,
      sortOrder: stores.length,
      createdAt: now,
      updatedAt: now,
    })
    added++
  }

  // Seed rows without an exact xlsx name (e.g. Amazon) — borrow logo from closest variant.
  const LOGO_DONORS = {
    amazon: ['amazon shopping', 'amazon fresh', 'amazon pay', 'amazon prime'],
    meesho: ['meesho'],
    jiomart: ['jiomart', 'jiomart grocery'],
    instamart: ['swiggy instamart', 'instamart'],
    mmt: ['makemytrip'],
  }
  for (const [seedId, donors] of Object.entries(LOGO_DONORS)) {
    const seedRow = byId.get(seedId)
    if (!seedRow || seedRow.logoUrl) continue
    for (const donor of donors) {
      const match = xlsxRows.find((r) => normKey(r.name) === normKey(donor))
      if (match?.logoUrl) {
        seedRow.logoUrl = match.logoUrl
        logoUpdates++
        break
      }
    }
  }

  return { stores, stats: { logoUpdates, added, skippedSeedDup, total: stores.length } }
}

function main() {
  const xlsxPath = process.argv[2] || DEFAULT_XLSX
  if (!fs.existsSync(xlsxPath)) {
    console.error(`xlsx not found: ${xlsxPath}`)
    process.exit(1)
  }

  const rows = readXlsx(xlsxPath)
  const { stores, stats } = buildCatalog(rows)

  const payload = {
    importedAt: new Date().toISOString(),
    source: path.basename(xlsxPath),
    stores,
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`)

  const dataPath = path.join(ROOT, 'data/super_browse_stores.json')
  fs.mkdirSync(path.dirname(dataPath), { recursive: true })
  fs.writeFileSync(
    dataPath,
    `${JSON.stringify({ stores, seeded: true, catalogImportedAt: payload.importedAt }, null, 2)}\n`,
  )

  console.log(`Wrote ${stats.total} stores to ${OUT}`)
  console.log(`  seed logo updates: ${stats.logoUpdates}`)
  console.log(`  new brands added: ${stats.added}`)
  console.log(`  seed duplicates skipped: ${stats.skippedSeedDup}`)
}

main()

/**
 * Export CueLinks India campaigns in the same shape as Admin → CueLinks commissions.
 * Usage: node --env-file=.env --import tsx scripts/export-cuelinks-india-campaigns.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import {
  fetchCueLinksCampaigns,
  listCueLinksCampaigns,
} from '../backend/lib/cuelinks/campaigns.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const outDir = path.join(root, 'exports')

function formatRate(value, payoutType, currency = 'INR') {
  if (value == null) return '—'
  const pt = String(payoutType || '').toLowerCase()
  if (pt.includes('%') || pt.includes('percent') || pt.includes('sale(%)')) {
    return `${value}%`
  }
  if (pt.includes('click') || pt.includes('cpc')) {
    return `₹${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 4 })}`
  }
  if (currency === 'INR' || !currency) {
    return `₹${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
  }
  return `${value} ${currency}`
}

function flags(row) {
  const parts = []
  if (row.isPayPerClick) parts.push('CPC')
  if (row.newUserCommission != null) parts.push('New')
  if (row.existingUserCommission != null) parts.push('Existing')
  return parts.join(', ')
}

async function main() {
  console.log('Refreshing CueLinks campaigns (India filter from CUELINKS_INDIA_ONLY)…')
  const snap = await fetchCueLinksCampaigns({ force: true })
  const all = await listCueLinksCampaigns({ filter: 'all', limit: 100000 })
  const newExisting = await listCueLinksCampaigns({ filter: 'new_existing', limit: 100000 })
  const cpc = await listCueLinksCampaigns({ filter: 'cpc', limit: 100000 })

  const payload = {
    fetchedAt: new Date(snap.fetchedAt).toISOString(),
    catalogTotal: all.catalogTotal,
    newExistingTotal: all.newExistingTotal,
    payPerClickTotal: all.payPerClickTotal,
    indiaNote: 'Campaigns already India-filtered by backend (iso=IN / id=252, or no countries).',
    sheets: {
      // Default admin tab filter is "New / Existing"
      admin_new_existing: newExisting.items,
      admin_cpc: cpc.items,
      admin_all: all.items,
    },
  }

  fs.mkdirSync(outDir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16)
  const jsonPath = path.join(outDir, `cuelinks-india-admin-${stamp}.json`)
  fs.writeFileSync(jsonPath, JSON.stringify(payload))
  console.log(`JSON: ${jsonPath}`)
  console.log(
    `Catalog ${all.catalogTotal} · New/Existing ${newExisting.items.length} · CPC ${cpc.items.length} · All ${all.items.length}`,
  )
  console.log(JSON.stringify({ jsonPath, formatRateDemo: true }))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

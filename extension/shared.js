const DEFAULT_API = 'https://app.yureka.one'

const SKIP_HOSTS = new Set([
  'yureka.one',
  'www.yureka.one',
  'app.yureka.one',
  'admin.yureka.one',
  'brand.yureka.one',
  'localhost',
  '127.0.0.1',
])

function yurekaApiBase() {
  return DEFAULT_API
}

function yurekaAppUrl() {
  return DEFAULT_API
}

async function lookupSite(host) {
  const url = `${DEFAULT_API}/api/marketplace/site?host=${encodeURIComponent(host)}&limit=8`
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  const json = await res.json()
  if (!res.ok || json.error) throw new Error(json.error || `Lookup failed (${res.status})`)
  return json.data
}

function tabHost(url) {
  try {
    const u = new URL(url)
    if (u.protocol !== 'https:') return null
    const host = u.hostname.replace(/^www\./i, '').toLowerCase()
    if (SKIP_HOSTS.has(host) || host.endsWith('.yureka.one')) return null
    return host
  } catch {
    return null
  }
}

function offerCount(data) {
  if (!data) return 0
  const market = data.marketplaceTotal || (data.marketplace && data.marketplace.length) || 0
  const gold = (data.goldback && data.goldback.length) || 0
  return market + gold
}

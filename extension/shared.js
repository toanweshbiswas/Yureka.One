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

async function lookupGiftCardMatch(host, amount, productUrl) {
  const params = new URLSearchParams({ host })
  if (amount != null && Number.isFinite(amount) && amount > 0) {
    params.set('amount', String(Math.ceil(amount)))
  }
  if (productUrl) params.set('product', productUrl.slice(0, 500))
  const url = `${DEFAULT_API}/api/giftcards/match?${params.toString()}`
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  const json = await res.json()
  if (!res.ok || json.error) return null
  return json.data?.match || null
}

function formatInr(amount) {
  return `₹${Math.round(amount).toLocaleString('en-IN')}`
}

function offerCount(data) {
  if (!data) return 0
  const market = data.marketplaceTotal || (data.marketplace && data.marketplace.length) || 0
  const gold = (data.goldback && data.goldback.length) || 0
  return market + gold
}

/** Chrome Web Store / Affiliate Ads policy. consent before affiliate links. */
const AFFILIATE_CONSENT_KEY = 'yurekaAffiliateConsent'

function getAffiliateConsent() {
  return new Promise((resolve) => {
    try {
      chrome.storage.sync.get([AFFILIATE_CONSENT_KEY], (data) => {
        resolve(Boolean(data && data[AFFILIATE_CONSENT_KEY]))
      })
    } catch {
      resolve(false)
    }
  })
}

function setAffiliateConsent(accepted) {
  return new Promise((resolve) => {
    try {
      chrome.storage.sync.set({ [AFFILIATE_CONSENT_KEY]: Boolean(accepted) }, () => resolve())
    } catch {
      resolve()
    }
  })
}

const AFFILIATE_DISCLOSURE =
  'Affiliate disclosure: Some deal links are affiliate links (including CueLinks partner programs). If you click and buy, Yureka may earn a commission at no extra cost to you.'


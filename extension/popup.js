async function currentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  return tab
}

function el(id) {
  return document.getElementById(id)
}

function card({ href, merchant, title, code, reward, affiliate }) {
  const a = document.createElement('a')
  a.className = 'card'
  a.href = href
  a.target = '_blank'
  a.rel = 'noreferrer'
  a.innerHTML = `
    <div class="merchant"></div>
    <div class="title"></div>
    ${code ? '<div class="code"></div>' : ''}
    ${reward ? '<div class="reward"></div>' : ''}
    ${affiliate ? '<div class="aff-tag">Affiliate link</div>' : ''}
  `
  a.querySelector('.merchant').textContent = merchant || 'Store'
  a.querySelector('.title').textContent = title || 'Offer'
  if (code) a.querySelector('.code').textContent = code
  if (reward) a.querySelector('.reward').textContent = reward
  return a
}

async function showConsentGate(app) {
  el('consent').hidden = false
  el('main').hidden = true
  el('consent-app').href = `${app}/dashboard/offers?tab=marketplace`
  el('consent-accept').onclick = async () => {
    await setAffiliateConsent(true)
    el('consent').hidden = true
    el('main').hidden = false
    await loadDeals()
  }
}

async function loadDeals() {
  const tab = await currentTab()
  const app = yurekaAppUrl()
  el('open-app').href = `${app}/dashboard/offers?tab=marketplace`
  el('disclosure').textContent = AFFILIATE_DISCLOSURE

  const host = tabHost(tab?.url || '')
  if (!host) {
    el('host').textContent = 'Not a store page'
    el('status').textContent = 'Open a shopping site to see Yureka coupons.'
    return
  }

  el('host').textContent = host
  el('goldback').innerHTML = ''
  el('market').innerHTML = ''
  el('goldback').hidden = true
  el('market').hidden = true
  el('empty').hidden = true

  try {
    const data = await lookupSite(host)
    const market = data.marketplace || []
    const gold = data.goldback || []
    el('status').textContent =
      market.length || gold.length
        ? `${offerCount(data)} live deal${offerCount(data) === 1 ? '' : 's'} for this store.`
        : ''

    if (gold.length) {
      const box = el('goldback')
      box.hidden = false
      gold.forEach((o) => {
        box.appendChild(
          card({
            href: o.url,
            merchant: o.merchant,
            title: o.title,
            reward: o.rewardLabel || 'Goldback',
            affiliate: true,
          }),
        )
      })
    }
    if (market.length) {
      const box = el('market')
      box.hidden = false
      market.forEach((o) => {
        const href = o.affiliateUrl || o.url
        box.appendChild(
          card({
            href,
            merchant: o.merchant,
            title: o.title,
            code: o.couponCode,
            affiliate: Boolean(o.affiliateUrl),
          }),
        )
      })
    }
    if (!market.length && !gold.length) el('empty').hidden = false
  } catch (e) {
    el('status').textContent = e.message || 'Could not reach Yureka.'
  }
}

async function main() {
  const app = yurekaAppUrl()
  const consented = await getAffiliateConsent()
  if (!consented) {
    await showConsentGate(app)
    return
  }
  el('consent').hidden = true
  el('main').hidden = false
  await loadDeals()
}

void main()

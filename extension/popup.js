async function currentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  return tab
}

function el(id) {
  return document.getElementById(id)
}

function card({ href, merchant, title, code, reward }) {
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
  `
  a.querySelector('.merchant').textContent = merchant || 'Store'
  a.querySelector('.title').textContent = title || 'Offer'
  if (code) a.querySelector('.code').textContent = code
  if (reward) a.querySelector('.reward').textContent = reward
  return a
}

async function main() {
  const tab = await currentTab()
  const app = yurekaAppUrl()
  el('open-app').href = `${app}/dashboard/offers?tab=marketplace`

  const host = tabHost(tab?.url || '')
  if (!host) {
    el('host').textContent = 'Not a store page'
    el('status').textContent = 'Open a shopping site to see Yureka coupons.'
    return
  }

  el('host').textContent = host
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
          }),
        )
      })
    }
    if (market.length) {
      const box = el('market')
      box.hidden = false
      market.forEach((o) => {
        box.appendChild(
          card({
            href: o.affiliateUrl || o.url,
            merchant: o.merchant,
            title: o.title,
            code: o.couponCode,
          }),
        )
      })
    }
    if (!market.length && !gold.length) el('empty').hidden = false
  } catch (e) {
    el('status').textContent = e.message || 'Could not reach Yureka.'
  }
}

void main()

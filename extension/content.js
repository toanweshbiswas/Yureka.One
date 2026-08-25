const BAR_ID = 'yureka-extension-bar'
const HIDE_KEY = 'yureka-ext-hide'
const GIFT_HIDE_KEY = 'yureka-ext-gift-hide'

function removeBar() {
  document.getElementById(BAR_ID)?.remove()
}

function parseInr(text) {
  if (!text) return null
  const cleaned = String(text).replace(/,/g, '')
  const m = cleaned.match(/(?:₹|Rs\.?\s*|INR\s*)?(\d+(?:\.\d+)?)/i)
  if (!m) return null
  const n = Math.round(Number(m[1]))
  return Number.isFinite(n) && n >= 10 ? n : null
}

function isProductPage(host, pathname) {
  const path = pathname || location.pathname
  if (host.includes('amazon.')) return /\/dp\/|\/gp\/product\//.test(path)
  if (host.includes('flipkart.')) return /\/p\//.test(path) || /\/product\//.test(path)
  if (host.includes('myntra.')) return /\/buy\b/.test(path) || /\/[\w-]+\/buy\b/.test(path)
  if (host.includes('ajio.')) return /\/p\//.test(path)
  if (host.includes('nykaa.')) return /\/p\//.test(path) || /\/product\//.test(path)
  if (host.includes('meesho.')) return /\/p\//.test(path)
  return false
}

function scrapeProductPrice(host) {
  if (host.includes('amazon.')) {
    const selectors = [
      '#corePrice_feature_div .a-offscreen',
      '#corePriceDisplay_desktop_feature_div .a-offscreen',
      '.priceToPay .a-offscreen',
      '#tp_price_block_total_price_ww .a-offscreen',
      '#corePrice_mobile_feature_div .a-offscreen',
      '#priceblock_ourprice',
      '#priceblock_dealprice',
      '#priceblock_saleprice',
    ]
    for (const sel of selectors) {
      const el = document.querySelector(sel)
      const price = parseInr(el?.textContent || el?.innerText)
      if (price) return price
    }
  }

  if (host.includes('flipkart.')) {
    const selectors = ['._30BxA', '.Nx9bqj', '[class*="Price"]', 'div[class*="price"]']
    for (const sel of selectors) {
      const nodes = document.querySelectorAll(sel)
      for (const el of nodes) {
        const price = parseInr(el.textContent)
        if (price && price >= 50) return price
      }
    }
  }

  if (host.includes('myntra.')) {
    const selectors = ['.pdp-price strong', '.pdp-price', '[class*="pdp-price"] strong']
    for (const sel of selectors) {
      const el = document.querySelector(sel)
      const price = parseInr(el?.textContent)
      if (price) return price
    }
  }

  if (host.includes('ajio.') || host.includes('nykaa.')) {
    const selectors = ['[class*="price"]', '[data-test="product-price"]', '.prod-sp']
    for (const sel of selectors) {
      const nodes = document.querySelectorAll(sel)
      for (const el of nodes) {
        const price = parseInr(el.textContent)
        if (price && price >= 50) return price
      }
    }
  }

  return null
}

function showGiftCardBar(host, match, productPrice) {
  removeBar()
  if (!match?.checkoutUrl) return

  const amount = match.suggestedAmount || productPrice
  const savings = match.savingsInr
  const discount = match.discountPercentage
  let subtitle = amount
    ? `Buy ${formatInr(amount)} ${match.brand || match.title} gift card`
    : `${match.title} gift card available on Yureka`

  if (productPrice && amount && productPrice !== amount) {
    subtitle += ` · product ${formatInr(productPrice)}`
  }
  if (savings && savings > 0) {
    subtitle += ` · save ${formatInr(savings)}`
  } else if (discount && discount > 0) {
    subtitle += ` · ${discount}% off`
  }

  const bar = document.createElement('div')
  bar.id = BAR_ID
  bar.className = 'yureka-ext-gift'
  bar.innerHTML = `
    <div class="yureka-ext-copy">
      <strong>Pay with gift card</strong>
      <span>${subtitle}</span>
    </div>
    <a class="yureka-ext-cta" target="_blank" rel="noreferrer">Get card</a>
    <button type="button" class="yureka-ext-x" aria-label="Dismiss">×</button>
  `
  bar.querySelector('.yureka-ext-cta').href = match.checkoutUrl
  bar.querySelector('.yureka-ext-x').addEventListener('click', () => {
    sessionStorage.setItem(GIFT_HIDE_KEY, location.pathname)
    removeBar()
  })
  document.documentElement.appendChild(bar)
}

function showConsentBar() {
  removeBar()
  const bar = document.createElement('div')
  bar.id = BAR_ID
  bar.className = 'yureka-ext-consent'
  bar.innerHTML = `
    <div class="yureka-ext-copy">
      <strong>Yureka · Affiliate disclosure</strong>
      <span>Deal links may be affiliate links. We may earn a commission if you buy — no extra cost to you.</span>
    </div>
    <button type="button" class="yureka-ext-cta">Enable deals</button>
    <button type="button" class="yureka-ext-x" aria-label="Dismiss">×</button>
  `
  bar.querySelector('.yureka-ext-cta').addEventListener('click', async () => {
    await setAffiliateConsent(true)
    removeBar()
    await refreshBar()
  })
  bar.querySelector('.yureka-ext-x').addEventListener('click', () => {
    sessionStorage.setItem(HIDE_KEY, '1')
    removeBar()
  })
  document.documentElement.appendChild(bar)
}

function showDealsBar(host, data) {
  removeBar()
  const market = data?.marketplace || []
  const gold = data?.goldback || []
  const n = (data?.marketplaceTotal || market.length) + gold.length
  if (!n) return

  const first = gold[0] || market[0]
  const href = first?.affiliateUrl || first?.url || `${yurekaAppUrl()}/dashboard/offers`
  const isAffiliate = Boolean(first?.affiliateUrl) || Boolean(gold[0])
  const label = first?.couponCode
    ? `Code ${first.couponCode}`
    : first?.rewardLabel || (isAffiliate ? 'Open affiliate deal' : 'Open deal')

  const bar = document.createElement('div')
  bar.id = BAR_ID
  bar.innerHTML = `
    <div class="yureka-ext-copy">
      <strong>Yureka${isAffiliate ? ' · Affiliate' : ''}</strong>
      <span>${n} deal${n === 1 ? '' : 's'} on ${host}${isAffiliate ? ' · commission may apply' : ''}</span>
    </div>
    <a class="yureka-ext-cta" target="_blank" rel="noreferrer">${label}</a>
    <button type="button" class="yureka-ext-x" aria-label="Dismiss">×</button>
  `
  bar.querySelector('.yureka-ext-cta').href = href
  bar.querySelector('.yureka-ext-x').addEventListener('click', () => {
    sessionStorage.setItem(HIDE_KEY, '1')
    removeBar()
  })
  document.documentElement.appendChild(bar)
}

let refreshTimer = null
let lastPath = ''

async function refreshBar() {
  if (sessionStorage.getItem(HIDE_KEY)) return

  const host = tabHost(location.href)
  if (!host) {
    removeBar()
    return
  }

  const consented = await getAffiliateConsent()
  if (!consented) {
    // Gift-card tips do not use affiliate redirects — still allowed without consent.
    const onProduct = isProductPage(host, location.pathname)
    const giftHiddenForPath = sessionStorage.getItem(GIFT_HIDE_KEY) === location.pathname
    if (onProduct && !giftHiddenForPath) {
      const price = scrapeProductPrice(host)
      if (price) {
        try {
          const match = await lookupGiftCardMatch(host, price, location.href)
          if (match) {
            showGiftCardBar(host, match, price)
            return
          }
        } catch {
          /* fall through */
        }
      }
    }
    showConsentBar()
    return
  }

  const onProduct = isProductPage(host, location.pathname)
  const giftHiddenForPath = sessionStorage.getItem(GIFT_HIDE_KEY) === location.pathname

  if (onProduct && !giftHiddenForPath) {
    const price = scrapeProductPrice(host)
    if (price) {
      try {
        const match = await lookupGiftCardMatch(host, price, location.href)
        if (match) {
          showGiftCardBar(host, match, price)
          return
        }
      } catch {
        /* fall through to deals bar */
      }
    }
  }

  chrome.runtime.sendMessage({ type: 'YUREKA_LOOKUP', host }, (res) => {
    if (chrome.runtime.lastError || !res?.ok) return
    showDealsBar(host, res.data)
  })
}

function scheduleRefresh() {
  if (refreshTimer) clearTimeout(refreshTimer)
  refreshTimer = setTimeout(() => {
    refreshTimer = null
    void refreshBar()
  }, 450)
}

function watchNavigation() {
  const observer = new MutationObserver(() => {
    if (location.pathname !== lastPath) {
      lastPath = location.pathname
      scheduleRefresh()
      return
    }
    if (isProductPage(tabHost(location.href) || '', location.pathname)) {
      scheduleRefresh()
    }
  })
  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true })
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      observer.observe(document.body, { childList: true, subtree: true })
    })
  }
  window.addEventListener('popstate', scheduleRefresh)
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type !== 'YUREKA_SITE') return
  if (sessionStorage.getItem(HIDE_KEY)) return
  void (async () => {
    const consented = await getAffiliateConsent()
    if (!consented) {
      showConsentBar()
      return
    }
    const host = tabHost(location.href)
    if (!host) return
    if (isProductPage(host, location.pathname) && !sessionStorage.getItem(GIFT_HIDE_KEY)) return
    showDealsBar(msg.host, msg.data)
  })()
})

async function boot() {
  lastPath = location.pathname
  watchNavigation()
  await refreshBar()
}

void boot()

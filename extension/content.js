const BAR_ID = 'yureka-extension-bar'

function removeBar() {
  document.getElementById(BAR_ID)?.remove()
}

function showBar(host, data) {
  removeBar()
  const market = data?.marketplace || []
  const gold = data?.goldback || []
  const n = (data?.marketplaceTotal || market.length) + gold.length
  if (!n) return

  const first = gold[0] || market[0]
  const href = first?.affiliateUrl || first?.url || 'https://app.yureka.one/dashboard/offers'
  const label = first?.couponCode
    ? `Code ${first.couponCode}`
    : first?.rewardLabel || 'Open deal'

  const bar = document.createElement('div')
  bar.id = BAR_ID
  bar.innerHTML = `
    <div class="yureka-ext-copy">
      <strong>Yureka</strong>
      <span>${n} deal${n === 1 ? '' : 's'} on ${host}</span>
    </div>
    <a class="yureka-ext-cta" target="_blank" rel="noreferrer">${label}</a>
    <button type="button" class="yureka-ext-x" aria-label="Dismiss">×</button>
  `
  bar.querySelector('.yureka-ext-cta').href = href
  bar.querySelector('.yureka-ext-x').addEventListener('click', () => {
    sessionStorage.setItem('yureka-ext-hide', '1')
    removeBar()
  })
  document.documentElement.appendChild(bar)
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type !== 'YUREKA_SITE') return
  if (sessionStorage.getItem('yureka-ext-hide')) return
  showBar(msg.host, msg.data)
})

async function boot() {
  if (sessionStorage.getItem('yureka-ext-hide')) return
  const host = tabHost(location.href)
  if (!host) return
  chrome.runtime.sendMessage({ type: 'YUREKA_LOOKUP', host }, (res) => {
    if (chrome.runtime.lastError || !res?.ok) return
    showBar(host, res.data)
  })
}

void boot()

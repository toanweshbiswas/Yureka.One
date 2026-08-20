importScripts('shared.js')

const cache = new Map()

async function refreshTab(tabId, url) {
  const host = tabHost(url)
  if (!host) {
    await chrome.action.setBadgeText({ tabId, text: '' })
    return
  }
  let data
  try {
    data = await cachedLookup(host)
  } catch {
    await chrome.action.setBadgeText({ tabId, text: '' })
    return
  }
  const n = offerCount(data)
  await chrome.action.setBadgeBackgroundColor({ tabId, color: '#34d399' })
  try {
    await chrome.action.setBadgeTextColor({ tabId, color: '#0a0a0a' })
  } catch {
    /* older Chrome */
  }
  await chrome.action.setBadgeText({ tabId, text: n > 0 ? String(Math.min(n, 99)) : '' })
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'YUREKA_SITE', host, data })
  } catch {
    /* content script may not be ready */
  }
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    void refreshTab(tabId, tab.url)
  }
})

chrome.tabs.onActivated.addListener(async (active) => {
  const tab = await chrome.tabs.get(active.tabId)
  if (tab.url) void refreshTab(tab.id, tab.url)
})

async function cachedLookup(host) {
  const now = Date.now()
  const hit = cache.get(host)
  if (hit && now - hit.at < 5 * 60 * 1000) return hit.data
  const data = await lookupSite(host)
  cache.set(host, { at: now, data })
  return data
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'YUREKA_LOOKUP') {
    cachedLookup(msg.host)
      .then((data) => sendResponse({ ok: true, data }))
      .catch((e) => sendResponse({ ok: false, error: e.message }))
    return true
  }
})

# Yureka Chrome extension

Coupons and Goldback for the store you are shopping on. The extension talks to the public Yureka marketplace API — it does not embed CueLinks tokens.

## Load unpacked (Chrome)

1. Open `chrome://extensions`
2. Turn on **Developer mode**
3. **Load unpacked** → select this `extension/` folder
4. Pin **Yureka** in the toolbar

On Amazon, Flipkart, Myntra, and other stores you should see a deal count on the icon and a coupon bar on the page. Click a deal to open the affiliate / Goldback link.

Default API host is `https://app.yureka.one`. For local API, in DevTools on the extension service worker:

```js
chrome.storage.sync.set({ apiBase: 'http://localhost:3000' })
```

## What it does

- Looks up `/api/marketplace/site?host=` for the current tab
- Shows marketplace coupons + Goldback deals in the popup
- Injects a dismissible bar when deals exist
- Badge = number of live deals

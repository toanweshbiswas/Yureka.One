# Yureka Chrome extension

Coupons and Goldback for the store you are shopping on. The extension talks to the public Yureka marketplace API. it does not embed CueLinks tokens.

**Affiliate disclosure:** Some deal links are affiliate links (including CueLinks). If you click and buy, Yureka may earn a commission at no extra cost to you. Users must accept this in the popup (or tap **Enable deals** on the page bar) before affiliate links are shown.

See [STORE_LISTING.md](./STORE_LISTING.md) for Chrome Web Store copy (required for resubmission after Affiliate Ads policy rejection).

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
- Shows marketplace coupons + Goldback deals in the popup (after affiliate consent)
- Injects a dismissible bar when deals exist
- Badge = number of live deals

## Version

`1.0.3`. affiliate disclosure + consent gate for Chrome Web Store Affiliate Ads policy.

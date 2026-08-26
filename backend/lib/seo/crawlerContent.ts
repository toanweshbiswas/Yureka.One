import { faqQuestions } from '../faq'
import { brandCategoryFromSlug, brands, brandsCategorySeo } from '../../../landing/brandsData'

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const NAV = [
  ['Home', '/'],
  ['Gift cards', '/gift'],
  ['Brands', '/brands'],
  ['About', '/about'],
  ['FAQ', '/faq'],
  ['Contact', '/contact'],
  ['Yureka AI', '/yureka-ai'],
  ['Manifesto', '/manifesto'],
  ['Careers', '/jobs'],
  ['Blog', '/blog'],
  ['Security', '/security-protocol'],
]

function chrome(inner: string): string {
  const nav = NAV.map(([label, href]) => `<a href="${href}">${esc(label)}</a>`).join(' · ')
  return `<div id="crawler-content">
<nav aria-label="Primary">${nav}</nav>
${inner}
<footer>
  <p>Yureka.One. India's AI-native Wealth Operating System. Support: <a href="mailto:support@yureka.one">support@yureka.one</a></p>
  <p><a href="/privacy-policy">Privacy</a> · <a href="/terms-of-service">Terms</a> · <a href="/join-waitlist">Join waitlist</a></p>
</footer>
</div>`
}

function faqBlock(): string {
  const items = faqQuestions
    .map((f) => `<h2>${esc(f.q)}</h2><p>${esc(f.a)}</p>`)
    .join('\n')
  return `<section><h2>Frequently asked questions</h2>${items}</section>`
}

function howToBlock(): string {
  return `<section>
<h2>How Yureka turns spending into Goldback</h2>
<ol>
<li><strong>Capture</strong>. Consented parsing of shopping receipts and transaction signals (Gmail notifications, UPI messages).</li>
<li><strong>Score</strong>. A Power Shopper Score from 0 to 100 for financial health, shopping optimisation, and reliability.</li>
<li><strong>Optimise</strong>. Route the payment, apply the best reward path, and pay you in 24K digital gold (Yureka Goldback) at up to 16% effective ROI.</li>
</ol>
</section>`
}

export function crawlerContentHtml(pathname: string): string {
  const path = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname

  if (path === '/') {
    return chrome(`
<h1>Yureka.One. India's AI Wealth OS</h1>
<p>Yureka.One is India's first AI-native Wealth Operating System. It turns everyday spending into 24K digital gold (Yureka Goldback), uses an AI concierge to place food, grocery, and shopping orders, and builds an alternative credit profile from consented transaction data. Premium is ₹99/month or ₹1,199/year, reimbursed 100% as gold.</p>
${howToBlock()}
${faqBlock()}
`)
  }

  if (path === '/about') {
    return chrome(`
<h1>About Yureka.One</h1>
<p>Yureka.One is a Bengaluru fintech founded in 2026 by Anwesh Biswas and Mainak Saha. It builds a Wealth Operating System for India's power shoppers: capture spend, score it, and convert rewards into liquid 24K digital gold while creating RBI-aligned alternative credit profiles.</p>
<p>Founding team: <a href="https://www.linkedin.com/in/anweshbiswas/">Anwesh Biswas</a>, <a href="https://www.linkedin.com/in/mainaksaha08/">Mainak Saha</a>. The company ships a consumer app, Chrome extension, Yureka AI concierge, and partner checkout tools. Read the <a href="/manifesto">manifesto</a> or <a href="/contact">contact support</a>.</p>
`)
  }

  if (path === '/contact') {
    return chrome(`
<h1>Contact Yureka.One</h1>
<p>Email support at <a href="mailto:support@yureka.one">support@yureka.one</a>. We serve India. For press, partnerships, and careers, use the same address. Join the product via the <a href="/join-waitlist">waitlist</a>.</p>
`)
  }

  if (path === '/faq') {
    return chrome(`<h1>Yureka.One FAQ</h1>${faqBlock()}`)
  }

  const brandCat = path.match(/^\/brands\/([^/]+)$/)
  if (brandCat) {
    const name = brandCategoryFromSlug(brandCat[1])
    if (name) {
      const seo = brandsCategorySeo(name)
      const names = brands.filter((b) => b.image && b.categories.includes(name)).map((b) => b.name)
      const list = names.map((n) => `<li>${esc(n)}</li>`).join('')
      return chrome(`<h1>${esc(seo.title)}</h1><p>${esc(seo.description)}</p><ul>${list}</ul>`)
    }
  }

  if (path === '/brands') {
    return chrome(`<h1>Brand Explorer. 80+ partner brands</h1><p>Browse Yureka partner brands across shopping, travel, food, and lifestyle. See which cards maximize cashback and Goldback at each store.</p>`)
  }

  if (path === '/gift') {
    return chrome(`<h1>Send gift cards without signing up</h1><p>Buy and send brand gift cards securely on Yureka.One. Pick a brand, pay, and we email the voucher codes to your recipient. No Yureka account required.</p>`)
  }

  if (path === '/manifesto') {
    return chrome(`<h1>The Yureka Manifesto: Spend. Accumulate. Evolve.</h1><p>Yureka.One exists so India's power shoppers can treat every transaction as wealth-building. digital gold rewards and credit access, not expiring points.</p>`)
  }

  if (path === '/security-protocol') {
    return chrome(`<h1>Yureka.One Security Protocol</h1><p>Consent-first architecture: AES-256 encryption, Account Aggregator framework, and zero-knowledge transaction analysis aligned with DPDP and RBI digital lending mandates.</p>`)
  }

  if (path === '/jobs') {
    return chrome(`<h1>Careers at Yureka.One</h1><p>Help build India's AI-native Wealth Operating System in Bengaluru. Roles span engineering, AI, design, risk, and growth.</p>`)
  }

  if (path === '/yureka-ai') {
    return chrome(`<h1>Yureka AI. the shopping agent that orders and earns</h1><p>An AI concierge on Swiggy MCP that compares prices, picks the best-reward payment, places food and grocery orders, and pays you in Yureka Goldback.</p>`)
  }

  if (path === '/blog') {
    return chrome(`<h1>Yureka.One Blog. Goldback, AI shopping, and credit</h1><p>Guides on earning Goldback from everyday spending, ordering with AI, and building credit without a credit card.</p>`)
  }

  if (path === '/join-waitlist') {
    return chrome(`<h1>Join Yureka. earn gold on every order</h1><p>Get invite-gated access to Yureka.One. Earn Goldback, order via AI, and build credit automatically.</p>`)
  }

  return ''
}

export type SuperBrowseStore = {
  id: string
  name: string
  domain: string
  url: string
  cashback?: string
  bg: string
}

export const SUPER_BROWSE_STORES: SuperBrowseStore[] = [
  { id: 'amazon', name: 'Amazon', domain: 'amazon.in', url: 'https://www.amazon.in/', cashback: '1%', bg: '#ffffff' },
  { id: 'flipkart', name: 'Flipkart', domain: 'flipkart.com', url: 'https://www.flipkart.com/', cashback: '2%', bg: '#2a55e6' },
  { id: 'myntra', name: 'Myntra', domain: 'myntra.com', url: 'https://www.myntra.com/', cashback: '4%', bg: '#ffffff' },
  { id: 'blinkit', name: 'Blinkit', domain: 'blinkit.com', url: 'https://blinkit.com/', cashback: '2%', bg: '#f8cb46' },
  { id: 'zepto', name: 'Zepto', domain: 'zeptonow.com', url: 'https://www.zeptonow.com/', cashback: '1%', bg: '#3b006a' },
  { id: 'instamart', name: 'Instamart', domain: 'swiggy.com', url: 'https://www.swiggy.com/instamart', bg: '#1b3c6e' },
  { id: 'ajio', name: 'Ajio', domain: 'ajio.com', url: 'https://www.ajio.com/', bg: '#2b2b2b' },
  { id: 'bms', name: 'BookMyShow', domain: 'bookmyshow.com', url: 'https://in.bookmyshow.com/', bg: '#c4242b' },
  { id: 'bigbasket', name: 'Bigbasket', domain: 'bigbasket.com', url: 'https://www.bigbasket.com/', cashback: '3%', bg: '#ffffff' },
  { id: 'meesho', name: 'Meesho', domain: 'meesho.com', url: 'https://www.meesho.com/', bg: '#4a1a5c' },
  { id: 'mmt', name: 'Makemytrip', domain: 'makemytrip.com', url: 'https://www.makemytrip.com/', bg: '#e31e24' },
  { id: 'jiomart', name: 'JioMart', domain: 'jiomart.com', url: 'https://www.jiomart.com/', cashback: '1%', bg: '#d71920' },
]

const EMBED_HOST_SUFFIXES = [
  'amazon.in',
  'amazon.com',
  'flipkart.com',
  'myntra.com',
  'blinkit.com',
  'zeptonow.com',
  'swiggy.com',
  'ajio.com',
  'bookmyshow.com',
  'bigbasket.com',
  'meesho.com',
  'makemytrip.com',
  'goibibo.com',
  'airindia.com',
  'jiomart.com',
  'uber.com',
  'clnk.in',
  'cuelinks.com',
  'linksredirect.com',
]

export function isEmbedHostAllowed(host: string): boolean {
  const h = host.toLowerCase().replace(/^www\./, '').replace(/\.$/, '')
  return EMBED_HOST_SUFFIXES.some((suffix) => h === suffix || h.endsWith(`.${suffix}`))
}

export function storeLogo(domain: string) {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`
}

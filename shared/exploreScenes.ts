export type ExploreSceneId = 'rides' | 'qcommerce' | 'flights' | 'shopping' | 'giftcards' | 'spend'

export type ExploreBrand = {
  name: string
  domain: string
  aliases?: string[]
  embedUrl?: string
}

export type ExploreScene = {
  id: ExploreSceneId
  title: string
  subtitle: string
  badge?: string
  ribbon?: string
  size: 'hero' | 'tile'
  brands: ExploreBrand[]
  /** Extra tokens so gift cards / coupons in the same vertical still match. */
  giftNeedles?: string[]
  image: string
  imageClass?: string
  to: string
  giftTo?: string
  embed?: boolean
}

function sceneUrl(id: ExploreSceneId, tab: 'marketplace' | 'giftcards' | 'expenses') {
  if (tab === 'giftcards') return `/dashboard/giftcards?scene=${id}`
  if (tab === 'expenses') return '/dashboard/expenses'
  return `/dashboard/offers?tab=marketplace&scene=${id}`
}

export const EXPLORE_SCENES: ExploreScene[] = [
  {
    id: 'rides',
    title: 'Ride Compare & Book',
    subtitle: 'Book Uber without leaving Yureka',
    ribbon: 'IN APP',
    size: 'hero',
    embed: true,
    brands: [{ name: 'Uber', domain: 'uber.com', aliases: ['uber'], embedUrl: 'https://m.uber.com/' }],
    giftNeedles: ['ola', 'rapido', 'ride', 'cab', 'taxi'],
    image: '/assets/3dicons/map-pin.png',
    imageClass: 'w-[58%] right-[-8%] bottom-[-18%]',
    to: sceneUrl('rides', 'marketplace'),
    giftTo: sceneUrl('rides', 'giftcards'),
  },
  {
    id: 'flights',
    title: 'Flight Compare',
    subtitle: 'Goibibo, MakeMyTrip, and Air India in Yureka',
    ribbon: 'IN APP',
    size: 'hero',
    embed: true,
    brands: [
      { name: 'Goibibo', domain: 'goibibo.com', aliases: ['goibibo', 'go ibibo'], embedUrl: 'https://www.goibibo.com/' },
      { name: 'MakeMyTrip', domain: 'makemytrip.com', aliases: ['makemytrip', 'make my trip', 'mmt'], embedUrl: 'https://www.makemytrip.com/' },
      { name: 'Air India', domain: 'airindia.com', aliases: ['air india', 'airindia'], embedUrl: 'https://www.airindia.com/' },
    ],
    giftNeedles: [
      'travel', 'flight', 'airline', 'indigo', 'spicejet', 'airasia', 'cleartrip', 'yatra', 'ixigo', 'akasa',
    ],
    image: '/assets/3dicons/travel.png',
    imageClass: 'w-[70%] right-[-12%] bottom-[-22%]',
    to: sceneUrl('flights', 'marketplace'),
    giftTo: sceneUrl('flights', 'giftcards'),
  },
  {
    id: 'shopping',
    title: 'Shop India',
    subtitle: 'Amazon, Flipkart, and Myntra in Yureka',
    ribbon: 'IN APP',
    size: 'hero',
    embed: true,
    brands: [
      { name: 'Amazon', domain: 'amazon.in', aliases: ['amazon'], embedUrl: 'https://www.amazon.in/' },
      { name: 'Flipkart', domain: 'flipkart.com', aliases: ['flipkart'], embedUrl: 'https://www.flipkart.com/' },
      { name: 'Myntra', domain: 'myntra.com', aliases: ['myntra'], embedUrl: 'https://www.myntra.com/' },
    ],
    giftNeedles: [
      'shopping', 'fashion', 'ecommerce', 'ajio', 'nykaa', 'meesho', 'lifestyle', 'croma', 'reliance',
    ],
    image: '/assets/3dicons/bag.png',
    imageClass: 'w-[58%] right-[-8%] bottom-[-18%]',
    to: sceneUrl('shopping', 'marketplace'),
    giftTo: sceneUrl('shopping', 'giftcards'),
  },
  {
    id: 'qcommerce',
    title: 'Quick Commerce',
    subtitle: 'Blinkit and Zepto without leaving Yureka',
    badge: 'BETA',
    size: 'tile',
    embed: true,
    brands: [
      { name: 'Blinkit', domain: 'blinkit.com', aliases: ['blinkit', 'grofers'], embedUrl: 'https://blinkit.com/' },
      { name: 'Zepto', domain: 'zeptonow.com', aliases: ['zepto'], embedUrl: 'https://www.zeptonow.com/' },
    ],
    giftNeedles: ['grocery', 'instamart', 'swiggy', 'bigbasket', 'zepto', 'blinkit', 'grofers', 'jiomart'],
    image: '/assets/3dicons/flash.png',
    imageClass: 'w-[54%] right-[-10%] bottom-[-16%]',
    to: sceneUrl('qcommerce', 'marketplace'),
    giftTo: sceneUrl('qcommerce', 'giftcards'),
  },
  {
    id: 'giftcards',
    title: 'Gift Cards',
    subtitle: 'Gift cards across brands',
    badge: 'NEW',
    size: 'tile',
    brands: [
      { name: 'Amazon', domain: 'amazon.in', aliases: ['amazon'] },
      { name: 'Flipkart', domain: 'flipkart.com', aliases: ['flipkart'] },
      { name: 'Myntra', domain: 'myntra.com', aliases: ['myntra'] },
      { name: 'Uber', domain: 'uber.com', aliases: ['uber'] },
    ],
    image: '/assets/3dicons/gift.png',
    imageClass: 'w-[48%] right-[-6%] bottom-[-20%]',
    to: '/dashboard/giftcards',
  },
  {
    id: 'spend',
    title: 'Spend Lens',
    subtitle: 'Inbox spend, categories, and forecasts',
    size: 'tile',
    brands: [],
    image: '/assets/3dicons/chart.png',
    imageClass: 'w-[50%] right-[-8%] bottom-[-18%]',
    to: '/dashboard/planning',
  },
]

export function getExploreScene(id: string | null | undefined): ExploreScene | null {
  if (!id) return null
  return EXPLORE_SCENES.find((scene) => scene.id === id) || null
}

export function sceneBrandNames(scene: ExploreScene): string[] {
  return scene.brands.map((b) => b.name)
}

export function sceneMatchNeedles(scene: ExploreScene): string[] {
  const fromBrands = scene.brands.flatMap((b) => {
    const host = b.domain.replace(/^www\./i, '').replace(/\.[a-z.]+$/i, '')
    return [b.name, host, ...(b.aliases || [])]
  })
  return [...fromBrands, ...(scene.giftNeedles || [])]
}

export function matchesSceneBrands(text: string, scene: ExploreScene | null): boolean {
  if (!scene) return true
  const needles = sceneMatchNeedles(scene)
  if (!needles.length) return true
  const hay = String(text || '').toLowerCase()
  const compact = hay.replace(/[^a-z0-9]+/g, '')
  return needles.some((needle) => {
    const n = needle.toLowerCase().trim()
    if (!n) return false
    const nCompact = n.replace(/[^a-z0-9]+/g, '')
    if (nCompact.length < 2) return false
    return hay.includes(n) || (nCompact.length >= 3 && compact.includes(nCompact))
  })
}

export function brandFavicon(domain: string) {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`
}

export function sceneOpenPath(scene: ExploreScene) {
  return scene.to
}

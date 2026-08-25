
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
    subtitle: 'Uber rides and related deals',
    ribbon: 'OFFERS',
    size: 'hero',
    embed: true,
    brands: [{ name: 'Uber', domain: 'uber.com', aliases: ['uber'], embedUrl: 'https://www.uber.com/in/en/' }],
    giftNeedles: ['ola', 'rapido', 'uber', 'ride', 'rides', 'cab', 'taxi'],
    image: '/assets/3dicons/map-pin.png',
    imageClass: 'w-[58%] right-[-8%] bottom-[-18%]',
    to: sceneUrl('rides', 'marketplace'),
    giftTo: sceneUrl('rides', 'giftcards'),
  },
  {
    id: 'flights',
    title: 'Flight Compare',
    subtitle: 'Goibibo, MakeMyTrip, and Air India deals',
    ribbon: 'OFFERS',
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
    subtitle: 'Amazon, Flipkart, and Myntra deals',
    ribbon: 'OFFERS',
    size: 'hero',
    embed: true,
    brands: [
      { name: 'Amazon', domain: 'amazon.in', aliases: ['amazon'], embedUrl: 'https://www.amazon.in/ap/signin' },
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
    subtitle: 'Blinkit, Zepto, and grocery deals',
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

/** Whole-token match so short needles like "ride" / "ola" don't hit "bride" / "cola". */
function needleHitsHay(hay: string, needle: string): boolean {
  const n = needle.toLowerCase().trim()
  if (!n) return false
  const nCompact = n.replace(/[^a-z0-9]+/g, '')
  if (nCompact.length < 2) return false

  const escaped = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  // Word-ish boundary: start/end or non-alphanumeric around the needle.
  if (new RegExp(`(?:^|[^a-z0-9])${escaped}(?:[^a-z0-9]|$)`, 'i').test(hay)) {
    return true
  }

  // Compact (punctuation-stripped) match only for longer brand tokens — e.g. "makemytrip".
  // Short tokens must stay whole-word only (avoids ride⊂bride, ola⊂cola).
  if (nCompact.length < 5) return false
  const compact = hay.replace(/[^a-z0-9]+/g, '')
  return compact.includes(nCompact)
}

export function matchesSceneBrands(text: string, scene: ExploreScene | null): boolean {
  if (!scene) return true
  const needles = sceneMatchNeedles(scene)
  if (!needles.length) return true
  const hay = String(text || '').toLowerCase()
  return needles.some((needle) => needleHitsHay(hay, needle))
}

export function brandFavicon(domain: string) {
  const host = String(domain || '')
    .trim()
    .toLowerCase()
    .replace(/^www\./, '')
  if (!host) return ''
  return `https://icons.duckduckgo.com/ip3/${encodeURIComponent(host)}.ico`
}

export function sceneOpenPath(scene: ExploreScene) {
  return scene.to
}

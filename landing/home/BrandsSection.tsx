// Brand logos randomly sampled from the two flat asset folders
// (public/assets/brand-logos and public/assets/brand-logos-2). These logos
// ship on white or their own branded backgrounds rather than being pre-cut
// for a specific bubble color, so every badge sits on a clean white circle.

import { landingContainer, landingSection } from './landingLayout';

interface BrandEntry {
  name: string;
  image: string;
  bgColor: string;
  // Most logos use the default 'contain' (whole logo always inside the bubble).
  // Some source images bake a colored tile onto a white background, or place a
  // small logo in a large field of solid color. for those we 'cover' + scale
  // to crop the surrounding margin so the tile/logo fills the bubble.
  fit?: 'cover' | 'contain';
  scale?: number;
}

// bgColor is sampled from each logo's own background so full-bleed tiles
// blend into the bubble (no white patch) while the logo stays fully inside
// via object-contain (no cropping / leaking).
const ROW_1: BrandEntry[] = [
  { name: 'Crossword', image: '/assets/brand-logos-2/crossword-logo.png', bgColor: '#000000' },
  { name: 'Starbucks', image: '/assets/brand-logos/starbucks-logo.png', bgColor: '#ffffff' },
  { name: 'Himalaya', image: '/assets/brand-logos-2/himalaya-logo.png', bgColor: '#ffffff' },
  { name: 'Ixigo', image: '/assets/brand-logos-2/ixigo-logo.jpeg', bgColor: '#f0592a', fit: 'cover', scale: 1.15 },
  { name: 'Allen Solly', image: '/assets/brand-logos-2/allen-solly-logo.jpeg', bgColor: '#000000', fit: 'cover', scale: 1.5 },
  { name: 'Uber', image: '/assets/brand-logos-2/uber-logo.png', bgColor: '#000000', fit: 'cover', scale: 1.6 },
  { name: 'Salty', image: '/assets/brand-logos-2/salty-logo.jpeg', bgColor: '#7d46ac' },
  { name: 'Versace', image: '/assets/brand-logos/versace-logo.jpeg', bgColor: '#000000', fit: 'cover', scale: 1.2 },
  { name: 'Snitch', image: '/assets/brand-logos/snitch-logo.png', bgColor: '#000000' },
];

const ROW_2: BrandEntry[] = [
  { name: 'Ray-Ban', image: '/assets/brand-logos-2/ray-ban-logo.jpeg', bgColor: '#e41e2d' },
  { name: "McDonald's", image: '/assets/brand-logos/mcdonalds-logo.png', bgColor: '#e50103' },
  { name: 'The Man Company', image: '/assets/brand-logos-2/the-man-company-logo.png', bgColor: '#050807' },
  { name: 'PVR Cinemas', image: '/assets/brand-logos-2/pvr-cinemas-logo.png', bgColor: '#000000' },
  { name: 'Blinkit', image: '/assets/brand-logos-2/blinkit-logo.png', bgColor: '#f8cb46' },
  { name: 'Barbeque Nation', image: '/assets/brand-logos/barbeque-nation-logo.png', bgColor: '#f15922' },
  { name: 'Biba', image: '/assets/brand-logos-2/biba-logo.png', bgColor: '#b31b27' },
  { name: 'Croma', image: '/assets/brand-logos/croma-logo.jpeg', bgColor: '#4ca7a2' },
  { name: 'Philips', image: '/assets/brand-logos-2/philips-logo.png', bgColor: '#0b5ed8' },
];

const ROW_3: BrandEntry[] = [
  { name: 'Wow! Momo', image: '/assets/brand-logos-2/wow-momo-logo.jpeg', bgColor: '#f9d411', fit: 'cover', scale: 1.15 },
  { name: 'Fastrack', image: '/assets/brand-logos-2/fastrack-logo.jpeg', bgColor: '#f26426', fit: 'cover', scale: 1.18 },
  { name: 'Cleartrip', image: '/assets/brand-logos-2/cleartrip-logo.png', bgColor: '#ffffff' },
  { name: 'Chumbak', image: '/assets/brand-logos-2/chumbak-logo.jpeg', bgColor: '#8dada8' },
  { name: 'Milton', image: '/assets/brand-logos-2/milton-logo.jpeg', bgColor: '#ec2126', fit: 'cover', scale: 1.18 },
  { name: 'Tira', image: '/assets/brand-logos-2/tira-logo.jpeg', bgColor: '#f5d0c7' },
  { name: 'Lifestyle', image: '/assets/brand-logos-2/lifestyle-logo.jpg', bgColor: '#ffffff' },
  { name: 'boAt', image: '/assets/brand-logos-2/boat-logo.jpeg', bgColor: '#1d1d1b' },
  { name: 'Behrouz Biryani', image: '/assets/brand-logos-2/behrouz-biryani-logo.jpeg', bgColor: '#353336' },
];

const ROW_4: BrandEntry[] = [
  { name: 'Kalyan Jewellers', image: '/assets/brand-logos-2/kalyan-jewellers-logo.jpeg', bgColor: '#870a37' },
  { name: 'The Bear House', image: '/assets/brand-logos-2/the-bear-house-logo.png', bgColor: '#d95c47', fit: 'cover', scale: 1.2 },
  { name: 'Xbox', image: '/assets/brand-logos/xbox-logo.jpg', bgColor: '#0b0d09', fit: 'cover', scale: 1.4 },
  { name: 'Woodland', image: '/assets/brand-logos-2/woodland-logo.jpeg', bgColor: '#ffffff' },
  { name: 'Myntra', image: '/assets/brand-logos/myntra-logo.jpeg', bgColor: '#ffffff' },
  { name: 'Marriott', image: '/assets/brand-logos/marriott-logo.png', bgColor: '#ffffff' },
  { name: 'Manyavar', image: '/assets/brand-logos/manyavar-logo.jpeg', bgColor: '#e2792b' },
  { name: 'Ajio', image: '/assets/brand-logos/ajio-logo.jpeg', bgColor: '#243545' },
  { name: 'Westside', image: '/assets/brand-logos/westside-logo.png', bgColor: '#ffffff' },
];

function BrandBadge({ name, image, bgColor, fit = 'contain', scale = 1 }: BrandEntry) {
  const isCover = fit === 'cover';
  return (
    <div
      className={`flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 sm:h-24 sm:w-24 ${
        isCover ? '' : 'p-2 sm:p-2.5'
      }`}
      style={{ backgroundColor: bgColor }}
      title={name}
    >
      {/* Default 'contain' keeps the whole logo inside the bubble (never cropped
          or "leaking"), and the per-logo bgColor blends the logo's own
          background into the bubble so there's no white patch. 'cover' + scale
          is used for the few tiles whose art sits inside a margin we crop away. */}
      <img
        src={image}
        alt={name}
        loading="lazy"
        className={`h-full w-full ${isCover ? 'object-cover' : 'object-contain'}`}
        style={scale !== 1 ? { transform: `scale(${scale})` } : undefined}
      />
    </div>
  );
}

function MarqueeRow({
  items,
  duration,
  reverse,
}: {
  items: BrandEntry[];
  duration: number;
  reverse?: boolean;
}) {
  const doubled = [...items, ...items];
  return (
    <div className="flex w-full overflow-hidden">
      <div
        className="flex shrink-0 gap-4 sm:gap-6"
        style={{
          animation: `${reverse ? 'landing-marquee-reverse' : 'landing-marquee'} ${duration}s linear infinite`,
        }}
      >
        {doubled.map((brand, i) => (
          <BrandBadge key={`${brand.name}-${i}`} {...brand} />
        ))}
      </div>
    </div>
  );
}

export default function BrandsSection() {
  return (
    <section className={landingSection}>
      <div className={`${landingContainer} flex flex-col gap-4 sm:gap-6`}>
        <MarqueeRow items={ROW_1} duration={40} />
        <MarqueeRow items={ROW_2} duration={46} reverse />
      </div>

      <div className={`${landingContainer} my-16 text-center sm:my-20`}>
        <p
          className="text-[28px] font-extrabold leading-[1.2] text-landing-primary sm:text-[40px] font-sans"
        >
          Partnered with Over{' '}
          <span
            className="font-cooper text-[32px] sm:text-[46px] text-landing-primary"
          >
            700+ Brands
          </span>
        </p>
        <p
          className="mt-2 text-[24px] font-extrabold leading-[1.2] text-landing-primary sm:text-[36px] font-sans"
        >
          We are not stopping anytime soon
        </p>
      </div>

      <div className={`${landingContainer} flex flex-col gap-4 sm:gap-6`}>
        <MarqueeRow items={ROW_3} duration={44} />
        <MarqueeRow items={ROW_4} duration={50} reverse />
      </div>
    </section>
  );
}

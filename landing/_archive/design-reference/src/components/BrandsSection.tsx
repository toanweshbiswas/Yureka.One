// Placeholder brand badges -- text-based stand-ins, not recreations of the
// actual trademarked logos. Swap BrandBadge's contents for real logo
// images/SVGs when available.

const ROW_1 = [
  'PVR Cinemas',
  'Mango',
  'Lenskart',
  'Marriott',
  'Westside',
  'Taj',
  'Caratlane',
  'MyGlamm',
  'Cordelia Cruises',
];

const ROW_2 = [
  'Amazon',
  'BookMyShow',
  'Puma',
  'Ajio',
  'boAt',
  'Skullcandy',
  'Starbucks',
  'Superdry',
  'MakeMyTrip',
];

const ROW_3 = [
  'Blinkit',
  'Snitch',
  'ITC Hotels',
  'Cinepolis',
  'Philips',
  'Allen Solly',
  'Hamleys',
  'Daily Objects',
  'Hush Puppies',
];

const ROW_4 = [
  'Air India',
  'Woodland',
  'Nykaa',
  'Aldo',
  'Michael Kors',
  'District',
  'Miraggio',
  'Chumbak',
  'Crossword',
];

function BrandBadge({ name }: { name: string }) {
  return (
    <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 px-2 text-center sm:h-24 sm:w-24">
      <span
        style={{ fontFamily: 'Inter, sans-serif' }}
        className="text-[10px] font-semibold leading-tight text-white/80 sm:text-[11px]"
      >
        {name}
      </span>
    </div>
  );
}

function MarqueeRow({
  items,
  duration,
  reverse,
}: {
  items: string[];
  duration: number;
  reverse?: boolean;
}) {
  const doubled = [...items, ...items];
  return (
    <div className="flex w-full overflow-hidden">
      <div
        className="flex shrink-0 gap-4 sm:gap-6"
        style={{
          animation: `${reverse ? 'marquee-reverse' : 'marquee'} ${duration}s linear infinite`,
        }}
      >
        {doubled.map((name, i) => (
          <BrandBadge key={`${name}-${i}`} name={name} />
        ))}
      </div>
    </div>
  );
}

export default function BrandsSection() {
  return (
    <section className="relative w-full overflow-hidden bg-black py-20 sm:py-28">
      <div className="mx-auto flex w-full flex-col gap-4 sm:gap-6 md:max-w-[60vw]">
        <MarqueeRow items={ROW_1} duration={40} />
        <MarqueeRow items={ROW_2} duration={46} reverse />
      </div>

      <div className="mx-auto my-16 max-w-4xl px-6 text-center sm:my-20 md:max-w-[60vw]">
        <p
          style={{ fontFamily: 'Inter, sans-serif' }}
          className="text-[28px] font-extrabold leading-[1.2] text-white sm:text-[40px]"
        >
          Partnered with Over{' '}
          <span
            style={{ fontFamily: '"Playfair Display", serif' }}
            className="italic font-semibold text-[#5fae52]"
          >
            700+ Brands
          </span>
        </p>
        <p
          style={{ fontFamily: 'Inter, sans-serif' }}
          className="mt-2 text-[24px] font-extrabold leading-[1.2] text-white sm:text-[36px]"
        >
          We are not stopping anytime soon
        </p>
      </div>

      <div className="mx-auto flex w-full flex-col gap-4 sm:gap-6 md:max-w-[60vw]">
        <MarqueeRow items={ROW_3} duration={44} />
        <MarqueeRow items={ROW_4} duration={50} reverse />
      </div>
    </section>
  );
}

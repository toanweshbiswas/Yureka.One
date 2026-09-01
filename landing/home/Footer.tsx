import JoinWaitlistButton from './JoinWaitlistButton';
import YurekaBrandMark from '@shared/YurekaBrandMark';
import { landingBody, landingCaption, landingContainer, landingLink } from './landingLayout';

const HERO_BG_URL = '/hero-bg.jpg';

export default function Footer() {
  return (
    <footer className="relative w-full overflow-hidden bg-landing-bg">
      <div className={`flex min-h-[400px] flex-col md:flex-row ${landingContainer}`}>
        <div className="h-[300px] w-full md:h-auto md:w-1/2">
          <div className="relative h-full w-full overflow-hidden rounded-2xl border border-white/20 shadow-2xl shadow-black/40 backdrop-blur-xl">
            <img
              src={HERO_BG_URL}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover"
            />

            {/* Glass sheen: a soft diagonal highlight band, like light
                catching a curved glass surface. */}
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  'linear-gradient(115deg, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0.08) 18%, rgba(255,255,255,0) 32%, rgba(255,255,255,0) 68%, rgba(255,255,255,0.12) 82%, rgba(255,255,255,0) 100%)',
                mixBlendMode: 'overlay',
              }}
            />
            <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/25" />
          </div>
        </div>

        <div className="flex w-full flex-col justify-between py-10 md:w-1/2 md:py-0 md:pl-10">
          <div>
            <div className="mb-8 flex items-center gap-2">
              <YurekaBrandMark className="h-6 w-6 rounded-[7px] object-cover" />
              <span className="text-[15px] font-medium tracking-tight text-landing-primary">
                Yureka
              </span>
            </div>
            <p className={`max-w-sm ${landingBody}`}>
              India&apos;s AI Wealth OS. Spend as usual. Earn 24K digital gold. Build credit from real transactions.
            </p>
            <div className={`mt-6 flex flex-wrap gap-x-4 gap-y-2 text-[13px] ${landingLink}`}>
              <a href="/about" className="hover:text-landing-primary">About</a>
              <a href="/gift" className="hover:text-landing-primary">Gift cards</a>
              <a href="/faq" className="hover:text-landing-primary">FAQ</a>
              <a href="/contact" className="hover:text-landing-primary">Contact</a>
              <a href="/brands" className="hover:text-landing-primary">Brands</a>
            </div>

            <JoinWaitlistButton className="mt-8" />
          </div>

          <p className={`mt-12 text-[12px] text-landing-muted`}>
            &copy; 2026 Yureka Labs. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

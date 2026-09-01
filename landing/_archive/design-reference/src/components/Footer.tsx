import YurekaLogo from './YurekaLogo';

const HERO_BG_URL = '/hero-bg.jpg';

export default function Footer() {
  return (
    <footer className="relative w-full overflow-hidden bg-black">
      <div className="flex min-h-[400px] flex-col md:mx-auto md:max-w-[60vw] md:flex-row">
        <div className="h-[300px] w-full p-6 md:h-auto md:w-1/2 md:p-8">
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

        <div className="flex w-full flex-col justify-between p-10 sm:p-16 md:w-1/2">
          <div>
            <div className="mb-8 flex items-center gap-2">
              <YurekaLogo className="h-[18px] w-[18px] text-white/70" />
              <span className="text-[15px] font-medium tracking-tight text-white/70">
                Yureka
              </span>
            </div>
            <p className="max-w-sm text-[14px] leading-relaxed text-white/40 sm:text-[15px]">
              The next evolution of human-machine interaction. Built for those who refuse to be
              limited by biology alone.
            </p>
          </div>

          <p className="mt-12 text-[12px] text-white/25">
            &copy; 2026 Yureka Labs. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

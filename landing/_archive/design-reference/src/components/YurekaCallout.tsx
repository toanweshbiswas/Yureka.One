const PRODUCT_LINKS = ['Chrome Extension', 'Yureka AI', 'Reward Stacking', 'UPI SDK (Future)'];
const COMPANY_LINKS = ['Manifesto', 'Careers', 'Design Lab', 'Press Kit'];
const RESOURCE_LINKS = ['Waitlist Status', 'Blogs', 'Privacy Policy', 'Terms of Service'];
const SOCIAL_ICONS = ['bi-instagram', 'bi-twitter-x', 'bi-chat', 'bi-link-45deg'];

function LinkColumn({ title, links }: { title: string; links: string[] }) {
  return (
    <div>
      <p
        style={{ fontFamily: '"Playfair Display", serif' }}
        className="text-[13px] italic font-semibold text-white/70"
      >
        {title}
      </p>
      <ul className="mt-5 space-y-4">
        {links.map((l) => (
          <li key={l}>
            <a
              href="#"
              style={{ fontFamily: 'Inter, sans-serif' }}
              className="text-[13px] text-white/50 transition-colors hover:text-white/80 sm:text-[14px]"
            >
              {l}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function YurekaCallout() {
  return (
    <section className="relative w-full bg-black px-6 py-16 sm:py-24">
      <div className="mx-auto w-full max-w-6xl md:max-w-[60vw]">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02] p-8 sm:p-12">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px"
            style={{ background: 'linear-gradient(90deg, transparent, #5fae52, transparent)' }}
          />

          <div className="flex flex-col gap-12 md:flex-row md:justify-between">
            <div className="max-w-xs">
              <div className="flex items-center gap-2">
                <i className="bi bi-play-fill text-[16px] text-white" />
                <span
                  style={{ fontFamily: 'Inter, sans-serif' }}
                  className="text-[16px] font-extrabold tracking-tight text-white"
                >
                  YUREKA
                </span>
              </div>
              <p
                style={{ fontFamily: 'Inter, sans-serif' }}
                className="mt-6 text-[13px] leading-relaxed text-white/50 sm:text-[14px]"
              >
                Building the rewards copilot for modern India. Earning smarter, redeeming better,
                and living richer.
              </p>
              <p className="mt-8 text-[11px] leading-relaxed tracking-wide text-white/40 sm:text-[12px]">
                SYSTEM STATUS:
                <br />
                WAITLIST ACTIVE //
                <br />
                LAUNCH PHASE 01
              </p>
            </div>

            <div className="hidden w-px self-stretch bg-white/10 md:block" />

            <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 sm:gap-12">
              <LinkColumn title="Product" links={PRODUCT_LINKS} />
              <LinkColumn title="Company" links={COMPANY_LINKS} />
              <LinkColumn title="Resources" links={RESOURCE_LINKS} />
            </div>
          </div>

          <div className="mt-12 flex flex-col items-start justify-between gap-6 border-t border-white/10 pt-8 sm:flex-row sm:items-center">
            <p className="text-[10px] tracking-wide text-white/40 sm:text-[11px]">
              DESIGNED AND DEVELOPED BY YUREKA LABS // &copy; 2026 YUREKA CO
            </p>
            <div className="flex items-center gap-3">
              {SOCIAL_ICONS.map((icon) => (
                <a
                  key={icon}
                  href="#"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-white/60 transition-colors hover:text-white"
                >
                  <i className={`bi ${icon} text-[14px]`} />
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

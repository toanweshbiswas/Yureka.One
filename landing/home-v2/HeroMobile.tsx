import { motion } from 'framer-motion';
import GlassLayer from './GlassLayer';
import JoinWaitlistButton from './JoinWaitlistButton';
import ScrollVideo from '@shared/ScrollVideo';

// Mobile-only stacked hero. Desktop uses HeroCinematic (pin scrub).
// Mounted only below `md` via MainPage.

const CINEMATIC_VIDEO_URL = '/rewards-desktop-final.mp4';
const REWARDS_VIDEO_URL = '/rewards.mp4';

function MobileVideo({
  src,
  fit = 'cover',
  className = '',
  eager = false,
}: {
  src: string;
  fit?: 'cover' | 'contain';
  className?: string;
  eager?: boolean;
}) {
  return (
    <div className={`relative ${className}`}>
      <ScrollVideo
        src={src}
        fit={fit}
        eager={eager}
        className="absolute inset-0 h-full w-full"
        rootMargin={eager ? '0px' : '320px 0px'}
      />
      <GlassLayer />
    </div>
  );
}

export default function HeroMobile() {
  return (
    <div className="w-full overflow-x-hidden bg-black">
      {/* Full-bleed first screen — no w-screen / negative margins (avoids iOS horizontal scroll) */}
      <section className="relative flex h-[100dvh] w-full flex-col items-center justify-center overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)',
            backgroundSize: '22px 22px',
            opacity: 0.05,
          }}
        />

        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div
            className="h-1/2 w-4/5 rounded-full"
            style={{
              background: 'radial-gradient(ellipse, rgba(95,174,82,0.08) 0%, transparent 70%)',
              filter: 'blur(60px)',
            }}
          />
        </div>

        <motion.p
          className="relative z-10 px-8 text-center font-bold uppercase leading-[1.9] tracking-[0.2em]"
          style={{
            fontSize: 'clamp(15px, 4.8vw, 22px)',
            color: '#5fae52',
            fontFamily: '"Space Mono", monospace',
            textShadow: '0 0 60px rgba(95, 174, 82, 0.4), 0 0 20px rgba(95, 174, 82, 0.2)',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ type: 'spring', bounce: 0, duration: 0.8, delay: 0.35 }}
        >
          The Wealthiest Few Know
          <br />
          Secrets That Most
          <br />
          Never Will_
        </motion.p>

        <div className="absolute bottom-10 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2 motion-reduce:hidden">
          <motion.div
            className="h-10 w-px origin-top bg-white/30"
            initial={{ scaleY: 0, opacity: 0 }}
            animate={{ scaleY: [0, 1, 1, 0], opacity: [0, 1, 1, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: 1.6 }}
          />
          <motion.span
            className="text-[10px] uppercase tracking-[0.3em] text-white/35"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ type: 'spring', bounce: 0, duration: 0.5, delay: 2 }}
          >
            Keep Scrolling
          </motion.span>
        </div>
      </section>

      <div className="px-5 pb-16 pt-4">
      <section className="relative">
        <div
          className="pointer-events-none absolute inset-0 -z-0"
          style={{
            backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)',
            backgroundSize: '22px 22px',
            opacity: 0.05,
          }}
        />
        <MobileVideo
          src={CINEMATIC_VIDEO_URL}
          eager
          className="relative z-10 mb-8 aspect-[4/3] w-full min-h-[220px] rounded-2xl border border-white/10"
        />
        <div className="relative z-10 flex flex-col gap-5">
          <h1 className="text-[clamp(44px,13vw,72px)] font-light leading-[0.95] tracking-[-0.03em] text-white">
            Never Buy
            <br />
            BullShit
          </h1>
          <p className="max-w-sm text-[14px] leading-relaxed text-white/60">
            Yureka helps you find the best product at the best price, all with the magic of AI
            that pops-up on top of your favourite shopping app. Yureka gives assured Digital Gold
            Back and Rewards for all your purchases.
            <br />
            Khachinnnggggg💰
          </p>
          <h2 className="text-[clamp(40px,12vw,64px)] font-light leading-[0.95] tracking-[-0.03em] text-white">
            AI
            <br />
            Yureka
          </h2>
        </div>
      </section>

      <section className="mt-20" style={{ fontFamily: 'Inter, sans-serif' }}>
        <div className="flex items-baseline gap-2">
          <span
            style={{ fontFamily: '"Playfair Display", serif' }}
            className="text-[28px] italic font-semibold text-[#5fae52]"
          >
            Meet
          </span>
          <span className="text-[28px] font-extrabold text-white">
            Yureka<span className="text-[#5fae52]">.</span>
          </span>
        </div>

        <JoinWaitlistButton className="mt-5" />

        <p className="mt-5 text-[15px] leading-relaxed text-white/90">
          Yureka offers you 360° Rewards and Saving ecosystem where you get more than 700+ brands
          to shop from. Every time you get assured digital gold and reward points. No Extra
          Investment, Earn when you Spend. No Aesterisk, Available round the clock 365 days.
          <br />
          We are bringing MAGIC to REALITY
        </p>

        <div className="mt-6 grid grid-cols-1 gap-4">
          <MobileVideo
            src={REWARDS_VIDEO_URL}
            className="min-h-[340px] rounded-2xl border border-white/10"
          />

          <div className="relative flex flex-col overflow-hidden rounded-2xl border border-white/20 bg-[#0a0a0a]/80 p-5">
            <h3 className="text-[18px] font-extrabold uppercase leading-tight text-white">
              Shop Across <span className="text-[#5fae52]">700+</span> Brands
            </h3>
            <div className="relative mt-4 h-44 w-full overflow-hidden rounded-2xl bg-[#141414]">
              <img
                src="/feat-card-gift.png"
                alt=""
                loading="lazy"
                className="h-full w-full object-cover"
              />
              <GlassLayer />
            </div>
            <ul className="mt-3 list-inside list-disc space-y-1 text-[13px] leading-relaxed text-white/60">
              <li>Quick Commerce</li>
              <li>Fashion &amp; Apparel</li>
              <li>Footwear</li>
              <li>Flights &amp; Hotels</li>
              <li>Medicines &amp; Treatments</li>
              <li>Everything that you need in your day to day life</li>
            </ul>
          </div>

          <div className="relative flex flex-col overflow-hidden rounded-2xl border border-white/20 bg-[#0a0a0a]/80 p-5">
            <h3
              style={{ fontFamily: '"Playfair Display", serif' }}
              className="text-[18px] italic font-semibold leading-tight text-[#5fae52]"
            >
              Not Just One Time Saving Or Cashback Or Reward Points
            </h3>
            <div className="relative mt-4 h-44 w-full overflow-hidden rounded-2xl bg-[#141414]">
              <img
                src="/card-calendar.png"
                alt=""
                loading="lazy"
                className="h-full w-full object-cover"
              />
              <GlassLayer />
            </div>
            <ul className="mt-3 list-inside list-disc space-y-1 text-[13px] leading-relaxed text-white/60">
              <li>24 Hours a Day</li>
              <li>7 Days a Week</li>
              <li>365 Days a Year</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="mt-20" style={{ fontFamily: 'Inter, sans-serif' }}>
        <p className="text-[12px] font-bold uppercase tracking-[0.2em] text-white">
          Yureka is your new age Ai backed SavingOs
        </p>
        <h2 className="mt-4 text-[40px] font-extrabold leading-[1.05] text-white">
          We Hate
          <br />
          <span
            style={{ fontFamily: '"Playfair Display", serif' }}
            className="italic font-semibold text-[#5fae52]"
          >
            Gatekeeping
          </span>
        </h2>
        <p className="mt-6 text-[15px] font-bold leading-relaxed text-white">
          Encash your reward points / Digital gold for new purchases, Gift Cards, Bill Discounts
          or directly to your Bank Account. Absolute zero gatekeeping.
          <br />
          If you are a #Power Shopper then Yureka is for you
        </p>
        <JoinWaitlistButton className="mt-8" />
        <MobileVideo
          src={REWARDS_VIDEO_URL}
          fit="contain"
          className="mt-6 min-h-[300px] rounded-2xl border border-white/10"
        />
      </section>

      <section className="mt-20">
        <MobileVideo
          src={CINEMATIC_VIDEO_URL}
          className="aspect-video w-full min-h-[200px] rounded-2xl border border-white/20"
        />
        <p className="mt-6 px-1 text-center font-sans text-[16px] leading-[1.5] tracking-[-0.01em] text-white/90">
          Experience the future of financial intelligence with Yureka, the premier AI-native
          Wealth Operating System built for India&apos;s digital economy. Yureka functions as a
          neural-AI interface that bridges the gap between daily consumer behavior and automated
          wealth accumulation. Whether you are seeking to maximize returns through gold-backed
          investments or build a high-fidelity alternative credit profile, Yureka filters out
          digital noise to deliver precision financial insights.
        </p>
      </section>
      </div>
    </div>
  );
}

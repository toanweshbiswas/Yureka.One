import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import JoinWaitlistButton from './JoinWaitlistButton';
import ScrambleIn from './ScrambleIn';
import GlassLayer from './GlassLayer';
import ScrollScrubVideo from './ScrollScrubVideo';
import { PhoneBubbleMockup } from './YurekaMockups';
import { landingBleed, landingBody, landingCaption, landingContainer } from './landingLayout';

// Touch / narrow: vault scrub → copy → one rewards scrub → cinematic in-view play.
// Avoid stacking many sticky scrub tracks (that was the mobile scroll failure).
const VAULT_VIDEO_URL = '/vault.mp4';
const CINEMATIC_VIDEO_URL = '/rewards-desktop-final.mp4';
const REWARDS_VIDEO_URL = '/rewards.mp4';

function InViewLoopVideo({
  src,
  poster,
  fit = 'cover',
}: {
  src: string;
  poster?: string;
  fit?: 'cover' | 'contain';
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        const on = entry.isIntersecting && entry.intersectionRatio > 0.35;
        setNear(on);
        if (on) {
          const p = el.play();
          if (p) p.catch(() => {});
        } else {
          el.pause();
        }
      },
      { threshold: [0, 0.35, 0.6] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      className="relative mx-auto w-full max-h-full overflow-hidden rounded-2xl border border-white/10 bg-landing-ink"
      style={{
        aspectRatio: '16 / 10',
        maxHeight: '100%',
        width: 'min(100%, calc((100dvh - 6rem - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px)) * 1.6))',
      }}
    >
      <video
        ref={ref}
        src={src}
        poster={poster}
        muted
        loop
        playsInline
        preload={near ? 'auto' : 'metadata'}
        className={`absolute inset-0 h-full w-full ${fit === 'cover' ? 'object-cover' : 'object-contain'}`}
      />
      <GlassLayer />
    </div>
  );
}

export default function HeroMobile({ entranceComplete = true }: { entranceComplete?: boolean }) {
  return (
    <div className="w-full bg-landing-bg">
      <section className={`relative ${landingBleed}`}>
        <ScrollScrubVideo
          src={VAULT_VIDEO_URL}
          poster="/vault-poster.jpg"
          eager
          startTime={2}
          trackVh={145}
          showScrollCue
        />
      </section>

      <div className={`${landingContainer} pb-12 pt-4`}>
        <section className="relative">
          <div className="flex flex-col gap-5">
            <h1 className="text-[clamp(44px,12vw,72px)] font-light leading-[0.95] tracking-[-0.03em] text-landing-sub">
              <ScrambleIn text="Never Buy" delay={120} triggered={entranceComplete} />
              <br />
              <ScrambleIn text="BullShit" delay={380} triggered={entranceComplete} />
            </h1>
            <p className="max-w-sm text-[15px] leading-relaxed text-landing-primary">
              Yureka helps you find the best product at the best price, all with the magic of AI
              that pops-up on top of your favourite shopping app. Yureka gives assured Digital Gold
              Back and Rewards for all your purchases.
              <br />
              Khachinnnggggg💰
            </p>
            <h2 className="text-[clamp(40px,11vw,64px)] font-light leading-[0.95] tracking-[-0.03em] text-landing-sub">
              <ScrambleIn text="AI" delay={560} triggered={entranceComplete} />
              <br />
              <ScrambleIn text="Yureka" delay={780} triggered={entranceComplete} />
            </h2>
          </div>
        </section>

        <section className="mt-16" style={{ fontFamily: 'Inter, sans-serif' }}>
          <div className="flex items-baseline gap-2">
            <span
              style={{ fontFamily: '"Playfair Display", serif' }}
              className="text-[28px] italic font-semibold text-landing-primary"
            >
              Meet
            </span>
            <span className="text-[28px] font-extrabold text-landing-primary">
              Yureka<span className="text-landing-primary">.</span>
            </span>
          </div>

          <JoinWaitlistButton className="mt-5" />

          <p className={`mt-5 ${landingBody}`}>
            Yureka offers you 360° Rewards and Saving ecosystem where you get more than 700+ brands
            to shop from. Every time you get assured digital gold and reward points. No Extra
            Investment, Earn when you Spend. No Asterisk, Available round the clock 365 days.
            <br />
            We are bringing MAGIC to REALITY
          </p>
        </section>

        <section className="mt-8">
          <div className="h-56 w-full">
            <PhoneBubbleMockup />
          </div>
        </section>
      </div>

      <section className={landingBleed}>
        <ScrollScrubVideo src={REWARDS_VIDEO_URL} trackVh={135} />
      </section>

      <div className={landingContainer}>
        <div className="mt-4 grid grid-cols-1 gap-4">
          <div className="relative flex flex-col overflow-hidden rounded-2xl border border-white/20 bg-landing-ink/80 p-5">
            <h3 className="text-[18px] font-extrabold uppercase leading-tight text-landing-primary">
              Shop Across <span className="text-landing-primary">700+</span> Brands
            </h3>
            <div className="relative mt-4 h-44 w-full overflow-hidden rounded-2xl bg-landing-ink">
              <img src="/feat-card-gift.png" alt="" loading="lazy" className="h-full w-full object-cover" />
              <GlassLayer />
            </div>
            <ul className={`mt-3 list-inside list-disc space-y-1 ${landingCaption}`}>
              <li>Quick Commerce</li>
              <li>Fashion &amp; Apparel</li>
              <li>Footwear</li>
              <li>Flights &amp; Hotels</li>
              <li>Medicines &amp; Treatments</li>
              <li>Everything that you need in your day to day life</li>
            </ul>
          </div>

          <div className="relative flex flex-col overflow-hidden rounded-2xl border border-white/20 bg-landing-ink/80 p-5">
            <h3
              style={{ fontFamily: '"Playfair Display", serif' }}
              className="text-[18px] italic font-semibold leading-tight text-landing-primary"
            >
              Not Just One Time Saving Or Cashback Or Reward Points
            </h3>
            <div className="relative mt-4 h-44 w-full overflow-hidden rounded-2xl bg-landing-ink">
              <img src="/card-calendar.png" alt="" loading="lazy" className="h-full w-full object-cover" />
              <GlassLayer />
            </div>
            <ul className={`mt-3 list-inside list-disc space-y-1 ${landingCaption}`}>
              <li>24 Hours a Day</li>
              <li>7 Days a Week</li>
              <li>365 Days a Year</li>
            </ul>
          </div>
        </div>
      </div>

      <div className={`${landingContainer} pt-16`} style={{ fontFamily: 'Inter, sans-serif' }}>
        <p className="text-[12px] font-bold uppercase tracking-[0.2em] text-landing-sub">
          Yureka is your new age Ai backed SavingOs
        </p>
        <h2 className="mt-4 text-[40px] font-extrabold leading-[1.05] text-landing-primary">
          We Hate
          <br />
          <span
            style={{ fontFamily: '"Playfair Display", serif' }}
            className="italic font-semibold text-landing-primary"
          >
            Gatekeeping
          </span>
        </h2>
        <p className="mt-6 text-[15px] font-bold leading-relaxed text-landing-sub">
          Encash your reward points / Digital gold for new purchases, Gift Cards, Bill Discounts or
          directly to your Bank Account. Absolute zero gatekeeping.
          <br />
          If you are a #Power Shopper then Yureka is for you
        </p>
        <JoinWaitlistButton className="mt-8 mb-6" />
      </div>

      <section className={`mt-4 ${landingBleed} pb-10`}>
        <InViewLoopVideo src={CINEMATIC_VIDEO_URL} />
        <motion.p
          className={`mt-6 px-2 text-center font-sans text-[16px] leading-[1.5] tracking-[-0.01em] ${landingBody}`}
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
        >
          Experience the future of financial intelligence with Yureka, the premier AI-native Wealth
          Operating System built for India&apos;s digital economy. Yureka functions as a neural-AI
          interface that bridges the gap between daily consumer behavior and automated wealth
          accumulation. Whether you are seeking to maximize returns through gold-backed investments
          or build a high-fidelity alternative credit profile, Yureka filters out digital noise to
          deliver precision financial insights.
        </motion.p>
      </section>
    </div>
  );
}

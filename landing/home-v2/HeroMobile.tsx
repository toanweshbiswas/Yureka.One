import { motion } from 'framer-motion';
import JoinWaitlistButton from './JoinWaitlistButton';
import ScrambleIn from './ScrambleIn';
import GlassLayer from './GlassLayer';
import ScrollScrubVideo from './ScrollScrubVideo';

// Touch / narrow: same story as HeroCinematic — scroll scrubs video time 1:1.
const VAULT_VIDEO_URL = '/vault.mp4';
const CINEMATIC_VIDEO_URL = '/rewards-desktop-final.mp4';
const REWARDS_VIDEO_URL = '/rewards.mp4';

export default function HeroMobile({ entranceComplete = true }: { entranceComplete?: boolean }) {
  return (
    <div className="w-full bg-black">
      <section className="relative px-4">
        <ScrollScrubVideo
          src={VAULT_VIDEO_URL}
          poster="/vault-poster.jpg"
          eager
          startTime={2}
          trackVh={170}
          showScrollCue
        />
      </section>

      <div className="px-5 pb-16 pt-4">
        <section className="relative">
          <div className="flex flex-col gap-5">
            <h1 className="text-[clamp(44px,12vw,72px)] font-light leading-[0.95] tracking-[-0.03em] text-white">
              <ScrambleIn text="Never Buy" delay={120} triggered={entranceComplete} />
              <br />
              <ScrambleIn text="BullShit" delay={380} triggered={entranceComplete} />
            </h1>
            <p className="max-w-sm text-[15px] leading-relaxed text-white/60">
              Yureka helps you find the best product at the best price, all with the magic of AI
              that pops-up on top of your favourite shopping app. Yureka gives assured Digital Gold
              Back and Rewards for all your purchases.
              <br />
              Khachinnnggggg💰
            </p>
            <h2 className="text-[clamp(40px,11vw,64px)] font-light leading-[0.95] tracking-[-0.03em] text-white">
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
        </section>
      </div>

      <section className="px-4">
        <ScrollScrubVideo src={REWARDS_VIDEO_URL} trackVh={165} />
      </section>

      <div className="px-5">
        <div className="mt-4 grid grid-cols-1 gap-4">
          <div className="relative flex flex-col overflow-hidden rounded-2xl border border-white/20 bg-[#0a0a0a]/80 p-5">
            <h3 className="text-[18px] font-extrabold uppercase leading-tight text-white">
              Shop Across <span className="text-[#5fae52]">700+</span> Brands
            </h3>
            <div className="relative mt-4 h-44 w-full overflow-hidden rounded-2xl bg-[#141414]">
              <img src="/feat-card-gift.png" alt="" loading="lazy" className="h-full w-full object-cover" />
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
              <img src="/card-calendar.png" alt="" loading="lazy" className="h-full w-full object-cover" />
              <GlassLayer />
            </div>
            <ul className="mt-3 list-inside list-disc space-y-1 text-[13px] leading-relaxed text-white/60">
              <li>24 Hours a Day</li>
              <li>7 Days a Week</li>
              <li>365 Days a Year</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="px-5 pt-16" style={{ fontFamily: 'Inter, sans-serif' }}>
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
          Encash your reward points / Digital gold for new purchases, Gift Cards, Bill Discounts or
          directly to your Bank Account. Absolute zero gatekeeping.
          <br />
          If you are a #Power Shopper then Yureka is for you
        </p>
        <JoinWaitlistButton className="mt-8 mb-6" />
      </div>

      <section className="px-4">
        <ScrollScrubVideo src={REWARDS_VIDEO_URL} fit="contain" trackVh={150} />
      </section>

      <section className="mt-8 px-4 pb-4">
        <ScrollScrubVideo src={CINEMATIC_VIDEO_URL} trackVh={150} />
        <p className="mt-6 px-2 text-center font-sans text-[16px] leading-[1.5] tracking-[-0.01em] text-white/90">
          Experience the future of financial intelligence with Yureka, the premier AI-native Wealth
          Operating System built for India&apos;s digital economy. Yureka functions as a neural-AI
          interface that bridges the gap between daily consumer behavior and automated wealth
          accumulation. Whether you are seeking to maximize returns through gold-backed investments
          or build a high-fidelity alternative credit profile, Yureka filters out digital noise to
          deliver precision financial insights.
        </p>
      </section>
    </div>
  );
}

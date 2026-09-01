import React, { useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform, MotionValue } from 'framer-motion';
import { ScrollytellingVideo } from './ScrollytellingVideo';

// ==========================================
// ANIMATION & LAYOUT CONFIGURATION
// ==========================================

const fadeUp = (delay: number) => ({
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-100px' },
  transition: { duration: 0.6, delay, ease: 'easeOut' as const },
});

// ==========================================
// SCROLL-LINKED PARAGRAPH REVEAL COMPONENTS
// ==========================================

interface WordRevealProps {
  word: string;
  index: number;
  totalWords: number;
  scrollYProgress: MotionValue<number>;
  isHighlight: boolean;
}

const WordReveal: React.FC<WordRevealProps> = ({
  word,
  index,
  totalWords,
  scrollYProgress,
  isHighlight,
}) => {
  const progress = index / totalWords;
  // Trigger stagger window
  const start = Math.max(0, progress - 0.15);
  const end = Math.min(1, progress + 0.05);
  const adjustedEnd = end <= start ? start + 0.01 : end;

  // Transition opacity from 0.15 to 1 on scroll
  const opacity = useTransform(scrollYProgress, [start, adjustedEnd], [0.15, 1]);

  return (
    <motion.span
      style={{ opacity }}
      className={`inline-block mr-[0.25em] whitespace-nowrap ${
        isHighlight ? 'text-white font-semibold' : 'text-neutral-400 font-normal'
      }`}
    >
      {word}
    </motion.span>
  );
};

interface ParagraphRevealProps {
  text: string;
  highlightWords?: string[];
  className?: string;
}

const ParagraphReveal: React.FC<ParagraphRevealProps> = ({
  text,
  highlightWords = [],
  className = '',
}) => {
  const containerRef = useRef<HTMLParagraphElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start 0.9', 'end 0.4'],
  });

  const words = text.split(' ');
  const totalWords = words.length;

  return (
    <p ref={containerRef} className={`flex flex-wrap justify-center text-center ${className}`}>
      {words.map((word, i) => {
        // Strip punctuation for matching
        const cleanWord = word.replace(/[.,\/#!$%\^&\*;:{}=\-_`~(). ]/g, '').toLowerCase();
        const isHighlight = highlightWords.includes(cleanWord);

        return (
          <WordReveal
            key={i}
            word={word}
            index={i}
            totalWords={totalWords}
            scrollYProgress={scrollYProgress}
            isHighlight={isHighlight}
          />
        );
      })}
    </p>
  );
};

// ==========================================
// MAIN STEPPER REPLACEMENT
// ==========================================

const HowItWorksStepper: React.FC = () => {
  return (
    <div className="w-full bg-black text-white font-sans flex flex-col items-center">
      {/* SECTION 2: HERO. scrollytelling video island */}
      <ScrollytellingVideo src="/assets/vault.mp4" />

      {/* SECTION 2B: HERO CONTENT. extracted from above video */}
      <section className="bg-black w-full py-24 px-6 flex flex-col items-center text-center">
        <div className="max-w-4xl mx-auto w-full flex flex-col items-center">
          {/* Avatar Row */}
          <motion.div
            {...fadeUp(0.1)}
            className="flex flex-col sm:flex-row items-center gap-4 mb-8"
          >
            <div className="flex -space-x-3">
              {[
                { name: 'avatar-1', unsplash: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80' },
                { name: 'avatar-2', unsplash: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&q=80' },
                { name: 'avatar-3', unsplash: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=100&q=80' },
              ].map((avatar, idx) => (
                <img
                  key={idx}
                  className="w-8 h-8 rounded-full border-2 border-black object-cover shrink-0"
                  src={`/${avatar.name}.png`}
                  onError={(e) => {
                    e.currentTarget.src = avatar.unsplash;
                  }}
                  alt={`User avatar ${idx + 1}`}
                />
              ))}
            </div>
            <span className="text-neutral-400 text-sm tracking-wide">
              7,000+ people already subscribed
            </span>
          </motion.div>

          {/* Heading */}
          <motion.h1
            {...fadeUp(0.3)}
            className="font-cirka text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-medium tracking-[-2px] leading-none mb-6 max-w-3xl"
          >
            Already <span className="font-serif italic font-normal">Excited</span>?
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            {...fadeUp(0.5)}
            className="font-overpass-mono text-neutral-200 text-base sm:text-lg max-w-xl mb-12 leading-relaxed"
          >
            Yureka is only exclusive to power-shoppers. If you are the one, you will get in.
            Or else hard luck.
          </motion.p>

          {/* Join Waitlist CTA */}
          <motion.div {...fadeUp(0.6)}>
            <Link
              to="/join-waitlist"
              className="bg-white text-black font-semibold text-xs rounded-full px-10 py-4 tracking-wider uppercase select-none transition-shadow hover:shadow-[0_0_20px_rgba(255,255,255,0.25)] inline-block"
            >
              JOIN WAITLIST
            </Link>
          </motion.div>
        </div>
      </section>


      {/* SECTION 3: "SEARCH HAS CHANGED" */}
      <section className="bg-black w-full py-32 px-6">
        <div className="max-w-6xl mx-auto w-full flex flex-col items-center">
          <motion.h2
            {...fadeUp(0.1)}
            className="font-cirka text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-medium tracking-tight text-center leading-none mb-6"
          >
            Rewards has <span className="font-serif italic font-normal">changed.</span> You will have too!
          </motion.h2>

          <motion.p
            {...fadeUp(0.2)}
            className="font-overpass-mono text-neutral-400 text-base sm:text-lg text-center max-w-2xl mb-24 leading-relaxed"
          >
            From LUXURY BRANDS to DAILY ESSENTIALS, We have got it all.
          </motion.p>

          {/* Platform Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-8 w-full mb-24">
            {[
              {
                title: 'Use Yureka for everyday SPENDS',
                desc: 'Using Yureka for everyday spends for atleast 6 Months would get you a 3D/4N Vacation, all for FREE.',
                asset: '/assets/feat-card-gift.png',
              },
              {
                title: 'We pay 3% of the bill for your daily essentials',
                desc: "We won't let you pay full, Every purchase we pay somepart. Promise",
                asset: '/assets/card-rewards.png',
              },
              {
                title: 'No Limit, Valid for entire 365 Days',
                desc: 'All the rewards, cashback, goldback remains the same throughout the year. No Deadlines or Expiry',
                asset: '/assets/card-calendar.png',
              },
            ].map((card, idx) => (
              <motion.div
                key={idx}
                {...fadeUp(idx * 0.15)}
                className="liquid-glass border border-white/5 rounded-3xl p-8 flex flex-col items-center text-center hover:bg-neutral-900/10 transition-colors duration-300"
              >
                {/* Image placeholder */}
                <div className="w-52 h-52 flex items-center justify-center rounded-2xl bg-neutral-950 border border-white/5 mb-8 relative overflow-hidden">
                  <img
                    className="absolute inset-0 w-full h-full object-contain"
                    src={card.asset}
                    alt={`${card.title} icon`}
                  />
                </div>

                <h3 className="font-cirka font-semibold text-lg text-white mb-3 tracking-tight">
                  {card.title}
                </h3>
                <p className="font-overpass-mono text-neutral-400 text-sm leading-relaxed max-w-xs">
                  {card.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 5B: SCROLLYTELLING VIDEO. rewards-desktop-final.mp4 */}
      <ScrollytellingVideo src="/assets/rewards-desktop-final.mp4" scrollMultiplier={3} />

      {/* SECTION 4: MISSION */}
      <section className="bg-black w-full pb-16 px-6">
        <div className="max-w-4xl mx-auto w-full flex flex-col items-center">
          {/* Loop Video */}
          <motion.div
            {...fadeUp(0.1)}
            className="w-full max-w-xl aspect-square rounded-[2.5rem] overflow-hidden mb-20 bg-neutral-950 border border-white/5"
          >
            <img
              className="w-full h-full object-contain p-2"
              src="/assets/yureka-points.png"
              alt="Yureka points illustration"
            />
          </motion.div>

          {/* Scroll-driven Opacity Paragraphs */}
          <div className="space-y-16">
            <ParagraphReveal
              text="We're building a space where intent meets ROI. where your daily routine finds purpose, your savings find scale, and every swipe becomes a wealth-building event."
              highlightWords={['intent', 'meets', 'roi']}
              className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-medium tracking-tight text-center"
            />

            <ParagraphReveal
              text="A platform where lifestyle, logic, and liquidity flow together. with zero fluff, total transparency, and deeper meaning for everyone involved."
              className="text-xl sm:text-2xl lg:text-3xl font-medium text-center"
            />
          </div>
        </div>
      </section>

      {/* SECTION 6: VIDEO ISLAND. scrollytelling vault 4.mp4 */}
      <ScrollytellingVideo src="/assets/vault 4.mp4" scrollMultiplier={3} />
    </div>
  );
};

export default HowItWorksStepper;

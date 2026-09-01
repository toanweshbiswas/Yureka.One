import React from 'react';
import { ArrowRight } from 'lucide-react';
import LazyVideo from '@shared/LazyVideo';

const YurekaInfoSection: React.FC = () => {
  return (
    <section className="bg-[#0a0a0a] px-6 py-24 w-full border-t border-white/10">

      {/* Row 1: heading + button, then full-width intro text */}
      <div className="mb-24 md:mb-32">
        <div className="mb-8">
          <h2
            className="font-cirka text-white text-4xl md:text-5xl font-bold leading-tight mb-8"
            style={{ letterSpacing: '-0.03em' }}
          >
            Meet <span className="text-white">Yureka</span>.
          </h2>

          {/* "Join Waitlist Now" pill button */}
          <button className="inline-flex items-center gap-3 bg-white text-black text-base font-medium pl-6 pr-1.5 py-1.5 rounded-full hover:bg-zinc-100 transition-colors duration-200">
            <span>Join Waitlist Now</span>
            <span className="bg-black rounded-full p-1.5">
              <ArrowRight className="w-4 h-4 text-white" />
            </span>
          </button>
        </div>

        <p className="font-overpass-mono text-white/70 text-2xl md:text-3xl leading-relaxed w-full">
          Yureka One transforms how you handle personal finance. We provide a reward-earning, AI-driven framework that optimizes your everyday spends, ensuring you never leave money on the table.
        </p>
      </div>

      {/* Row 2: 4-col card grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

        {/* Card 1. spans 2 cols, background video */}
        <div className="lg:col-span-2 relative rounded-2xl overflow-hidden bg-black min-h-80">
          <LazyVideo
            src="/assets/rewards.mp4"
            className="object-cover absolute inset-0 w-full h-full z-0 pointer-events-none select-none"
          />
        </div>

        {/* Card 2. dark */}
        <div className="bg-surface border border-white/[0.07] rounded-2xl p-7 min-h-80 flex flex-col">
          <h3
            className="text-2xl font-bold leading-snug min-h-[11rem] mb-4"
            style={{ letterSpacing: '-0.02em' }}
          >
            <span className="font-sans text-white">Shop across </span>
            <span className="font-cirka text-[#00933b]">500+</span>
            <span className="font-sans text-white"> Brands</span>
          </h3>
          <p className="font-overpass-mono text-white/60 text-base">
            We've partnered with brands that you use daily, be it ordering groceries from quick commerce or booking a flight ticket or a cab to your favorite movie. we have got everything covered.
          </p>
        </div>

        {/* Card 3. dark */}
        <div className="bg-surface border border-white/[0.07] rounded-2xl p-7 min-h-80 flex flex-col">
          <h3
            className="font-cirka text-white text-2xl font-bold leading-snug min-h-[11rem] mb-4"
            style={{ letterSpacing: '-0.02em' }}
          >
            Not just one time saving or cashback or reward points
          </h3>
          <p className="font-overpass-mono text-white/60 text-base">
            Get assured Goldback or Cashback &amp; reward points upto 30% everytime you shop across our partnered brands.
          </p>
        </div>

      </div>

      {/* Row 3: Duplicated 4-col card grid (reversed order) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-24 md:mt-32">

        {/* Card 1. dark (left side) */}
        <div className="bg-surface border border-white/[0.07] rounded-2xl p-7 min-h-80 flex flex-col">
          <h3
            className="font-cirka text-white text-2xl font-bold leading-snug min-h-[11rem] mb-4"
            style={{ letterSpacing: '-0.02em' }}
          >
            Redeem your Yureka Points &amp; Goldback on our platform
          </h3>
          <p className="font-overpass-mono text-white/60 text-base">
            We support Point Stacking. 24 Hrs / 7 Days a Week / 365 Days a Year.
          </p>
        </div>

        {/* Card 2. dark (middle-left) */}
        <div className="bg-surface border border-white/[0.07] rounded-2xl p-7 min-h-80 flex flex-col">
          <h3
            className="font-cirka text-white text-2xl font-bold leading-snug min-h-[11rem] mb-4"
            style={{ letterSpacing: '-0.02em' }}
          >
            Spending = Wealth &amp; Earning Compounding
          </h3>
          <p className="font-overpass-mono text-white/60 text-base">
            The magic. your savings and wealth compound with every new transaction that you do, every new day, every passing second.
          </p>
        </div>

        {/* Card 3. spans 2 cols, building image (right side) */}
        <div className="lg:col-span-2 relative rounded-2xl overflow-hidden bg-black min-h-80">
          <img
            src="/assets/yureka-building.png"
            alt="Assured by YUREKA"
            className="absolute inset-0 w-full h-full object-contain z-0 pointer-events-none select-none"
          />
        </div>

      </div>
    </section>
  );
};

export default YurekaInfoSection;

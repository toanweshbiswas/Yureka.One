import React from 'react';
import { ArrowRight } from 'lucide-react';
import LazyVideo from '@shared/LazyVideo';

const YurekaUseCasesSection: React.FC = () => {
  return (
    <section className="bg-[#0a0a0a] px-6 py-24 w-full border-t border-white/10">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">

        {/* Left column. text */}
        <div className="md:pr-12 md:pt-2">
          <p className="font-overpass-mono text-white/60 text-sm mb-2 font-medium tracking-widest uppercase">
            Yureka One in Practice
          </p>
          <h2
            className="text-5xl md:text-6xl font-medium leading-none mb-6"
            style={{ letterSpacing: '-0.04em' }}
          >
            <span className="font-sans text-white">We hate </span>
            <span className="font-cirka text-[#00933b]">Gatekeeping</span>
          </h2>
          <p className="font-overpass-mono text-white/60 text-base leading-relaxed max-w-sm">
            Encash your reward points / Digital gold for new purchases, Gift Cards, Bill Discounts or directly to your Bank Account. Absolute zero gatekeeping.
          </p>
        </div>

        {/* Right column. video card */}
        <div className="relative rounded-3xl overflow-hidden min-h-[560px] bg-black">
          <LazyVideo
            src="/assets/bankrewards.mp4"
            className="object-contain absolute inset-0 w-full h-full"
          />
        </div>

      </div>
    </section>
  );
};

export default YurekaUseCasesSection;

import React, { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

const Hero: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });

  // Transforms for scale and circle reveal
  const scale = useTransform(scrollYProgress, [0, 1], [1, 1.15]);
  const clipRadius = useTransform(scrollYProgress, [0, 1], ['0%', '150%']);

  // Dynamic clip-path string
  const clipPathValue = useTransform(clipRadius, (radius) => `circle(${radius} at 50% 50%)`);

  return (
    <section ref={containerRef} className="relative h-[120vh] w-full bg-black">
      {/* Sticky container that keeps view active during the 120vh scroll */}
      <div className="sticky top-0 h-screen w-full overflow-hidden flex items-center justify-center">
        
        {/* Layer 1: Sketch City Outline (Base Layer) */}
        <div className="absolute inset-0 w-full h-full bg-[#000000]">
          <div className="absolute inset-0 bg-black/40 z-10" />
          <motion.img
            src="https://strvid.nyc3.cdn.digitaloceanspaces.com/cloudinary/hero_city_outline_fzg37d.jpg"
            alt="City Outline Sketch"
            className="w-full h-full object-cover opacity-80"
          />
          {/* Base Layer Text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center z-20 text-center px-4">
            <span className="text-xs font-bold uppercase tracking-[0.3em] text-white mb-4">
              Everything Instant So Why Wait for
            </span>
            <h1 className="text-4xl md:text-7xl font-black tracking-tighter leading-[1.1] text-white max-w-4xl">
              3-4 Working Days to Get your Order
            </h1>
          </div>
        </div>

        {/* Layer 2: Realistic City Skyline (Top Reveal Layer) */}
        <motion.div
          style={{ clipPath: clipPathValue }}
          className="absolute inset-0 w-full h-full bg-[#000000] z-30 overflow-hidden"
        >
          <div className="absolute inset-0 bg-black/50 z-10" />
          <motion.img
            style={{ scale }}
            src="https://strvid.nyc3.cdn.digitaloceanspaces.com/cloudinary/hero_city_iglhwn.jpg"
            alt="Realistic City Skyline"
            className="w-full h-full object-cover"
          />
          {/* Reveal Layer Text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center z-20 text-center px-4">
            <span className="text-xs font-bold uppercase tracking-[0.3em] text-[#b026ff] mb-4">
              Yureka Moment
            </span>
            <h2 className="text-4xl md:text-7xl font-black tracking-tighter leading-[1.1] text-white max-w-4xl">
              Zwitch : Quick Delivery for Yureka Power Shoppers
            </h2>
          </div>
        </motion.div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-2 pointer-events-none select-none">
          <span className="text-[10px] font-bold tracking-[0.2em] text-white/50 uppercase">
            Scroll to Reveal
          </span>
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            className="text-white/70"
          >
            <ChevronDown size={24} />
          </motion.div>
        </div>

        {/* Bottom glass-fade edge. blends into the card gap */}
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/80 to-transparent z-50 pointer-events-none" />

      </div>
    </section>
  );
};

export default Hero;

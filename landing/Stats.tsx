import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';

const Counter: React.FC<{ end: number; duration?: number; trigger: boolean; prefix?: string; suffix?: string }> = ({ end, duration = 2000, trigger, prefix = '', suffix = '' }) => {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (trigger) {
      let startTime: number | null = null;
      const animate = (currentTime: number) => {
        if (!startTime) startTime = currentTime;
        const progress = Math.min((currentTime - startTime) / duration, 1);
        const easeValue = 1 - Math.pow(1 - progress, 4);
        setCount(easeValue * end);
        if (progress < 1) requestAnimationFrame(animate);
      };
      requestAnimationFrame(animate);
    }
  }, [trigger, end, duration]);

  return <span className="tabular-nums font-light">{prefix}{end % 1 !== 0 ? count.toFixed(1) : Math.floor(count)}{suffix}</span>;
};

const Stats: React.FC = () => {
  const [hasAnimated, setHasAnimated] = useState(false);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.8 }
    }
  };

  return (
    <section className="py-8 md:py-12 bg-cream px-4 md:px-8 border-y border-white/10 relative overflow-hidden w-full">
      <div className="w-full relative z-10 text-cream">
        
        {/* Header - Financial Section Style */}
        <div className="border-b-4 border-double border-white/10 mb-6 md:mb-8 pb-4">
             <div className="flex flex-col md:flex-row justify-between items-center md:items-end gap-6 text-cream">
                <motion.div 
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true }}
                    variants={itemVariants}
                    className="flex flex-col items-center md:items-start text-center md:text-left w-full md:w-auto"
                >
                    <div className="flex items-center gap-3 mb-4 md:mb-6">
                        <div className="w-1.5 h-1.5 bg-clay rounded-full animate-pulse"></div>
                        <h2 className="text-[10px] md:text-xs font-mono font-bold tracking-[0.3em] uppercase text-white/40">Our Numbers</h2>
                    </div>
                    <h3 className="text-2xl md:text-4xl font-sans font-bold leading-none text-white tracking-tight uppercase">
                        Why Use <br/><span className="font-serif italic font-light text-white/30">Us?</span>
                    </h3>
                </motion.div>
                <motion.div 
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true }}
                    variants={itemVariants}
                    transition={{ delay: 0.2 }}
                    className="text-center md:text-right w-full md:w-auto"
                >
                    <p className="text-white/40 text-sm md:text-base max-w-sm mx-auto md:ml-auto font-serif italic border-t md:border-t-0 md:border-l md:border-r border-clay/50 pt-4 md:pt-0 pl-0 md:pl-0 md:pr-4">
                        "Banks make money when you're confused. <br className="hidden lg:block" /> We help you understand and save."
                    </p>
                </motion.div>
            </div>
        </div>

        {/* Newspaper Grid (Upgraded with Glassmorphism) */}
        <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            onViewportEnter={() => setHasAnimated(true)}
            variants={containerVariants}
            className="grid grid-cols-1 md:grid-cols-3 glass-dark glass-shine-container rounded-[2.5rem] md:rounded-[4rem] border border-white/10 relative overflow-hidden shadow-2xl"
        >
            {/* Background Texture/Gradient for the grid */}
            <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] -z-10" />
            
            {/* Stat 1 */}
            <motion.div variants={itemVariants} className="col-span-1 p-6 md:p-8 border-b md:border-b-0 md:border-r border-white/10 relative group hover:bg-clay/[0.1] transition-all duration-500">
                <div className="flex justify-between items-start mb-6 text-white">
                     <span className="text-[10px] font-bold uppercase tracking-widest text-clay border border-clay/20 px-4 py-2 bg-clay/10 rounded-full backdrop-blur-sm shadow-sm group-hover:scale-105 transition-transform">Brands</span>
                     <span className="text-[10px] font-mono text-white/10">DAT.01</span>
                </div>
                <div className="text-5xl sm:text-6xl md:text-7xl text-white mb-4 tracking-tighter leading-none font-sans font-extrabold flex items-baseline gap-1">
                    <Counter end={700} suffix="+" trigger={hasAnimated} />
                    <span className="text-base sm:text-lg opacity-20 italic">Brands</span>
                </div>
                <h4 className="text-[11px] font-bold uppercase tracking-[0.3em] text-white mb-4 border-t border-white/10 pt-4 flex justify-between items-center w-full">
                    <span>Built for Power Shoppers</span>
                </h4>
                <p className="text-white/40 text-sm font-sans leading-relaxed max-w-xs transition-opacity group-hover:opacity-100">
                    We closely analyse daily spending of 1000+ individuals and then filtered out top 700+ brands for you.
                </p>
                {/* Subtle Hover Gradient */}
                <div className="absolute inset-0 bg-gradient-to-br from-clay/0 via-transparent to-clay/0 group-hover:from-clay/[0.05] transition-all duration-700 pointer-events-none" />
            </motion.div>

            {/* Stat 2 */}
            <motion.div variants={itemVariants} className="col-span-1 p-6 md:p-8 border-b md:border-b-0 md:border-r border-white/10 relative group hover:bg-clay/[0.1] transition-all duration-500">
                <div className="flex justify-between items-start mb-6 text-white">
                     <span className="text-[10px] font-bold uppercase tracking-widest text-clay border border-clay/20 px-4 py-2 bg-clay/10 rounded-full backdrop-blur-sm shadow-sm group-hover:scale-105 transition-transform">Accuracy</span>
                     <span className="text-[10px] font-mono text-white/10">ALG.02</span>
                </div>
                <div className="text-5xl sm:text-6xl md:text-7xl text-white mb-4 tracking-tighter leading-none font-sans font-extrabold">
                    <Counter end={100} prefix="" suffix="%" trigger={hasAnimated} />
                </div>
                <h4 className="text-[11px] font-bold uppercase tracking-[0.3em] text-white mb-4 border-t border-white/10 pt-4 flex justify-between items-center w-full">
                    <span>Precision Matching</span>
                    <span className="text-[9px] lowercase font-normal italic opacity-30">AI-Verified</span>
                </h4>
                <p className="text-white/40 text-sm font-sans leading-relaxed max-w-xs transition-opacity group-hover:opacity-100">
                    We match every one of those 1000+ spending profiles to the brands and cards that pay them back the most. upto 30% in cashback, goldback and reward points.
                </p>
                <div className="absolute inset-0 bg-gradient-to-br from-clay/0 via-transparent to-clay/0 group-hover:from-clay/[0.05] transition-all duration-700 pointer-events-none" />
            </motion.div>

            {/* Stat 3 */}
            <motion.div variants={itemVariants} className="col-span-1 p-6 md:p-8 relative group hover:bg-clay/[0.1] transition-all duration-500">
                <div className="flex justify-between items-start mb-6 text-white">
                     <span className="text-[10px] font-bold uppercase tracking-widest text-clay border border-clay/20 px-4 py-2 bg-clay/10 rounded-full backdrop-blur-sm shadow-sm group-hover:scale-105 transition-transform">Savings</span>
                     <span className="text-[10px] font-mono text-white/10">RES.03</span>
                </div>
                <div className="text-5xl sm:text-6xl md:text-7xl text-white mb-4 tracking-tighter leading-none font-sans font-extrabold flex items-baseline gap-1">
                    <Counter end={15} prefix="₹" suffix="k" trigger={hasAnimated} />
                    <span className="text-base sm:text-lg opacity-20 italic">yield</span>
                </div>
                <h4 className="text-[11px] font-bold uppercase tracking-[0.3em] text-white mb-4 border-t border-white/10 pt-4 flex justify-between items-center w-full">
                    <span>Average Savings</span>
                    <span className="text-[9px] lowercase font-normal italic opacity-30">Annualized</span>
                </h4>
                <p className="text-white/40 text-sm font-sans leading-relaxed max-w-xs transition-opacity group-hover:opacity-100">
                    Power Shoppers who switch unlock an average of ₹15,000 every year by spending smarter across our 700+ partner brands.
                </p>
                <div className="absolute inset-0 bg-gradient-to-br from-clay/0 via-transparent to-clay/0 group-hover:from-clay/[0.05] transition-all duration-700 pointer-events-none" />
            </motion.div>

        </motion.div>
      </div>
    </section>
  );
};

export default Stats;
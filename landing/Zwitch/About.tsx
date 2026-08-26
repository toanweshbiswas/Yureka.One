import React from 'react';
import { motion } from 'framer-motion';

const stats = [
  { value: '20 Min', label: 'HYPERLOCAL DELIVERY' },
  { value: '700+', label: 'PARTNER BRANDS' },
  { value: '15-20%', label: 'SAVINGS PER ORDER' },
  { value: '1:1', label: 'LIQUID REWARDS' },
];

const About: React.FC = () => {
  return (
    <section id="agency" className="bg-transparent pt-12 pb-16 relative overflow-hidden w-full">
      {/* Glass shimmer top border */}
      <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
      
      {/* Background Detail: Center-positioned absolute blurred purple circle */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-green-500/5 blur-[120px] rounded-full pointer-events-none z-0" />
      
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Split Content: 2-Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-center">
          
          {/* Left Column: Bold Headline */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.8 }}
            className="flex flex-col items-start"
          >
            <span className="text-xs font-bold uppercase tracking-[0.3em] text-[#00f0ff] mb-6">
              OUR PHILOSOPHY
            </span>
            <blockquote className="text-4xl md:text-5xl font-black tracking-tighter leading-tight text-white">
              "Speed is not just how fast it moves. It’s how seamlessly it arrives."
            </blockquote>
          </motion.div>

          {/* Right Column: Descriptions & Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="flex flex-col gap-10"
          >
            <div className="space-y-6 text-gray-300 font-light leading-relaxed text-lg">
              <p>
                We built Zwitch to close the loop between intent and fulfilment. By combining Yureka’s intelligent wealth-stack with instant commerce, we let you order directly from your favorite partner brands inside the app and have your goods delivered in minutes. while still earning your hard savings, invested digital gold, and liquid reward points on every single order.
              </p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-4 border-t border-white/10 pt-10">
              {stats.map((stat, idx) => (
                <div key={idx} className="flex flex-col p-4 rounded-2xl backdrop-blur-md bg-white/[0.04] border border-white/10 ring-1 ring-white/5">
                  <span className="text-3xl sm:text-4xl font-black tracking-tighter text-[#5fae52] mb-1">
                    {stat.value}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    {stat.label}
                  </span>
                </div>
              ))}
            </div>

          </motion.div>
        </div>

      </div>
    </section>
  );
};

export default About;

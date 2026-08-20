import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';

const projects = [
  {
    name: 'Fashion',
    category: 'Partner Brands',
    image: '/zwitch_fashion.png',
    slug: 'fashion',
  },
  {
    name: 'Beauty',
    category: 'Partner Brands',
    image: '/zwitch_beauty.png',
    slug: 'beauty',
  },
  {
    name: 'Luxury',
    category: 'Partner Brands',
    image: '/zwitch_luxury.png',
    slug: 'luxury',
  },
  {
    name: 'Jewellery',
    category: 'Partner Brands',
    image: '/zwitch_jewellery.png',
    slug: 'jewellery',
  },
  {
    name: 'Food',
    category: 'Partner Brands',
    image: '/zwitch_food.png',
    slug: 'food',
  },
];

const Work: React.FC = () => {
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const navigate = useNavigate();

  const handleRedirect = (slug: string) => {
    navigate(`/brands/${slug}`);
  };

  return (
    <section id="work" className="bg-transparent pt-10 pb-16 relative overflow-hidden w-full">
      {/* Glass shimmer top border */}
      <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
      {/* Ambient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-[#00f0ff]/3 blur-[120px] rounded-full pointer-events-none" />
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header Area */}
        <div className="flex flex-col md:flex-row items-start md:items-end justify-between mb-16 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.8 }}
          >
            <h2 className="text-4xl md:text-6xl font-black tracking-tighter leading-[1.1] text-white">
              Partnered Brands
            </h2>
          </motion.div>
        </div>

        {/* Gallery Container (Accordion) */}
        {/* Desktop Layout (Horizontal Accordion) */}
        <div className="hidden md:flex gap-4 h-[400px] w-full">
          {projects.map((project, index) => {
            const isActive = activeIndex === index;
            return (
              <motion.div
                key={project.name}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => handleRedirect(project.slug)}
                animate={{ 
                  flex: isActive ? 4 : 0.8 
                }}
                transition={{ 
                  ease: [0.25, 1, 0.5, 1], 
                  duration: 0.6 
                }}
                className="relative h-full rounded-3xl overflow-hidden cursor-pointer group border border-white/20 ring-1 ring-white/10 bg-white/5"
              >
                {/* Background Image */}
                <img
                  src={project.image}
                  alt={project.name}
                  loading="lazy"
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-[1000ms] group-hover:scale-105"
                />

                {/* Glassmorphism frosted overlay */}
                <div className="absolute inset-0 backdrop-blur-[1px] bg-white/5 z-10 transition-all duration-300 group-hover:backdrop-blur-0 group-hover:bg-transparent" />

                {/* Strong dark gradient at bottom for text legibility */}
                <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/90 via-black/50 to-transparent z-10" />

                {/* Content Overlay */}
                <div className="absolute inset-0 flex flex-col justify-end p-6 z-20">
                  <AnimatePresence mode="wait">
                    {isActive ? (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        transition={{ duration: 0.4 }}
                        className="flex flex-col items-start"
                      >
                        {/* Glassmorphic label pill */}
                        <div className="mb-3 px-3 py-1.5 rounded-full backdrop-blur-md bg-black/50 border border-white/10">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-[#00f0ff]">
                            {project.category}
                          </span>
                        </div>
                        <h3 className="text-3xl font-black text-white tracking-tight mb-4 drop-shadow-[0_2px_12px_rgba(0,0,0,1)]">
                          {project.name}
                        </h3>
                        {/* Glassmorphic CTA chip */}
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full backdrop-blur-md bg-black/50 border border-[#00f0ff]/30 text-xs font-bold text-[#00f0ff] uppercase tracking-wider">
                          View Category
                          <ArrowUpRight size={14} />
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="writing-mode-vertical origin-left flex items-center gap-4 text-white/50 group-hover:text-white transition-colors"
                      >
                        <span className="text-sm font-bold tracking-widest uppercase rotate-90 whitespace-nowrap">
                          {project.name}
                        </span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Mobile Layout (Vertical Accordion) */}
        <div className="flex md:hidden flex-col gap-4 w-full">
          {projects.map((project, index) => {
            const isActive = activeIndex === index;
            return (
              <motion.div
                key={project.name}
                onClick={() => {
                  if (isActive) {
                    handleRedirect(project.slug);
                  } else {
                    setActiveIndex(index);
                  }
                }}
                animate={{ 
                  height: isActive ? 280 : 80 
                }}
                transition={{ 
                  ease: [0.25, 1, 0.5, 1], 
                  duration: 0.6 
                }}
                className="relative w-full rounded-2xl overflow-hidden cursor-pointer group border border-white/20 ring-1 ring-white/10 bg-white/5"
              >
                {/* Background Image */}
                <img
                  src={project.image}
                  alt={project.name}
                  loading="lazy"
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-[1000ms]"
                />

                {/* Glassmorphism frosted overlay */}
                <div className="absolute inset-0 backdrop-blur-[1px] bg-white/5 z-10" />

                {/* Strong dark gradient at bottom */}
                <div className="absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-t from-black/95 via-black/60 to-transparent z-10" />

                {/* Content Overlay */}
                <div className="absolute inset-0 flex flex-col justify-end p-6 z-20">
                  {isActive ? (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                      className="flex flex-col items-start"
                    >
                      <div className="mb-2 px-2.5 py-1 rounded-full backdrop-blur-md bg-black/50 border border-white/10">
                        <span className="text-[9px] font-bold uppercase tracking-widest text-[#00f0ff]">
                          {project.category}
                        </span>
                      </div>
                      <h3 className="text-2xl font-black text-white tracking-tight mb-3 drop-shadow-[0_2px_12px_rgba(0,0,0,1)]">
                        {project.name}
                      </h3>
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full backdrop-blur-md bg-black/50 border border-[#00f0ff]/30 text-[9px] font-bold text-[#00f0ff] uppercase tracking-wider">
                        Tap to view
                        <ArrowUpRight size={12} />
                      </div>
                    </motion.div>
                  ) : (
                    <div className="flex items-center justify-between w-full h-full">
                      <span className="text-lg font-black text-white uppercase">
                        {project.name}
                      </span>
                      <span className="text-[10px] font-bold text-[#00f0ff] uppercase tracking-wider">
                        Tap to view
                      </span>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>

      </div>
    </section>
  );
};

export default Work;

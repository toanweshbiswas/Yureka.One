import React, { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { ArrowRight, Check } from 'lucide-react';
import LazyVideo from '@shared/LazyVideo';

// ==========================================
// SHARED ANIMATION COMPONENTS
// ==========================================

interface WordsPullUpProps {
  text: string;
  className?: string;
  showAsterisk?: boolean;
  style?: React.CSSProperties;
}

export const WordsPullUp: React.FC<WordsPullUpProps> = ({ text, className = '', showAsterisk = false, style }) => {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });

  const words = text.split(' ');

  return (
    <div ref={ref} className={`inline-flex flex-nowrap justify-center ${className}`} style={style}>
      {words.map((word, index) => {
        const isLastWord = index === words.length - 1;

        const wordVariants = {
          hidden: { y: 20, opacity: 0 },
          visible: {
            y: 0,
            opacity: 1,
            transition: {
              duration: 0.8,
              ease: [0.16, 1, 0.3, 1] as const,
              delay: index * 0.08,
            },
          },
        };

        return (
          <motion.span
            key={index}
            variants={wordVariants}
            initial="hidden"
            animate={isInView ? 'visible' : 'hidden'}
            className="relative inline-block mr-[0.25em] whitespace-nowrap"
          >
            {word}
            {isLastWord && showAsterisk && (
              <span className="absolute top-[0.65em] -right-[0.3em] text-[0.31em] select-none pointer-events-none">
                *
              </span>
            )}
          </motion.span>
        );
      })}
    </div>
  );
};

interface Segment {
  text: string;
  className: string;
}

interface WordsPullUpMultiStyleProps {
  segments: Segment[];
  containerClassName?: string;
  /** 'inline' flows all segments' words together as one wrapped paragraph (mixed styling per word).
   *  'block' (default) renders each segment as its own wrapped block. used for stacked lines. */
  mode?: 'block' | 'inline';
}

export const WordsPullUpMultiStyle: React.FC<WordsPullUpMultiStyleProps> = ({
  segments,
  containerClassName = '',
  mode = 'block',
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });

  if (mode === 'inline') {
    const allWords = segments.flatMap((seg) =>
      seg.text.split(' ').filter(Boolean).map((word) => ({ word, className: seg.className }))
    );

    return (
      <div ref={ref} className={`inline-flex flex-wrap justify-center ${containerClassName}`}>
        {allWords.map(({ word, className }, index) => {
          const wordVariants = {
            hidden: { y: 20, opacity: 0 },
            visible: {
              y: 0,
              opacity: 1,
              transition: {
                duration: 0.8,
                ease: [0.16, 1, 0.3, 1] as const,
                delay: index * 0.08,
              },
            },
          };

          return (
            <motion.span
              key={index}
              variants={wordVariants}
              initial="hidden"
              animate={isInView ? 'visible' : 'hidden'}
              className={`inline-block mr-[0.25em] whitespace-nowrap ${className}`}
            >
              {word}
            </motion.span>
          );
        })}
      </div>
    );
  }

  let globalWordIndex = 0;

  return (
    <div ref={ref} className={`inline-flex flex-wrap justify-center ${containerClassName}`}>
      {segments.map((seg, segIndex) => {
        const words = seg.text.split(' ');

        return (
          <span key={segIndex} className={seg.className}>
            {words.map((word, wordIndex) => {
              if (!word) return null;

              const currentWordIndex = globalWordIndex;
              globalWordIndex++;

              const wordVariants = {
                hidden: { y: 20, opacity: 0 },
                visible: {
                  y: 0,
                  opacity: 1,
                  transition: {
                    duration: 0.8,
                    ease: [0.16, 1, 0.3, 1] as const,
                    delay: currentWordIndex * 0.08,
                  },
                },
              };

              return (
                <motion.span
                  key={wordIndex}
                  variants={wordVariants}
                  initial="hidden"
                  animate={isInView ? 'visible' : 'hidden'}
                  className="inline-block mr-[0.25em] whitespace-nowrap"
                >
                  {word}
                </motion.span>
              );
            })}
          </span>
        );
      })}
    </div>
  );
};

// ==========================================
// CARD ENTRANCE WRAPPER
// ==========================================

const FeatureCardEntrance: React.FC<{ children: React.ReactNode; index: number }> = ({
  children,
  index,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <motion.div
      ref={ref}
      initial={{ scale: 0.95, opacity: 0 }}
      animate={isInView ? { scale: 1, opacity: 1 } : { scale: 0.95, opacity: 0 }}
      transition={{
        duration: 0.8,
        delay: index * 0.15,
        ease: [0.22, 1, 0.36, 1],
      }}
      className="h-full flex flex-col"
    >
      {children}
    </motion.div>
  );
};

// ==========================================
// MAIN COMPONENT
// ==========================================

const TextReveal: React.FC = () => {
  return (
    <div className="w-full flex flex-col bg-black text-[#E1E0CC]">
      {/* SECTION 1: HERO */}
      <section className="relative w-full min-h-[600px] lg:h-screen p-4 md:p-6 bg-black flex flex-col">
        <div className="relative flex-1 w-full rounded-2xl md:rounded-[2rem] overflow-hidden flex flex-col justify-end">
          {/* Background Video */}
          <LazyVideo
            src="/assets/cta_fold.mp4"
            className="absolute inset-0 w-full h-full object-cover z-0"
          />

          {/* Noise Overlay */}
          <div className="absolute inset-0 noise-overlay opacity-[0.7] mix-blend-overlay pointer-events-none z-10" />

          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/60 pointer-events-none z-10" />

          {/* Hero Content */}
          <div className="relative z-20 w-full p-6 sm:p-8 md:p-12">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end">
              {/* Left Column: Heading */}
              <div className="lg:col-span-8 flex flex-col items-start mb-6 lg:mb-0">
                <WordsPullUp
                  text="Yureka AI"
                  showAsterisk
                  className="font-medium leading-[0.85] tracking-[-0.07em] text-[16vw] sm:text-[15vw] md:text-[14vw] lg:text-[9.5vw] xl:text-[9vw] 2xl:text-[8vw]"
                  style={{ color: '#E1E0CC' }}
                />
              </div>

              {/* Right Column: Description + CTA */}
              <div className="lg:col-span-4 flex flex-col items-start lg:pl-4">
                <motion.button
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.8, delay: 0.7, ease: [0.16, 1, 0.3, 1] as const }}
                  className="group inline-flex items-center gap-2 hover:gap-3 bg-primary text-black font-medium text-sm sm:text-base pl-6 pr-1.5 py-1.5 rounded-full transition-all duration-300 shadow-lg whitespace-nowrap"
                  style={{ backgroundColor: '#DEDBC8' }}
                >
                  <span className="tracking-tight select-none whitespace-nowrap">Explore Yureka AI</span>
                  <div className="bg-black rounded-full w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center transition-transform duration-300 group-hover:scale-110 shrink-0">
                    <ArrowRight className="w-4 h-4 sm:w-5 h-5 text-[#E1E0CC]" />
                  </div>
                </motion.button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2: ABOUT */}
      <section className="bg-black py-24 px-6 md:px-12 w-full">
        <div className="bg-[#101010] rounded-[2rem] p-8 md:p-16 max-w-6xl mx-auto w-full flex flex-col items-center justify-center">
          <span className="text-[#DEDBC8] text-[10px] sm:text-xs tracking-widest uppercase mb-8 text-center block select-none">
            Engineered for the Serious User
          </span>

          <div className="text-center mb-12">
            <WordsPullUpMultiStyle
              mode="inline"
              containerClassName="text-lg sm:text-xl md:text-2xl lg:text-3xl xl:text-4xl max-w-4xl mx-auto leading-snug text-center"
              segments={[
                {
                  text: 'Yureka.One is India’s first AI-native wealth operating system, turning every transaction into a wealth-building event. We move beyond hollow cashbacks and expiring "dead coins." ',
                  className: 'font-normal text-[#E1E0CC]',
                },
                {
                  text: 'Instead, we offer assured Goldback and high-yield returns that grow in your vault. providing 100% liquidity for global lifestyle experiences, travel, and premium consumption.',
                  className: 'font-normal text-primary',
                },
              ]}
            />
          </div>
        </div>
      </section>

      {/* SECTION 3: FEATURES */}
      <section className="relative bg-black py-24 px-6 md:px-12 w-full overflow-hidden">


        <div className="relative z-10 max-w-6xl mx-auto w-full flex flex-col">
          <div className="text-center mb-20 flex flex-col gap-2">
            <WordsPullUpMultiStyle
              mode="inline"
              containerClassName="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-normal"
              segments={[
                { text: 'Built for', className: 'text-[#DEDBC8]' },
                { text: 'PowerShoppers', className: 'text-clay' },
                { text: 'like you.', className: 'text-[#DEDBC8]' },
              ]}
            />
            <WordsPullUpMultiStyle
              mode="inline"
              containerClassName="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-normal mt-2"
              segments={[
                { text: 'Zero Asterisk, No Terms & Conditions.', className: 'text-gray-500' },
              ]}
            />
          </div>

          {/* Grid Layout: Responsive breakpoints */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 lg:h-[480px] gap-3 sm:gap-2 md:gap-1">
            {/* Card 1: Image Card */}
            <FeatureCardEntrance index={0}>
              <div className="relative rounded-2xl overflow-hidden min-h-[320px] lg:h-full flex flex-col justify-end p-6 z-10">
                <img
                  className="absolute inset-0 w-full h-full object-contain bg-black z-0"
                  src="/assets/creative_canvas.png"
                  alt="Your creative canvas"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none z-10" />
                <span className="text-[#E1E0CC] text-lg font-medium relative z-20">
                  Your Personalised SavingOs
                </span>
              </div>
            </FeatureCardEntrance>

            {/* Card 2: Project Storyboard */}
            <FeatureCardEntrance index={1}>
              <div className="bg-black rounded-2xl p-6 lg:h-full flex flex-col justify-between border border-white/5">
                <div>
                  <img
                    className="w-full h-48 object-contain mb-2"
                    src="/assets/feat-card-question.png"
                    alt="Project Storyboard"
                  />
                  <h3 className="text-[#E1E0CC] font-medium text-lg mt-3 tracking-tight uppercase">
                    Pay using anything. <span className="text-gray-500 font-normal">(01)</span>
                  </h3>
                  <ul className="space-y-3 mt-5">
                    {[
                      'UPI',
                      'Bank account',
                      'Wallets',
                      'BNPL',
                    ].map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs sm:text-sm text-gray-400">
                        <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" style={{ color: '#DEDBC8' }} />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </FeatureCardEntrance>

            {/* Card 3: Smart Critiques */}
            <FeatureCardEntrance index={2}>
              <div className="bg-black rounded-2xl p-6 lg:h-full flex flex-col justify-between border border-white/5">
                <div>
                  <img
                    className="w-full h-48 object-contain mb-2"
                    src="/assets/feat-card-gift.png"
                    alt="Assured returns"
                  />
                  <h3 className="text-[#E1E0CC] font-medium text-lg mt-3 tracking-tight uppercase">
                    Assured Returns <span className="text-gray-500 font-normal">(02)</span>
                  </h3>
                  <ul className="space-y-3 mt-5">
                    {[
                      'Assured Cashback',
                      'Assured Goldback',
                      'Assured Reward Points',
                    ].map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs sm:text-sm text-gray-400">
                        <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" style={{ color: '#DEDBC8' }} />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </FeatureCardEntrance>

            {/* Card 4: Immersion Capsule */}
            <FeatureCardEntrance index={3}>
              <div className="bg-black rounded-2xl p-6 lg:h-full flex flex-col justify-between border border-white/5">
                <div>
                  <img
                    className="w-full h-48 object-contain mb-2"
                    src="/assets/feat-card-gift.png"
                    alt="Immersion Capsule"
                  />
                  <h3 className="text-[#E1E0CC] font-medium text-lg mt-3 tracking-tight uppercase">
                    Premium Experiences <span className="text-gray-500 font-normal">(03)</span>
                  </h3>
                  <ul className="space-y-3 mt-5">
                    {[
                      'Flights & Hotels',
                      'Dining & Events',
                      'Luxury & Shoppings',
                    ].map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs sm:text-sm text-gray-400">
                        <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" style={{ color: '#DEDBC8' }} />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </FeatureCardEntrance>
          </div>
        </div>
      </section>
    </div>
  );
};

export default TextReveal;
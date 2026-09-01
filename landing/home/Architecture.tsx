import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import JoinWaitlistButton from './JoinWaitlistButton';
import {
  landingBody,
  landingContainer,
  landingEyebrow,
  landingSection,
  landingSectionTitle,
} from './landingLayout';

const LAYERS = [
  {
    label: 'Layer 1',
    value: 'Capture',
    copy: 'Continuously ingests spend signals, reward matrices, and shopping cart context via secure APIs and the RewardX extension.',
  },
  {
    label: 'Layer 2',
    value: 'Process',
    copy: 'Runs intelligent intent matching through automated models to calculate maximum yield and identify zero-commission merchant routing.',
  },
  {
    label: 'Layer 3',
    value: 'Interface',
    copy: 'Instantly converts rewards into digital wealth assets or routes direct orders seamlessly via headless commerce protocols.',
  },
];

export default function Architecture() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section className={`${landingSection} min-h-screen`}>
      <div className={`${landingContainer} flex max-w-3xl flex-col items-center text-center`}>
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 1.0 }}
        >
          <p className={`mb-8 ${landingEyebrow}`}>
            Architecture
          </p>
          <h2 className={`mb-10 ${landingSectionTitle}`}>
            Three layers. Zero friction.
          </h2>
          <p className={`mx-auto max-w-xl ${landingBody}`}>
            Layer 1 captures raw transactional and rewards data. Layer 2 processes financial
            intent using lightweight AI routing. Layer 3 delivers optimized rewards and asset
            conversions instantly.
          </p>
          <JoinWaitlistButton className="mt-10" />
        </motion.div>

        <motion.div
          className="mt-20 flex w-full flex-col items-center gap-4"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 1.2, delay: 0.4 }}
        >
          {LAYERS.map((layer, i) => {
            const isOpen = open === i;
            return (
              <button
                key={layer.label}
                type="button"
                onClick={() => setOpen(isOpen ? null : i)}
                aria-expanded={isOpen}
                className={`w-full max-w-md touch-manipulation rounded-lg border px-6 text-left transition-colors duration-200 active:scale-[0.99] ${
                  isOpen ? 'border-white/25 bg-white/[0.03]' : 'border-white/10 hover:border-white/20'
                }`}
              >
                <div className="flex h-[72px] items-center justify-between">
                  <span className="text-[12px] uppercase tracking-[0.15em] text-landing-muted">
                    {layer.label}
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="text-[16px] font-light text-landing-primary sm:text-[18px]">
                      {layer.value}
                    </span>
                    <svg
                      viewBox="0 0 24 24"
                      width="16"
                      height="16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      className={`text-landing-caption transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
                    >
                      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </div>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      key="copy"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ type: 'spring', bounce: 0, duration: 0.35 }}
                      className="overflow-hidden"
                    >
                      <p className={`pb-6 pr-1 text-left ${landingBody}`}>
                        {layer.copy}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </button>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}

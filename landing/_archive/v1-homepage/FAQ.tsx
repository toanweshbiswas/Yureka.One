import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { faqQuestions } from '@backend/lib/faq';

interface FAQItemProps {
  question: string;
  answer: string;
  isOpen: boolean;
  onToggle: () => void;
}

const FAQItem: React.FC<FAQItemProps> = ({ question, answer, isOpen, onToggle }) => {
  return (
    <div 
      className={`relative transition-all duration-300 ${
        isOpen 
          ? 'bg-[#082240] rounded-xl px-6 py-5 my-4 overflow-hidden border-b border-transparent shadow-[0_4px_25px_rgba(0,0,0,0.6)]' 
          : 'border-b border-white/10 py-5'
      }`}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between text-left focus:outline-none cursor-pointer group"
      >
        <span 
          className={`font-sans font-medium text-base md:text-lg transition-colors leading-snug pr-4 ${
            isOpen ? 'text-white font-semibold' : 'text-white/80 group-hover:text-white'
          }`}
        >
          {question}
        </span>
        <span className="shrink-0 text-white/60">
          {isOpen ? <X size={20} className="text-white" /> : <Plus size={20} className="group-hover:text-white transition-colors" />}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <p className="mt-4 text-sm md:text-base text-slate-300 leading-relaxed font-sans font-normal">
              {answer}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {isOpen && (
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-400 via-indigo-500 to-purple-500" />
      )}
    </div>
  );
};

const FAQ: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const handleToggle = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section className="py-16 md:py-24 bg-black border-b border-white/10 relative overflow-hidden w-full">
      {/* Background radial highlight */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full relative z-10 text-white px-6 md:px-12 lg:px-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
          
          {/* Left Column: Sticky Header with Abe Illustration */}
          <div className="lg:col-span-5 lg:sticky lg:top-32 flex flex-col items-start">
            <h2 className="text-4xl md:text-5xl lg:text-[44px] font-cirka font-bold text-white tracking-tight leading-[1.1] mb-3 uppercase">
              Your questions,<br />answered
            </h2>
            <p className="text-base text-white/60 mb-8 font-sans">
              Reach out if we missed yours.
            </p>

            {/* Abraham Lincoln Illustration */}
            <div className="w-full max-w-[280px] md:max-w-[320px] opacity-90 select-none mt-4">
              <img
                src="/images/abe-lincoln-green.png"
                alt="Abraham Lincoln with headphones holding a drink at a laptop"
                className="w-full h-auto object-contain rounded-2xl"
              />
            </div>
          </div>

          {/* Right Column: Plaid-styled FAQ Accordions */}
          <div className="lg:col-span-7 w-full flex flex-col">
            {faqQuestions.map((item, idx) => (
              <FAQItem
                key={idx}
                question={item.q}
                answer={item.a}
                isOpen={openIndex === idx}
                onToggle={() => handleToggle(idx)}
              />
            ))}
          </div>

        </div>
      </div>
    </section>
  );
};

export default FAQ;
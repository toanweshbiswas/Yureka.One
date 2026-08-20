import { useState } from 'react';
import JoinWaitlistButton from './JoinWaitlistButton';
import { faqQuestions } from '@backend/lib/faq';
import { Link } from 'react-router-dom';

function FAQItem({
  q,
  a,
  isOpen,
  onToggle,
}: {
  q: string;
  a: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border-b border-white/10 py-6">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full touch-manipulation items-center justify-between gap-6 text-left active:opacity-80"
      >
        <span style={{ fontFamily: 'Inter, sans-serif' }} className="text-[16px] text-white sm:text-[18px]">
          {q}
        </span>
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center transition-transform duration-200"
          style={{ transform: isOpen ? 'rotate(45deg)' : 'rotate(0deg)' }}
        >
          <i className="bi bi-plus text-[22px] text-white" />
        </span>
      </button>
      {isOpen ? (
        <p
          style={{ fontFamily: 'Inter, sans-serif' }}
          className="mt-4 max-w-2xl text-[13px] leading-relaxed text-white/50 sm:text-[14px]"
        >
          {a}
        </p>
      ) : (
        <p className="sr-only">{a}</p>
      )}
    </div>
  );
}

export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="relative w-full bg-black px-6 py-24 sm:py-32">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-12 md:max-w-[60vw] md:grid-cols-[0.85fr_1.15fr] md:gap-16">
        <div>
          <h2
            style={{ fontFamily: '"Playfair Display", serif' }}
            className="text-[34px] italic font-semibold uppercase leading-[1.1] text-[#5fae52] sm:text-[44px]"
          >
            Your Questions,
            <br />
            Answered
          </h2>
          <p
            style={{ fontFamily: 'Inter, sans-serif' }}
            className="mt-4 text-[14px] text-white/60 sm:text-[15px]"
          >
            Reach out if we missed yours. Full list on the{' '}
            <Link to="/faq" className="text-[#5fae52] hover:underline">FAQ page</Link>.
          </p>

          <div className="relative mt-10 hidden aspect-[4/5] max-w-xs overflow-hidden rounded-2xl border border-white/20 bg-white/[0.04] shadow-2xl shadow-black/40 backdrop-blur-xl sm:block">
            <img
              src="/abe-lincoln-green.png"
              alt=""
              loading="lazy"
              className="h-full w-full object-cover"
            />

            {/* Glass sheen: a soft diagonal highlight band, like light
                catching a curved glass surface. */}
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  'linear-gradient(115deg, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0.08) 18%, rgba(255,255,255,0) 32%, rgba(255,255,255,0) 68%, rgba(255,255,255,0.12) 82%, rgba(255,255,255,0) 100%)',
                mixBlendMode: 'overlay',
              }}
            />
            <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/25" />
          </div>

          <JoinWaitlistButton className="mt-8" />
        </div>

        <div>
          {faqQuestions.map((item, i) => (
            <FAQItem
              key={item.q}
              q={item.q}
              a={item.a}
              isOpen={openIndex === i}
              onToggle={() => setOpenIndex(openIndex === i ? null : i)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

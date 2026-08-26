import { useState } from 'react';

// Placeholder answer copy -- on-brand but not sourced from a real FAQ doc.
// Swap in real answers when available. The Lincoln-with-headphones
// illustration is likewise a placeholder (simple icon block) standing in
// for the real custom artwork.
const FAQS = [
  {
    q: 'What is Yureka.One?',
    a: 'Yureka.One is an AI-driven rewards copilot that automatically finds the best card, offer, and cashback path for every purchase you make -- online or offline.',
  },
  {
    q: 'What is Yureka Goldback?',
    a: "Goldback is our reward format that pays you back in digital gold instead of points that expire or get devalued -- redeemable anytime, with zero gatekeeping.",
  },
  {
    q: 'Is cashback in gold better than regular cashback?',
    a: "Gold holds value over time instead of losing it. Reward points can be devalued or expire; grams of gold in your account don't.",
  },
  {
    q: 'Can AI really order food or groceries for me in India?',
    a: "Yes. Yureka's AI can place orders across supported delivery and quick-commerce apps on your behalf, always routing through the highest-reward payment method.",
  },
  {
    q: 'How can I build a credit score without a loan history?',
    a: "Yureka tracks your everyday spending patterns and reports responsible usage to help you build credit history from real transactions.",
  },
  {
    q: 'Is my data safe with Yureka?',
    a: 'Your financial data is encrypted end-to-end and never sold. You control exactly what stays connected and can revoke access anytime.',
  },
  {
    q: 'How much does Yureka cost?',
    a: "Yureka is free to join during the waitlist phase. Pricing for premium AI features will be announced closer to public launch.",
  },
  {
    q: 'How do I join Yureka?',
    a: "Join the waitlist from the homepage -- we're onboarding users in phases starting with early sign-ups.",
  },
  {
    q: 'How is Yureka different from CRED, CashKaro, or Jar?',
    a: 'Those platforms track spend or round up savings. Yureka actively optimizes every transaction in real time using AI, across your existing cards -- no behavior change required.',
  },
  {
    q: 'What is a Wealth Operating System?',
    a: "It's the layer that sits across your cards, spends, and rewards -- making decisions for you instead of asking you to track everything manually.",
  },
];

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
        className="flex w-full items-center justify-between gap-6 text-left"
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
      {isOpen && (
        <p
          style={{ fontFamily: 'Inter, sans-serif' }}
          className="mt-4 max-w-2xl text-[13px] leading-relaxed text-white/50 sm:text-[14px]"
        >
          {a}
        </p>
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
            Reach out if we missed yours.
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
        </div>

        <div>
          {FAQS.map((item, i) => (
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

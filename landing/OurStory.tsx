import React from 'react';
import { ArrowRight } from 'lucide-react';
import SEO from '@shared/SEO';
import { staticPageMeta } from '@backend/lib/seo/pageMeta';

const pillars = [
  {
    num: '01',
    title: 'Spending as an Investment',
    body: 'We have transformed the act of consumption. Every purchase, from daily necessities to premium lifestyle choices, is now an automated engine for wealth accumulation.',
  },
  {
    num: '02',
    title: 'Radical Transparency',
    body: 'We eliminate the complexity of "dead coins" and opaque reward tiers. We stand for a 1:1 value ratio. uncompromising, clear, and always in your favor.',
  },
  {
    num: '03',
    title: 'Data-Driven Empowerment',
    body: 'Your financial potential is not defined by static scores of the past. We leverage your real-time behavior to unlock true credit accessibility and personalized financial intelligence.',
  },
  {
    num: '04',
    title: 'The Serious User Architecture',
    body: 'Yureka is built for the power shopper. the individual who demands efficiency, tracks their trajectory, and recognizes that their digital footprint is their greatest financial asset.',
  },
];

const Manifesto: React.FC = () => (
  <div className="bg-landing-bg text-white selection:bg-landing-primary selection:text-landing-ink">
    <SEO {...staticPageMeta['/manifesto']} />

    {/* Masthead */}
    <section className="px-6 pt-20 pb-20 md:pt-28 md:pb-28 border-b border-white/10">
      <div className="max-w-4xl mx-auto text-center">
        <span className="font-sans font-bold text-landing-primary text-xs md:text-sm uppercase tracking-[0.3em] block mb-6">
          The Yureka Manifesto
        </span>
        <h1
          className="font-sans text-white text-4xl sm:text-6xl md:text-7xl font-black leading-[1.05] tracking-tight mb-10"
        >
          Spend. <span className="text-white/40">Accumulate.</span> <span className="font-cooper text-landing-primary">Evolve.</span>
        </h1>
        <div className="font-sans text-white text-base md:text-xl leading-relaxed max-w-2xl mx-auto space-y-6">
          <p>
            The legacy financial system was designed for the passive consumer. fragmented, opaque, and built to keep your capital idle.
          </p>
          <p className="text-white font-semibold">We are here to rewrite the narrative.</p>
          <p>
            Yureka.One is not merely a platform; it is a financial operating system built for those who understand that every transaction is an opportunity to build wealth.
          </p>
        </div>
      </div>
    </section>

    {/* Core Pillars */}
    <section className="px-6 py-20 md:py-28 border-b border-white/10">
      <div className="max-w-5xl mx-auto">
        <h2
          className="font-sans text-white text-3xl md:text-4xl font-extrabold mb-12 md:mb-16 text-center uppercase tracking-tight"
        >
          Our Core Pillars
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {pillars.map((p) => (
            <div key={p.num} className="bg-white/[0.03] border border-white/10 rounded-2xl p-8 md:p-10 flex flex-col">
              <span className="font-mono text-landing-primary font-bold text-sm tracking-widest mb-6">{p.num}</span>
              <h3
                className="font-sans text-white text-2xl font-bold leading-snug tracking-tight mb-4"
              >
                {p.title}
              </h3>
              <p className="font-sans text-white text-base leading-relaxed">{p.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* The Paradigm Shift */}
    <section className="px-6 py-20 md:py-28 border-b border-white/10 bg-black/60">
      <div className="max-w-3xl mx-auto text-center">
        <span className="font-sans font-bold text-landing-primary text-xs md:text-sm uppercase tracking-[0.3em] block mb-8">
          The Paradigm Shift
        </span>
        <div className="font-sans text-white text-lg md:text-2xl leading-relaxed space-y-7">
          <p>
            For decades, the financial status quo has been simple: you earn returns only on what you actively set aside to invest.
          </p>
          <p className="font-sans text-white text-2xl md:text-4xl font-black tracking-tight">
            We have inverted this model.
          </p>
          <p>
            With Yureka, your daily life is your greatest investment. You now earn as you spend. without the need for tedious roundups, unnecessary consumption, or additional financial friction.
          </p>
          <p>
            It is a frictionless wealth-building cycle designed for the power shopper. This is not just a feature; it is the{' '}
            <span className="text-landing-primary font-bold">Yureka Moment</span> we have all been waiting for.
          </p>
        </div>
      </div>
    </section>

    {/* Our Commitment + closing */}
    <section className="px-6 py-24 md:py-32">
      <div className="max-w-2xl mx-auto text-center">
        <span className="font-sans font-bold text-landing-primary text-xs md:text-sm uppercase tracking-[0.3em] block mb-8">
          Our Commitment
        </span>
        <p className="font-sans text-white text-base md:text-xl leading-relaxed mb-16">
          We are bridging the divide between commerce and asset growth. We are providing the infrastructure for a new generation to take command of their financial agency.
        </p>

        <p className="font-cooper text-white/50 text-xl md:text-2xl mb-3">This is the evolution of money.</p>
        <h2
          className="font-sans text-white text-4xl sm:text-6xl md:text-7xl font-black uppercase tracking-tight mb-12"
        >
          Welcome to <span className="font-cooper text-landing-primary">Yureka</span>.
        </h2>

        <button className="inline-flex items-center gap-3 bg-landing-primary text-landing-ink text-base md:text-lg font-bold pl-7 pr-3 py-3 rounded-full hover:brightness-110 shadow-lg shadow-landing-primary/20 transition-all duration-200">
          <span>Join the Waitlist</span>
          <span className="bg-black text-white rounded-full p-2">
            <ArrowRight className="w-4 h-4 text-landing-primary" />
          </span>
        </button>
      </div>
    </section>

  </div>
);

export default Manifesto;

import React from 'react';

const PARTNERS = [
  { name: 'American Express', logo: 'https://upload.wikimedia.org/wikipedia/commons/f/fa/American_Express_logo_%282018%29.svg' },
  { name: 'SBI',              logo: 'https://upload.wikimedia.org/wikipedia/commons/c/cc/SBI-logo.svg' },
  { name: 'Axis Bank',        logo: 'https://upload.wikimedia.org/wikipedia/commons/1/1a/Axis_Bank_logo.svg' },
  { name: 'Marriott Bonvoy',  logo: 'https://upload.wikimedia.org/wikipedia/commons/7/73/Marriott_Bonvoy_logo.svg' },
  { name: 'Amazon',           logo: 'https://upload.wikimedia.org/wikipedia/commons/a/a9/Amazon_logo.svg' },
];

// Duplicate enough times so the strip feels endless
const ITEMS = [...PARTNERS, ...PARTNERS, ...PARTNERS, ...PARTNERS];

const PartnerLogos: React.FC = () => (
  <div className="w-full bg-cream py-12 overflow-hidden relative">
    <div className="max-w-4xl mx-auto px-6">
      <div className="relative bg-white/[0.08] backdrop-blur-3xl border border-white/20 rounded-full px-12 py-5 shadow-[0_0_40px_rgba(255,255,255,0.05),0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden">
        {/* Shine effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.05] to-transparent -translate-x-full animate-[shimmer_4s_infinite]" />
    {/* Fade edges */}
        <div
          className="relative overflow-hidden"
          style={{
            WebkitMaskImage:
              'linear-gradient(to right, transparent 0%, black 15%, black 85%, transparent 100%)',
            maskImage:
              'linear-gradient(to right, transparent 0%, black 15%, black 85%, transparent 100%)',
          }}
        >
      <div
        className="flex items-center gap-16 whitespace-nowrap animate-marquee w-max"
        style={{ animationDuration: '38s' }}
      >
        {ITEMS.map((p, i) => (
          <div
            key={i}
            className="inline-flex items-center justify-center h-8 px-4 shrink-0"
          >
            <img
              src={p.logo}
              alt={p.name}
              className="h-full w-auto object-contain brightness-0 invert opacity-60 hover:opacity-100 transition-all duration-500 max-w-[120px] hover:scale-110"
              onError={(e) => {
                const el = e.target as HTMLImageElement;
                el.style.display = 'none';
                const span = document.createElement('span');
                span.className =
                  'text-white/80 text-xs font-bold uppercase tracking-wider';
                span.textContent = p.name;
                el.parentElement?.appendChild(span);
              }}
            />
          </div>
        ))}
          </div>
        </div>
      </div>
    </div>

    {/* Caption */}
    <p className="text-center text-white/30 text-[9px] font-bold uppercase tracking-[0.4em] mt-6">
      Institutional Partners
    </p>
  </div>
);

export default PartnerLogos;

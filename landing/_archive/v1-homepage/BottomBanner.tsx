import React from 'react';

const messages = [
  "Yureka AI: Your conversational card match.",
  "Yureka+: Chrome extension for checkout savings.",
  "Voucher Hub: Save 2-10% on 500+ brands.",
  "NPA Settlement: Expert debt resolution help.",
  "Bill Pay: One-tap utility payments.",
  "VIP Access: Join the waitlist for Q2 2026."
];

const BottomBanner: React.FC = () => {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-[60] h-8 bg-clay flex items-center overflow-hidden border-t border-black/10">
      <div className="flex whitespace-nowrap animate-marquee w-max" style={{ animationDuration: '80s' }}>
        {[...Array(4)].map((_, setIndex) => (
            <React.Fragment key={setIndex}>
                {messages.map((msg, i) => (
                    <div key={`${setIndex}-${i}`} className="flex items-center border-r border-black/20 h-full">
                        <span className="text-[10px] font-black text-black uppercase tracking-widest px-6 py-1">
                            {msg}
                        </span>
                    </div>
                ))}
            </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export default BottomBanner;
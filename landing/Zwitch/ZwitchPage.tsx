import React from 'react';
import Hero from './Hero';
import Work from './Work';
import About from './About';
import { useEffect } from 'react';

const ZwitchPage: React.FC = () => {
  // Dynamically load Google Font "Outfit"
  useEffect(() => {
    const fontId = 'google-font-outfit';
    if (!document.getElementById(fontId)) {
      const link = document.createElement('link');
      link.id = fontId;
      link.href = 'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap';
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
  }, []);

  return (
    <div className="w-full min-h-screen bg-black text-white selection:bg-blue-500/30 font-['Outfit',sans-serif]">
      {/* Global glassmorphism ambient glow background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-[#00f0ff]/5 blur-[160px] rounded-full" />
        <div className="absolute bottom-1/3 right-1/4 w-[400px] h-[400px] bg-[#b026ff]/5 blur-[140px] rounded-full" />
        <div className="absolute top-2/3 left-1/3 w-[300px] h-[300px] bg-white/3 blur-[120px] rounded-full" />
      </div>

      <main className="relative z-10 w-full flex flex-col gap-4 pb-4 px-2 sm:px-4 md:px-6">

        {/* Hero. full-bleed rounded glass card */}
        <div className="rounded-3xl overflow-hidden ring-1 ring-white/10 shadow-[0_0_80px_rgba(0,0,0,0.8)]">
          <Hero />
        </div>

        {/* Partnered Brands section. glass card */}
        <div className="rounded-3xl overflow-hidden ring-1 ring-white/10 backdrop-blur-sm bg-white/[0.03] shadow-[0_0_60px_rgba(0,0,0,0.6)]">
          <Work />
        </div>

        {/* About / Philosophy section. glass card */}
        <div className="rounded-3xl overflow-hidden ring-1 ring-white/10 backdrop-blur-sm bg-white/[0.03] shadow-[0_0_60px_rgba(0,0,0,0.6)]">
          <About />
        </div>

      </main>
    </div>
  );
};

export default ZwitchPage;

import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight, Briefcase } from 'lucide-react';
import ImageWithLoader from '@shared/ImageWithLoader';
import SEO from '@shared/SEO';
import { staticPageMeta } from '@backend/lib/seo/pageMeta';
import { jobPostingSchema } from '@backend/lib/seo/structuredData';
import { CAREER_ROLES } from '@landing/careersData';

interface FadeInSectionProps {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}

const FadeInSection: React.FC<FadeInSectionProps> = ({ children, delay = 0, className = '' }) => {
  const [isVisible, setIsVisible] = useState(false);
  const domRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) setIsVisible(true);
      });
    }, { threshold: 0.1 });
    const current = domRef.current;
    if (current) observer.observe(current);
    return () => {
        if(current) observer.unobserve(current);
    }
  }, []);

  return (
    <div
      ref={domRef}
      className={`transition-all duration-1000 ease-[cubic-bezier(0.25,0.8,0.25,1)] transform ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-20'
      } ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
};

const roles = CAREER_ROLES;

const CareersPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-cream pt-4 md:pt-8 pb-20 font-sans text-white overflow-x-hidden selection:bg-clay selection:text-cream">
      <SEO {...staticPageMeta['/jobs']} schema={CAREER_ROLES.map(jobPostingSchema)} />

      <div className="max-w-[1440px] mx-auto px-6 relative z-10">
        
        {/* Header - Classifieds Style */}
        <section className="mb-20 text-center border-b-4 border-white pb-8">
            <FadeInSection>
                <h1 className="text-4xl md:text-6xl font-heading font-extrabold uppercase tracking-tight mb-2 text-white">Help Wanted</h1>
                <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-white/30 border-t border-white/10 pt-4 mt-4">
                    <span>Section D: Employment</span>
                    <span>Bengaluru HQ</span>
                    <span>Equal Opportunity</span>
                </div>
            </FadeInSection>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            
            {/* Sidebar - Context */}
            <div className="lg:col-span-4">
                <FadeInSection>
                    <div className="bg-white/5 border border-white/10 p-8 mb-8 shadow-sm rounded-3xl backdrop-blur-sm">
                        <h3 className="text-2xl font-serif mb-4 text-clay italic">Why join?</h3>
                        <p className="text-white/60 leading-relaxed mb-6">
                            We are a team of misfits building the future of credit. If you think the banking system is broken, come help us fix it with AI.
                        </p>
                        <ul className="space-y-3 text-sm font-mono text-white/80">
                            <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-clay rounded-full shadow-[0_0_8px_#00933b]"></div> High Autonomy</li>
                            <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-clay rounded-full shadow-[0_0_8px_#00933b]"></div> Competitive Equity</li>
                            <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-clay rounded-full shadow-[0_0_8px_#00933b]"></div> Beautiful Office</li>
                        </ul>
                    </div>
                    
                    <div className="p-2 border border-white/10 bg-white/5 rotate-1 w-full max-w-[300px] mx-auto lg:mx-0 shadow-2xl rounded-2xl overflow-hidden">
                         <div className="aspect-square bg-gray-900 grayscale">
                            <ImageWithLoader src="https://images.unsplash.com/photo-1600880292203-757bb62b4baf?auto=format&fit=crop&q=80&w=800" alt="Office" className="w-full h-full object-cover opacity-60" />
                         </div>
                         <p className="text-white/40 text-center font-serif text-sm mt-2">Fig 1: The HQ</p>
                    </div>
                </FadeInSection>
            </div>

            {/* Job List - Table Style */}
            <div className="lg:col-span-8">
                <div className="border border-white/10 bg-white/5 shadow-sm rounded-3xl overflow-hidden backdrop-blur-sm">
                    <div className="hidden md:grid grid-cols-12 border-b border-white/10 bg-white/5 text-[10px] font-bold uppercase tracking-widest py-4 px-6 text-white/40">
                        <div className="col-span-2">Ref ID</div>
                        <div className="col-span-5">Position</div>
                        <div className="col-span-3">Department</div>
                        <div className="col-span-2 text-right">Action</div>
                    </div>
                    
                    {roles.map((role, idx) => (
                        <FadeInSection key={idx} delay={idx * 50}>
                            <div className="flex flex-col md:grid md:grid-cols-12 border-b border-white/5 hover:bg-clay hover:text-cream transition-all duration-300 py-8 px-6 md:items-center group cursor-pointer text-white">
                                <div className="md:col-span-2 font-mono text-xs opacity-50 mb-2 md:mb-0 group-hover:text-cream/60">{role.id}</div>
                                <div className="md:col-span-5 mb-4 md:mb-0">
                                    <h3 className="text-xl font-heading font-extrabold group-hover:text-cream">{role.title}</h3>
                                    <span className="text-[10px] uppercase tracking-widest opacity-40 group-hover:opacity-60">{role.location} • {role.type}</span>
                                </div>
                                <div className="md:col-span-3 text-[11px] font-bold uppercase tracking-widest opacity-60 group-hover:opacity-100">{role.dept}</div>
                                <div className="md:col-span-2 text-left md:text-right">
                                    <button className="w-10 h-10 border border-white/20 group-hover:border-cream/20 rounded-full flex items-center justify-center md:ml-auto group-hover:rotate-45 transition-transform">
                                        <ArrowUpRight size={16} />
                                    </button>
                                </div>
                            </div>
                        </FadeInSection>
                    ))}
                </div>
                
                <div className="mt-12 text-center p-12 border border-dashed border-white/10 rounded-3xl bg-white/5 backdrop-blur-sm">
                    <p className="text-white/40 mb-4 uppercase tracking-[0.3em] text-[10px] font-bold">Don't see your role?</p>
                    <a href="mailto:support@yureka.one" className="text-clay font-serif italic text-2xl underline hover:text-white transition-colors decoration-1 underline-offset-8">Email the Editor</a>
                </div>
            </div>

        </div>

      </div>
    </div>
  );
};

export default CareersPage;
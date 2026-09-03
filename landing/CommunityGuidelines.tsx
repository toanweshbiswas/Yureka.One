import React, { useEffect } from 'react';
import { Shield, ChevronRight } from 'lucide-react';
import SEO from '@shared/SEO';
import { staticPageMeta } from '@backend/lib/seo/pageMeta';

const CommunityGuidelines: React.FC = () => {
    // Scroll to top on mount
    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    return (
        <div className="bg-landing-bg min-h-screen text-white pb-32 selection:bg-landing-primary selection:text-landing-ink">
            <SEO {...staticPageMeta['/community-guidelines']} />
            {/* Header Section */}
            <div className="pt-6 md:pt-16 pb-16 md:pb-24 border-b border-white/10 px-6">
                <div className="max-w-4xl mx-auto">
                    <div className="flex items-center gap-2 text-landing-primary mb-6">
                        <Shield size={18} strokeWidth={2.5} />
                        <span className="text-[10px] font-bold uppercase tracking-[0.4em]">Legal Compendium</span>
                    </div>
                    <h1 className="text-5xl md:text-8xl font-sans font-black leading-[0.9] tracking-tighter mb-8 uppercase text-white">
                        Community Guidelines
                    </h1>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <p className="text-xl md:text-2xl font-sans text-white/70">
                            Rules of engagement for the Yureka financial club.
                        </p>
                        <div className="text-left md:text-right">
                            <p className="text-[10px] uppercase tracking-widest font-bold text-white/40">Effective Date</p>
                            <p className="text-sm font-mono mt-1 text-landing-primary border-b border-landing-primary/20 inline-block pb-1">April 2026</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content Section */}
            <div className="max-w-4xl mx-auto px-6 pt-16 md:pt-24 font-sans text-lg md:text-xl leading-relaxed text-white/80 space-y-16">
                
                <section>
                    <p className="first-letter:text-6xl first-letter:font-black first-letter:text-landing-primary first-letter:mr-2 first-letter:float-left first-letter:mt-1">
                        Yureka.One is more than a platform; it is an exclusive club of financial strategists, reward optimizers, and high-net-worth analysts. We demand a high standard of discourse. Our community is built on a foundation of mutual respect, tactical intelligence, and strict adherence to truth.
                    </p>
                    <p className="mt-6">
                        By participating on the Yureka platform, whether in waitlist forums, user reviews, or interactions with the Yureka AI, you agree unequivocally to the following tenets of behavior.
                    </p>
                </section>

                <section className="space-y-6">
                    <h2 className="text-3xl font-sans font-extrabold uppercase tracking-tight text-white border-b-2 border-white/10 pb-4">1. Elevate the Discourse</h2>
                    <p>
                        We cater to those who treat credit strategy as a science. Your contributions should reflect this.
                    </p>
                    <ul className="space-y-4 list-none pl-0">
                        <li className="pl-6 relative">
                            <span className="absolute left-0 top-1 text-landing-primary font-bold">&bull;</span>
                            <strong className="text-white tracking-tight uppercase text-sm mr-2 font-sans">Substantive Value:</strong> Before posting a review or a strategy, ask yourself if it adds verifiable, tactical value to the community.
                        </li>
                        <li className="pl-6 relative">
                            <span className="absolute left-0 top-1 text-landing-primary font-bold">&bull;</span>
                            <strong className="text-white tracking-tight uppercase text-sm mr-2 font-sans">Factual Accuracy:</strong> Speculation regarding RBI regulations, bank terms, or credit scoring algorithms must be clearly marked as such. Do not present financial rumors as fact.
                        </li>
                        <li className="pl-6 relative">
                            <span className="absolute left-0 top-1 text-landing-primary font-bold">&bull;</span>
                            <strong className="text-white tracking-tight uppercase text-sm mr-2 font-sans">Professionalism:</strong> Engaging in ad hominem attacks, trolling, or aggressive debate diminishes the quality of our collective intelligence and will not be tolerated.
                        </li>
                    </ul>
                </section>

                <section className="space-y-6">
                    <h2 className="text-3xl font-sans font-extrabold uppercase tracking-tight text-white border-b-2 border-white/10 pb-4">2. Zero Tolerance for Scams &amp; Solicitation</h2>
                    <p>
                        Yureka.One is a sanctuary from the noise of predatory financial products and unauthorized financial advisors.
                    </p>
                    <div className="bg-white/[0.03] text-white/80 p-8 mt-6 shadow-2xl relative overflow-hidden border border-white/5 backdrop-blur-md rounded-2xl">
                        <span className="absolute top-0 left-0 w-1 h-full bg-landing-primary"></span>
                        <p className="font-sans text-sm tracking-wide leading-relaxed">
                            Users offering unauthorized financial advice, attempting to sell third-party services, peddling crypto-schemes, or asking for compensation in exchange for "insider" credit strategies will face immediate, permanent account termination.
                        </p>
                    </div>
                </section>

                <section className="space-y-6">
                    <h2 className="text-3xl font-sans font-extrabold uppercase tracking-tight text-white border-b-2 border-white/10 pb-4">3. Protection of Confidentiality</h2>
                    <p>
                        Our platform integrates deeply with personal financial data. Respecting this boundary is non-negotiable.
                    </p>
                    <ul className="list-decimal pl-8 space-y-4 font-mono text-xs tracking-widest bg-white/[0.02] p-8 md:p-10 border border-white/5 rounded-2xl text-white/50">
                        <li>Do not post your full credit card numbers, CVVs, or OTPs anywhere on the community forums or reviews.</li>
                        <li>Do not ask other users for their sensitive financial data.</li>
                        <li>Respect the privacy of our analysts and staff; do not attempt to contact them outside of designated support channels.</li>
                    </ul>
                </section>

                <section className="space-y-6">
                    <h2 className="text-3xl font-sans font-extrabold uppercase tracking-tight text-white border-b-2 border-white/10 pb-4">4. Integrity of Review Data</h2>
                    <p>
                        Our Card Explorer relies on the honesty of the Yureka club. When leaving reviews for credit instruments or banks:
                    </p>
                    <ul className="space-y-4 list-none pl-0">
                        <li className="pl-6 relative">
                            <span className="absolute left-0 top-1 text-landing-primary font-bold">&bull;</span>
                            <strong className="text-white tracking-tight uppercase text-sm mr-2 font-sans">Be Authentic:</strong> Do not submit fake reviews to artificially inflate or deflate a financial product's standing.
                        </li>
                        <li className="pl-6 relative">
                            <span className="absolute left-0 top-1 text-landing-primary font-bold">&bull;</span>
                            <strong className="text-white tracking-tight uppercase text-sm mr-2 font-sans">Disclose Bias:</strong> If you are employed by an issuing bank or networked entity, you must disclose this when discussing competitor products.
                        </li>
                    </ul>
                </section>

                <section className="border-t-4 border-white/10 pt-16 mt-16 text-center space-y-8">
                     <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-white/40 leading-relaxed max-w-2xl mx-auto">
                         Enforcement: The Yureka Moderation Team reserves the right to remove content, issue warnings, or revoke club access at our sole discretion for any violation of these guidelines.
                     </p>
                     
                     <div className="pt-8">
                         <h3 className="text-2xl font-sans font-extrabold uppercase tracking-tight text-white mb-4">See a Violation?</h3>
                         <p className="text-white/60 mb-10 max-w-md mx-auto">If you witness behavior that violates these principles, please report it immediately to our security desk.</p>
                         <a href="mailto:support@yureka.one" className="inline-flex items-center gap-4 bg-landing-primary text-landing-ink px-10 py-5 rounded-2xl font-bold uppercase tracking-widest text-[10px] hover:brightness-110 shadow-lg shadow-landing-primary/20 transition-all">
                             Report Violation <ChevronRight size={14} />
                         </a>
                     </div>
                </section>

            </div>
            
            <div className="max-w-4xl mx-auto px-6 mt-24 flex items-center justify-center gap-4 text-[10px] font-bold uppercase tracking-[0.4em] text-white/10">
                <span>Brand Name: Yureka.One</span>
                <span className="opacity-20">•</span>
                <span>Club Regulations</span>
            </div>
        </div>
    );
};

export default CommunityGuidelines;

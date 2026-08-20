import React, { useEffect } from 'react';
import { Shield, ChevronRight, Lock, EyeOff, ShieldCheck, Cpu, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';
import SEO from '@shared/SEO';
import { staticPageMeta } from '@backend/lib/seo/pageMeta';

const SecurityProtocolPage: React.FC = () => {
    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    return (
        <div className="bg-cream min-h-screen text-[#e5e5e5] pb-32 selection:bg-clay selection:text-cream">
            <SEO {...staticPageMeta['/security-protocol']} />

            {/* ── HERO ── */}
            <div className="relative pt-24 md:pt-40 pb-20 border-b border-white/5 overflow-hidden">
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h100v100H0V0zm1 1v98h98V1H1z' fill='%23fff'/%3E%3C/svg%3E")` }} 
                />
                
                <div className="max-w-[1200px] mx-auto px-6 relative z-10">
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
                        <div className="flex items-center gap-3 text-clay mb-8">
                            <Shield size={18} />
                            <span className="text-[10px] font-bold uppercase tracking-[0.4em]">Infrastructure Desk</span>
                        </div>
                        <h1 className="text-6xl md:text-8xl font-heading font-extrabold tracking-tighter text-white leading-[0.9] mb-12 uppercase">
                            Security <br /><span className="text-clay italic font-serif font-light">Protocol.</span>
                        </h1>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 pt-10 border-t border-white/5">
                            <p className="text-xl md:text-2xl font-serif italic text-white/50 leading-relaxed">
                                The architecture of financial privacy. Our system is designed so that even we cannot see your raw data.
                            </p>
                            <div className="flex flex-col justify-end items-start md:items-end gap-2">
                                <p className="text-[10px] uppercase tracking-widest font-bold text-white/20">Protocol Revision</p>
                                <p className="text-[10px] font-bold tracking-widest text-clay bg-clay/5 px-4 py-2 rounded-full border border-clay/20 uppercase">v4.0.1_STABLE</p>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </div>

            {/* ── CONTENT ── */}
            <div className="max-w-[800px] mx-auto px-6 mt-20 md:mt-32">
                <article className="space-y-24">
                    
                    {/* Intro */}
                    <section>
                        <p className="text-2xl md:text-3xl font-serif italic text-white/80 leading-relaxed">
                            At Yureka.One, we recognize that financial data is your most sensitive asset. Our architecture is built upon a simple, unwavering philosophy: <span className="text-white font-bold not-italic">Your financial data is none of our business.</span>
                        </p>
                        <p className="mt-8 text-white/40 leading-relaxed font-medium">
                            This document details the cryptographic standards, network architecture, and compliance frameworks utilized to ensure the absolute isolation and integrity of your data within the Yureka Neural Engine.
                        </p>
                    </section>

                    {/* Section 1 */}
                    <section className="space-y-10">
                        <div className="flex items-center gap-4 group">
                            <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center text-clay group-hover:scale-110 transition-transform">
                                <Lock size={20} />
                            </div>
                            <h2 className="text-2xl font-heading font-extrabold uppercase tracking-tight text-white">01. Cryptographic Standards</h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="bg-white/[0.02] border border-white/5 p-8 rounded-[2.5rem] space-y-4 backdrop-blur-md">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-clay">Data At Rest</p>
                                <p className="text-sm text-white/40 leading-relaxed font-medium">
                                    All databases are encrypted using the <strong className="text-white">AES-256-GCM</strong> standard. Sensitive identifiers are additionally hashed using <strong className="text-white">Argon2id</strong> before persistent storage.
                                </p>
                            </div>
                            <div className="bg-white/[0.02] border border-white/5 p-8 rounded-[2.5rem] space-y-4 backdrop-blur-md">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-clay">Data In Transit</p>
                                <p className="text-sm text-white/40 leading-relaxed font-medium">
                                    Communications between the client and our servers are secured via <strong className="text-white">TLS 1.3</strong>, utilizing <strong className="text-white">Perfect Forward Secrecy (PFS)</strong> to ensure past traffic remains secure.
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* Section 2 */}
                    <section className="space-y-10">
                        <div className="flex items-center gap-4 group">
                            <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center text-clay group-hover:scale-110 transition-transform">
                                <EyeOff size={20} />
                            </div>
                            <h2 className="text-2xl font-heading font-extrabold uppercase tracking-tight text-white">02. Zero-Knowledge Logic</h2>
                        </div>
                        <div className="relative p-10 bg-white/[0.03] rounded-[3rem] border border-white/10 overflow-hidden backdrop-blur-xl">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-clay/10 blur-3xl rounded-full" />
                            <p className="text-lg md:text-xl font-serif italic text-white/70 leading-relaxed relative z-10">
                                Our proprietary analytics engine processes credit card statements directly in a <span className="text-clay font-bold not-italic uppercase tracking-widest text-xs ml-1">Secure Ephemeral Container</span>. Once the reward extraction logic is complete, the raw statement data is permanently purged from active memory.
                            </p>
                            <div className="mt-8 flex items-center gap-4 text-[10px] font-bold uppercase tracking-[0.4em] text-clay">
                                <Cpu size={14} className="animate-pulse" />
                                <span>Memory-Level Isolation Enabled</span>
                            </div>
                        </div>
                    </section>

                    {/* Section 3 */}
                    <section className="space-y-10">
                        <div className="flex items-center gap-4 group">
                            <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center text-clay group-hover:scale-110 transition-transform">
                                <ShieldCheck size={20} />
                            </div>
                            <h2 className="text-2xl font-heading font-extrabold uppercase tracking-tight text-white">03. DPDP Compliance</h2>
                        </div>
                        <div className="space-y-6">
                            <p className="text-white/40 leading-relaxed font-medium">Pursuant to the Digital Personal Data Protection (DPDP) Rules, Yureka.One implements rigorous security safeguards:</p>
                            <div className="grid gap-4">
                                {[
                                    { title: 'Access Control', desc: 'Database clusters reside in private VPC subnets with MFA-only VPN tunnels.' },
                                    { title: 'Intrusion Detection', desc: 'Real-time automated monitoring for anomalous traffic patterns.' },
                                    { title: 'Rapid Response', desc: 'Incident response protocol with a 72-hour notification mandate.' }
                                ].map((item, i) => (
                                    <div key={i} className="flex gap-6 p-6 bg-white/[0.03] border border-white/5 rounded-2xl items-start group hover:border-clay/20 transition-all">
                                        <span className="text-clay font-mono text-xs pt-1 font-bold">0{i+1}.</span>
                                        <div>
                                            <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-white mb-1 group-hover:text-clay transition-colors">{item.title}</h4>
                                            <p className="text-sm text-white/40 leading-relaxed font-medium">{item.desc}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>

                    {/* Reporting */}
                    <section className="pt-16 border-t border-white/10 text-center">
                        <AlertCircle className="mx-auto text-[#00933b]/50 mb-8" size={40} />
                        <h2 className="text-3xl font-heading font-extrabold text-white uppercase tracking-tight mb-4">Report an Incident</h2>
                        <p className="text-white/40 font-serif italic mb-10 max-w-md mx-auto">
                            If you believe you have discovered a vulnerability or suspect your account has been compromised, contact our InfoSec team immediately.
                        </p>
                        <a href="mailto:support@yureka.one" className="inline-flex items-center gap-4 bg-clay text-cream px-12 py-5 rounded-2xl font-bold uppercase tracking-[0.2em] text-[10px] hover:bg-white transition-all shadow-2xl shadow-clay/10">
                            Contact InfoSec <ChevronRight size={14} />
                        </a>
                    </section>

                </article>
            </div>

            {/* Footer Tag */}
            <div className="max-w-[1200px] mx-auto px-6 mt-32 pt-12 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 text-[10px] font-bold uppercase tracking-[0.4em] text-white/10">
                <span>Yureka.One Security Command</span>
                <span className="hidden md:block opacity-20">•</span>
                <span>Audit Level: High-Assurance</span>
            </div>
        </div>
    );
};

export default SecurityProtocolPage;

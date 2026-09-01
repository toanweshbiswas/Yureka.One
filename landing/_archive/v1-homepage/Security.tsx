import React, { useRef, useState, useEffect } from 'react';
import { Lock, ShieldCheck, Award, EyeOff } from 'lucide-react';
import { motion, useInView, AnimatePresence } from 'motion/react';

const EncryptedText: React.FC<{ text: string }> = ({ text }) => {
    const [display, setDisplay] = useState(text);
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+";

    useEffect(() => {
        const interval = setInterval(() => {
            setDisplay(prev => 
                prev.split('').map((char, i) => {
                    if (char === ' ') return ' ';
                    // Higher frequency of cycling for the "live" feel
                    if (Math.random() > 0.7) return chars[Math.floor(Math.random() * chars.length)];
                    return char;
                }).join('')
            );
        }, 80); // Faster cycle
        return () => clearInterval(interval);
    }, [text]);

    return <span className="font-mono">{display}</span>;
}

const Security: React.FC = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const isInView = useInView(containerRef, { once: true, margin: "-100px" });

    const features = [
        {
            title: "Bank-grade encryption",
            desc: "Every transaction and data is encrypted and protected from unauthorized access.",
            icon: <ShieldCheck className="text-[#00933b]" size={24} />
        },
        {
            title: "RBI-compliant",
            desc: "Aligned processes and policies so payments are handled with high security.",
            icon: <Award className="text-[#00933b]" size={24} />
        },
        {
            title: "No snooping around",
            desc: "Your data belongs to only you. We don't peek, track, or sell your information.",
            icon: <EyeOff className="text-[#00933b]" size={24} />
        }
    ];

    return (
        <section className="bg-black relative flex flex-col items-center justify-center overflow-hidden w-full py-24 px-6">
            
            <div className="w-full max-w-7xl relative z-10">
                
                {/* Confidential Stamp Header (Editorial Anchor) */}
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={isInView ? { opacity: 1, y: 0 } : {}}
                    className="flex justify-between items-end border-b border-white/10 mb-12 pb-6"
                >
                    <div>
                        <div className="flex items-center gap-2 text-clay mb-3">
                             <Lock size={14} strokeWidth={2.5} />
                             <span className="text-[10px] font-bold uppercase tracking-[0.4em]">Privacy Standards</span>
                        </div>
                        <h2 className="text-4xl md:text-5xl lg:text-6xl font-heading font-extrabold text-white uppercase tracking-tighter leading-none">Confidential</h2>
                    </div>
                    <div className="hidden md:block text-right mb-1">
                         <p className="text-[9px] font-bold text-white/30 uppercase tracking-[0.3em] mb-1">DOC. REF: YR-884-X</p>
                         <p className="text-[9px] font-bold text-clay uppercase tracking-[0.3em] leading-none">SECURITY: TRIPLE-LAYER AES</p>
                    </div>
                </motion.div>

                {/* MAIN VAULT PANEL */}
                <motion.div 
                    ref={containerRef}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={isInView ? { opacity: 1, scale: 1 } : {}}
                    transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
                    className="relative glass-dark glass-shine-container rounded-[2.5rem] md:rounded-[4rem] overflow-visible shadow-2xl p-8 md:p-16 lg:p-24"
                >
                    {/* Atmospheric background detail */}
                    <div className="absolute inset-0 opacity-[0.03] bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#00933b]/[0.02] to-[#00933b]/[0.05]" />

                    <div className="relative z-10 text-center">
                        <h3 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white tracking-tight leading-tight mb-16 uppercase italic">
                            Your data is <span className="text-[#00933b]">locked</span> <br className="hidden md:block" />
                            <span className="text-[#00933b] font-light">away</span>, even from us
                        </h3>

                        {/* PERFECTED SCANNING CARD GRAPHIC */}
                        <div className="relative h-[250px] md:h-[350px] w-full max-w-4xl mx-auto mb-16 flex items-center justify-center">
                            
                            {/* BASE CONTAINER (Defines the card area) */}
                            <div className="relative w-[300px] h-[180px] md:w-[480px] md:h-[280px]">
                                
                                {/* LAYER 1: THE ENCRYPTED VAULT (Bottom Layer) */}
                                <div className="absolute inset-0 bg-[#050505] rounded-2xl border border-[#00933b]/20 overflow-hidden shadow-[inset_0_0_50px_rgba(0,0,0,1)]">
                                    {/* Terminal Background */}
                                    <div className="absolute inset-0 flex flex-col p-6 opacity-80">
                                        <div className="flex justify-between items-center mb-6">
                                            <div className="text-[10px] md:text-[12px] font-mono text-[#00933b]/40 tracking-[0.3em] uppercase">SECURE_CARD_ID</div>
                                            <div className="flex gap-1.5">
                                                <div className="w-1.5 h-1.5 rounded-full bg-[#00933b] animate-pulse" />
                                                <div className="w-1.5 h-1.5 rounded-full bg-[#00933b]/10" />
                                            </div>
                                        </div>

                                        {/* STREAMING HEX DATA FEED */}
                                        <div className="absolute left-0 top-0 bottom-0 w-1/3 opacity-[0.05] pointer-events-none overflow-hidden select-none">
                                            <motion.div 
                                                animate={{ y: [0, -1000] }}
                                                transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
                                                className="flex flex-col gap-1.5 p-4"
                                            >
                                                {[...Array(100)].map((_, i) => (
                                                    <div key={i} className="text-[8px] font-mono text-[#00933b] whitespace-nowrap">
                                                        {Math.random().toString(16).slice(2, 24).toUpperCase()}
                                                    </div>
                                                ))}
                                            </motion.div>
                                        </div>

                                        <div className="space-y-3 opacity-60 overflow-hidden relative z-10">
                                            <div className="flex gap-3 whitespace-nowrap items-center mb-4">
                                                <div className="w-2 h-2 rounded-sm bg-[#00933b] animate-ping" />
                                                <span className="text-[12px] md:text-[14px] font-mono font-bold text-[#00933b] tracking-wider">
                                                    YUREKA<span className="opacity-30">.</span>SAFEGUARD
                                                </span>
                                            </div>

                                            {[...Array(4)].map((_, i) => (
                                                <div key={i} className="flex gap-3 whitespace-nowrap items-center">
                                                    <div className="w-1 h-4 bg-[#00933b]/10" />
                                                    <span className="text-[10px] font-mono text-[#00933b]/80">
                                                        [0x<EncryptedText text={i === 0 ? "SHIELD" : Math.random().toString(16).slice(2, 6).toUpperCase()} />]
                                                    </span>
                                                    <span className="text-[9px] font-mono text-[#00933b]/10">{" -> "} ENCRYPT_LAYER_{i + 1}</span>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="text-2xl md:text-4xl font-mono text-[#00933b] drop-shadow-[0_0_20px_rgba(0,147,59,0.3)] tracking-[0.25em] relative z-10 mt-auto border-l-4 border-[#00933b]/30 pl-6 py-2 bg-[#00933b]/[0.03]">
                                            <EncryptedText text="**** **** **** 0000" />
                                        </div>
                                    </div>
                                    
                                    {/* INTERFERENCE PULSE */}
                                    <motion.div 
                                        animate={{ 
                                            y: ['-100%', '300%'],
                                            opacity: [0, 0.2, 0]
                                        }}
                                        transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                                        className="absolute inset-x-0 h-24 bg-gradient-to-b from-transparent via-[#00933b]/30 to-transparent pointer-events-none z-10"
                                    />
                                </div>

                                {/* LAYER 2: THE WHITE CARD (Top Layer with Animated Clip-Path) */}
                                <motion.div 
                                    initial={{ clipPath: 'inset(0 0 0 0%)' }}
                                    animate={isInView ? { clipPath: 'inset(0 0 0 100%)' } : { clipPath: 'inset(0 0 0 0%)' }}
                                    transition={{ 
                                        delay: 1.5, 
                                        duration: 3.5, 
                                        ease: "easeInOut",
                                        repeat: Infinity,
                                        repeatDelay: 2.5
                                    }}
                                    className="absolute inset-0 bg-white rounded-2xl shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] border border-white/20 z-20 pointer-events-none"
                                >
                                    <div className="p-8 md:p-12 h-full flex flex-col justify-between">
                                        <div className="flex justify-between items-start">
                                            <div className="w-12 h-10 md:w-16 md:h-12 bg-gray-50 rounded-lg border border-gray-100 shadow-inner" />
                                            <div className="text-[9px] md:text-[11px] font-bold text-gray-200 tracking-[0.4em] uppercase">SECURE CARD</div>
                                        </div>
                                        <div className="space-y-3 md:space-y-5">
                                            <div className="text-2xl md:text-4xl font-mono tracking-[0.1em] text-black">
                                                5371 1823 4402 8421
                                            </div>
                                            <div className="text-[10px] md:text-[12px] font-bold text-black/20 tracking-[0.5em] uppercase">
                                                EXECUTIVE USER
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-end">
                                            <div className="text-[10px] text-gray-200 font-mono italic">VALID THRU: 12/29</div>
                                            <div className="flex -space-x-3">
                                                <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-black/5 border border-black/5" />
                                                <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-[#00933b]/10 border border-[#00933b]/5" />
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>

                                {/* LAYER 3: THE SCANNING BEAM */}
                                <motion.div 
                                    initial={{ left: '0%' }}
                                    animate={isInView ? { left: '100%' } : { left: '0%' }}
                                    transition={{ 
                                        delay: 1.5, 
                                        duration: 3.5, 
                                        ease: "easeInOut",
                                        repeat: Infinity,
                                        repeatDelay: 2.5
                                    }}
                                    className="absolute top-[-15%] bottom-[-15%] w-[4px] bg-[#00933b] z-30 shadow-[0_0_20px_#00933b,0_0_40px_rgba(0,147,59,0.6)]"
                                >
                                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-5 h-5 bg-[#00933b] blur-md rounded-full" />
                                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-5 h-5 bg-[#00933b] blur-md rounded-full" />
                                    <div className="absolute top-1/2 left-1/2 -translate-y-1/2 -translate-x-1/2 bg-black border-2 border-[#00933b] p-3 rounded-2xl shadow-2xl text-[#00933b] z-40 transform scale-90 md:scale-110">
                                        <Lock size={28} />
                                    </div>
                                </motion.div>
                            </div>
                        </div>

                        {/* DATA STREAM TREE ANIMATION */}
                        <div className="absolute left-1/2 top-[42%] md:top-[48%] -translate-x-1/2 w-full max-w-5xl h-[400px] pointer-events-none z-0">
                            <svg className="w-full h-full" viewBox="0 0 1000 400" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <defs>
                                    <linearGradient id="emerald-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                        <stop offset="0%" stopColor="#00933b" stopOpacity="1" />
                                        <stop offset="100%" stopColor="#00933b" stopOpacity="0.1" />
                                    </linearGradient>
                                    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                                        <feGaussianBlur stdDeviation="5" result="blur" />
                                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                                    </filter>
                                </defs>

                                {/* Main Trunk - Starts from Card Bottom Center */}
                                <motion.path
                                    id="trunk"
                                    d="M500 0 L500 90"
                                    stroke="url(#emerald-gradient)"
                                    strokeWidth="3"
                                    strokeLinecap="round"
                                    initial={{ pathLength: 0, opacity: 0 }}
                                    animate={isInView ? { pathLength: 1, opacity: 0.5 } : {}}
                                    transition={{ duration: 1, delay: 1.5 }}
                                />
                                
                                <motion.circle 
                                    cx="500" cy="90" r="4" 
                                    fill="#00933b" 
                                    filter="url(#glow)"
                                    initial={{ scale: 0, opacity: 0 }}
                                    animate={isInView ? { scale: [0, 1.5, 1], opacity: 1 } : {}}
                                    transition={{ delay: 2.3, duration: 0.5 }}
                                />

                                {/* Branches to the 3 boxes - Landing exactly at top center of grid items */}
                                {[
                                    { d: "M500 90 C500 150, 166 150, 166 300", delay: 2.5 },
                                    { d: "M500 90 C500 150, 500 150, 500 300", delay: 2.7 },
                                    { d: "M500 90 C500 150, 834 150, 834 300", delay: 2.9 }
                                ].map((path, i) => (
                                    <React.Fragment key={i}>
                                        <motion.path
                                            id={`path-${i}`}
                                            d={path.d}
                                            stroke="url(#emerald-gradient)"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            initial={{ pathLength: 0, opacity: 0 }}
                                            animate={isInView ? { pathLength: 1, opacity: 0.25 } : {}}
                                            transition={{ duration: 1.8, delay: path.delay }}
                                        />
                                        
                                        <motion.circle
                                            r="4"
                                            fill="#00933b"
                                            filter="url(#glow)"
                                            initial={{ opacity: 0 }}
                                            animate={isInView ? { 
                                                opacity: [0, 1, 0],
                                                offsetDistance: ["0%", "100%"] 
                                            } : {}}
                                            transition={{ 
                                                duration: 2.5, 
                                                delay: path.delay + 0.8, 
                                                repeat: Infinity, 
                                                repeatDelay: 1.5 
                                            }}
                                            style={{ offsetPath: `path("${path.d}")` }}
                                        />

                                        <motion.circle 
                                            cx={i === 0 ? 166 : i === 1 ? 500 : 834} 
                                            cy="300" 
                                            r="5" 
                                            fill="#00933b" 
                                            filter="url(#glow)"
                                            initial={{ scale: 0, opacity: 0 }}
                                            animate={isInView ? { scale: [0, 1.4, 1], opacity: 0.8 } : {}}
                                            transition={{ delay: path.delay + 1.5, duration: 0.8 }}
                                        />
                                    </React.Fragment>
                                ))}
                            </svg>
                        </div>

                        {/* FEATURE PILLARS */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16 text-left max-w-5xl mx-auto relative z-10">
                            {features.map((f, i) => (
                                <motion.div 
                                    key={i}
                                    initial={{ opacity: 0, y: 30 }}
                                    animate={isInView ? { opacity: 1, y: 0 } : {}}
                                    transition={{ delay: 3.2 + (i * 0.3), duration: 0.8 }}
                                    className="bg-white/[0.02] backdrop-blur-xl border border-white/10 p-8 rounded-[2.5rem] hover:bg-white/[0.05] hover:border-[#00933b]/30 transition-all duration-500 group shadow-2xl relative"
                                >
                                    <div className="absolute -top-[2px] left-1/2 -translate-x-1/2 w-16 h-[2px] bg-[#00933b]/0 group-hover:bg-[#00933b]/50 transition-all duration-700 blur-[3px]" />
                                    
                                    <div className="mb-6 w-14 h-14 rounded-2xl bg-[#00933b]/5 flex items-center justify-center transform group-hover:scale-110 group-hover:bg-[#00933b]/10 transition-all duration-500 border border-[#00933b]/10">{f.icon}</div>
                                    <h4 className="text-white font-bold text-xl mb-3 tracking-tight leading-tight">{f.title}</h4>
                                    <p className="text-white/40 text-sm leading-relaxed font-serif italic">{f.desc}</p>
                                    
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-7 h-7 bg-black border border-[#00933b]/30 rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(0,147,59,0.2)]">
                                        <div className="w-2 h-2 rounded-full bg-[#00933b] animate-pulse" />
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </motion.div>
                
                <div className="mt-12 flex justify-center gap-2 opacity-10">
                    {[1, 2, 3, 4, 5].map(i => <div key={i} className="w-1.5 h-1.5 rounded-full bg-[#00933b]" />)}
                </div>
            </div>
        </section>
    );
};

export default Security;
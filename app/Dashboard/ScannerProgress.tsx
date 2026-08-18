import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Terminal, Database, ShieldCheck, Activity } from 'lucide-react';

export const ScannerProgress: React.FC<{ progress: number }> = ({ progress }) => {
    const [displayProgress, setDisplayProgress] = useState(0);
    const [statusText, setStatusText] = useState("INITIALIZING ENGINE...");
    const [activeIcon, setActiveIcon] = useState(0);

    useEffect(() => {
        if (progress === 15) {
            setDisplayProgress(15);
            setStatusText("ESTABLISHING SECURE OAUTH CONNECTION...");
            setActiveIcon(0);
            
            const interval = setInterval(() => {
                setDisplayProgress(prev => {
                    if (prev < 35) {
                        setStatusText("FETCHING FINANCIAL METADATA BATCHES...");
                        setActiveIcon(1);
                        return prev + 1;
                    }
                    if (prev < 65) {
                        setStatusText("EXTRACTING FULL-BODY PURCHASE PAYLOADS...");
                        setActiveIcon(2);
                        return prev + 1;
                    }
                    if (prev < 85) {
                        setStatusText("APPLYING HEURISTIC DEDUPLICATION & SCORING...");
                        setActiveIcon(3);
                        return prev + 0.5;
                    }
                    return prev;
                });
            }, 900);
            return () => clearInterval(interval);
        } else if (progress === 60) {
             setDisplayProgress(90);
             setStatusText("PERSISTING UNIQUE TRANSACTIONS TO LEDGER...");
             setActiveIcon(1);
        } else if (progress === 100) {
             setDisplayProgress(100);
             setStatusText("SYNC COMPLETE.");
             setActiveIcon(2);
        }
    }, [progress]);

    const icons = [ShieldCheck, Database, Terminal, Activity];
    const CurrentIcon = icons[activeIcon];

    return (
        <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="w-full relative overflow-hidden rounded-3xl p-[1px] group"
        >
            {/* Animated Gradient Border */}
            <div className="absolute inset-0 bg-gradient-to-r from-clay/20 via-clay to-clay/20 opacity-50 group-hover:opacity-100 animate-[spin_4s_linear_infinite]" />
            
            <div className="relative w-full bg-black/90 backdrop-blur-xl rounded-[23px] p-6 flex flex-col sm:flex-row items-center gap-6 z-10 border border-white/5">
                
                {/* Left: Icon & Glow */}
                <div className="relative shrink-0 flex items-center justify-center w-14 h-14 bg-white/[0.03] rounded-2xl border border-white/10 shadow-[0_0_20px_rgba(33,222,179,0.15)]">
                    <CurrentIcon className="text-clay animate-pulse" size={24} />
                    <div className="absolute inset-0 bg-clay/20 blur-xl rounded-full" />
                </div>

                {/* Center: Status Text & Bar */}
                <div className="flex-1 w-full">
                    <div className="flex items-center justify-between text-xs mb-3">
                        <div className="flex items-center gap-3">
                            <span className="w-2 h-2 bg-clay rounded-full" />
                            <span className="text-clay/90 font-mono tracking-widest uppercase">
                                {statusText}
                            </span>
                        </div>
                        <span className="text-white font-mono font-bold tracking-wider">{Math.floor(displayProgress)}%</span>
                    </div>

                    <div className="relative h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <motion.div 
                            className="absolute top-0 left-0 h-full bg-gradient-to-r from-clay/50 to-clay shadow-[0_0_10px_#00933b]" 
                            style={{ width: `${displayProgress}%` }}
                            transition={{ type: 'spring', bounce: 0, duration: 0.8 }}
                        />
                    </div>
                </div>

                {/* Right: Code snippet simulation (Desktop only) */}
                <div className="hidden lg:block shrink-0 w-64 bg-[#0a0a0a] rounded-xl p-3 border border-white/5 font-mono text-[10px] leading-relaxed overflow-hidden relative">
                    <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-transparent to-[#0a0a0a] z-10" />
                    <motion.div
                        animate={{ y: [0, -100] }}
                        transition={{ repeat: Infinity, duration: 5, ease: 'linear' }}
                        className="text-white/30 space-y-1 opacity-50"
                    >
                        <p>INFO: Initializing engine...</p>
                        <p>GET /gmail/v1/users/me/messages</p>
                        <p className="text-clay">AUTH: Scope validated.</p>
                        <p>HTTP 200 OK (200 candidates)</p>
                        <p>BATCH GET /gmail/v1/users/me...</p>
                        <p>Parsing regex (brand, amt, date)...</p>
                        <p className="text-clay">Score &gt;= 5 -&gt; Match</p>
                        <p>Deduplicating via hash...</p>
                        <p>UPSERT INTO financial_ledger</p>
                        <p className="text-clay">SYNC COMPLETED SUCCESSFULLY.</p>
                    </motion.div>
                </div>
            </div>
        </motion.div>
    );
};

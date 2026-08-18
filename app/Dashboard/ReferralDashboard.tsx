import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
    Users, Copy, Share2, Twitter, MessageCircle, 
    Send, Sparkles, Trophy, Star, Shield, Clock
} from 'lucide-react';
import { useSupabase } from '@shared/SupabaseProvider';
import { api, isApiError } from '@backend/lib/api/client';
import { fromApiWaitlist } from '@backend/lib/api/mappers';
import type { Waitlist as ApiWaitlist } from '@backend/lib/api/types';
import { appUrl } from '@shared/hosts';

const ReferralDashboard: React.FC = () => {
    const { user } = useSupabase();
    const [referrals, setReferrals] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [personalCode, setPersonalCode] = useState('');

    useEffect(() => {
        if (user) loadReferralData();
    }, [user]);

    const loadReferralData = async () => {
        try {
            const entryRes = await api.get<ApiWaitlist>(`/api/v1/waitlist/entry?email=${encodeURIComponent(user!.email)}`);
            const code = !isApiError(entryRes) ? entryRes.data?.personalReferralCode : undefined;
            if (code) {
                setPersonalCode(code);
                const refRes = await api.get<{ referrals?: ApiWaitlist[]; count?: number }>(
                    `/api/v1/waitlist/referrals?code=${encodeURIComponent(code)}`
                );
                if (!isApiError(refRes)) {
                    const list = refRes.data?.referrals ?? [];
                    setReferrals(list.map(fromApiWaitlist));
                }
            }
        } catch (err) {
            console.error("Failed to load referrals:", err);
        } finally {
            setIsLoading(false);
        }
    };

    const maskValue = (value: string, type: 'email' | 'phone') => {
        if (!value) return 'N/A';
        if (type === 'email') {
            const [local, domain] = value.split('@');
            return `${local.substring(0, 2)}***@${domain}`;
        } else {
            return `+91 ******${value.slice(-4)}`;
        }
    };

    const shareLink = `${appUrl('/join-waitlist')}?ref=${personalCode}`;

    const copyToClipboard = () => {
        navigator.clipboard.writeText(shareLink);
        alert("Referral link copied!");
    };

    if (isLoading) return (
        <div className="flex items-center justify-center py-40">
            <motion.div 
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="w-16 h-16 border-t-2 border-clay rounded-full"
            />
        </div>
    );

    return (
        <div className="space-y-16">
            {/* Referral Stats Header */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                <div className="md:col-span-2 glass-dark border border-clay/20 rounded-[3rem] p-12 flex flex-col justify-between relative overflow-hidden group shadow-[0_40px_80px_rgba(0,147,59,0.1)]">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-clay/10 blur-[100px] rounded-full -mr-32 -mt-32 group-hover:bg-clay/20 transition-colors duration-1000" />
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="w-1.5 h-1.5 bg-clay rounded-full animate-pulse shadow-[0_0_10px_rgba(0,147,59,0.8)]" />
                            <p className="text-[10px] font-black uppercase tracking-[0.6em] text-clay">Accelerator Mechanism</p>
                        </div>
                        
                        <div className="flex flex-col sm:flex-row items-center gap-6 bg-black/40 p-4 rounded-[2rem] border border-white/5 mb-10 shadow-inner backdrop-blur-md">
                            <span className="flex-1 font-mono text-3xl font-black tracking-[0.3em] pl-6 text-white truncate">{personalCode}</span>
                            <button 
                                onClick={copyToClipboard} 
                                className="w-full sm:w-20 h-20 bg-white text-black rounded-2xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all shrink-0 shadow-2xl group/copy"
                            >
                                <Copy size={28} className="group-hover:rotate-12 transition-transform" />
                            </button>
                        </div>
                        <p className="text-sm font-serif italic text-white/40 leading-relaxed max-w-sm">
                            Distribute this encrypted identifier to your core network. Each integration accelerates your trajectory within the Lab.
                        </p>
                    </div>
                </div>

                <motion.div 
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                    className="glass-card rounded-[3rem] p-10 flex flex-col items-center justify-center text-center hover:border-clay/30"
                >
                    <div className="w-14 h-14 bg-clay/10 rounded-2xl flex items-center justify-center mb-6 border border-clay/20 shadow-inner">
                        <Users className="text-clay" size={24} />
                    </div>
                    <span className="text-6xl font-black text-white tracking-tighter leading-none mb-3 italic">{referrals.length}</span>
                    <p className="text-[10px] font-black uppercase tracking-[0.5em] text-white/20">Active Nodes</p>
                </motion.div>

                <motion.div 
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                    className="glass-card rounded-[3rem] p-10 flex flex-col items-center justify-center text-center hover:border-clay/30"
                >
                    <div className="w-14 h-14 bg-clay/10 rounded-2xl flex items-center justify-center mb-6 border border-clay/20 shadow-inner">
                        <Trophy className="text-clay" size={24} />
                    </div>
                    <span className="text-6xl font-black text-white tracking-tighter leading-none mb-3 italic">#{(1000 - referrals.length * 10)}</span>
                    <p className="text-[10px] font-black uppercase tracking-[0.5em] text-white/20">Relative Rank</p>
                </motion.div>
            </div>

            {/* Referral List */}
            <div className="glass-card rounded-[3rem] overflow-hidden border border-white/5">
                <div className="p-10 border-b border-white/5 flex items-center justify-between bg-white/[0.01]">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center border border-white/10">
                            <Shield className="text-white/30" size={20} />
                        </div>
                        <div>
                            <h4 className="text-lg font-black italic tracking-tighter text-white leading-none mb-1">Network Activity Log</h4>
                            <p className="text-[9px] font-black uppercase tracking-[0.4em] text-white/20">Privacy-Encoded Data Streams</p>
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto dashboard-scroll">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-white/[0.01]">
                                <th className="px-10 py-6 text-[10px] font-black uppercase tracking-[0.4em] text-white/30 border-b border-white/5">Authorized Entity</th>
                                <th className="px-10 py-6 text-[10px] font-black uppercase tracking-[0.4em] text-white/30 border-b border-white/5">Masked Identity</th>
                                <th className="px-10 py-6 text-[10px] font-black uppercase tracking-[0.4em] text-white/30 border-b border-white/5">Validation Status</th>
                                <th className="px-10 py-6 text-[10px] font-black uppercase tracking-[0.4em] text-white/30 border-b border-white/5">Acquisition Date</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {referrals.length > 0 ? referrals.map((ref, i) => (
                                <tr key={i} className="hover:bg-white/[0.02] transition-colors group">
                                    <td className="px-10 py-8">
                                        <div className="flex items-center gap-5">
                                            <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-sm font-black text-white border border-white/10 group-hover:bg-clay group-hover:text-black group-hover:scale-110 transition-all duration-500">
                                                {ref.name[0]}
                                            </div>
                                            <span className="text-base font-black text-white tracking-tight italic">{ref.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-10 py-8">
                                        <div className="flex flex-col gap-1.5">
                                            <span className="text-xs font-mono text-white/50 tracking-wider">{maskValue(ref.email, 'email')}</span>
                                            <span className="text-[10px] font-mono text-white/20">{maskValue(ref.mobile_number, 'phone')}</span>
                                        </div>
                                    </td>
                                    <td className="px-10 py-8">
                                        <div className={`inline-flex items-center gap-3 px-5 py-2 rounded-full text-[9px] font-black uppercase tracking-[0.2em] ${ref.status === 'accepted' ? 'bg-clay/10 text-clay border border-clay/20 shadow-[0_0_15px_rgba(0,147,59,0.1)]' : 'bg-white/5 text-white/30 border border-white/10'}`}>
                                            <div className={`w-1.5 h-1.5 rounded-full ${ref.status === 'accepted' ? 'bg-clay animate-pulse' : 'bg-white/20'}`} />
                                            {ref.status}
                                        </div>
                                    </td>
                                    <td className="px-10 py-8">
                                        <div className="flex items-center gap-2 text-xs text-white/20 font-mono">
                                            <Clock size={12} />
                                            {new Date(ref.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                                        </div>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={4} className="px-10 py-32 text-center">
                                        <div className="flex flex-col items-center justify-center gap-4">
                                            <Share2 className="text-white/5" size={48} />
                                            <p className="text-sm font-serif italic text-white/20">Zero network activity detected. Broadcast your identifier to synchronize nodes.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ReferralDashboard;

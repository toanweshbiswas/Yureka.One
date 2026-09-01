import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    Clock, Sparkles, Share2, Twitter, MessageCircle,
    Send, Copy, ArrowLeft, Trophy, Rocket, XCircle, AlertCircle,
    Mail, RefreshCw, CheckCircle, TrendingUp, Users, ShieldCheck,
    ChevronRight, Zap, X
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSupabase } from '@shared/SupabaseProvider';
import { api, isApiError } from '@backend/lib/api/client';
import { fromApiWaitlist } from '@backend/lib/api/mappers';
import type { Waitlist as ApiWaitlist, RankResult as ApiRankResult } from '@backend/lib/api/types';
import { WaitlistEntry } from '@/types';
import { appUrl, landingUrl } from '@shared/hosts';

const RANK_BOOST_PER_REFERRAL = 15;
const RANK_BOOST_PER_APPROVAL = 35;

interface RankResult {
    baseRank: number;
    effectiveRank: number;
    totalReferrals: number;
    approvedReferrals: number;
    rankBoost: number;
    entry: WaitlistEntry;
}

// ── Gmail Confirmation Modal ──────────────────────────────────────────────────
const GmailModal: React.FC<{
    email: string;
    onConfirm: () => void;
    onClose: () => void;
    isLoading: boolean;
}> = ({ email, onConfirm, onClose, isLoading }) => (
    <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-6"
    >
        <div className="absolute inset-0 bg-black/70 backdrop-blur-2xl" onClick={onClose} />
        <motion.div
            initial={{ scale: 0.97, y: 16 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.97, y: 16 }}
            transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
            className="relative z-10 w-full max-w-md bg-[#111111] border border-white/10 rounded-[2.5rem] p-10 shadow-[0_40px_100px_rgba(0,0,0,0.8)] overflow-hidden"
        >
            {/* Top accent bar */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-clay to-transparent" />

            <button onClick={onClose} className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all">
                <X size={18} />
            </button>

            {/* Google Icon */}
            <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-8">
                <svg viewBox="0 0 24 24" className="w-8 h-8">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
            </div>

            <h3 className="text-2xl font-black italic tracking-tighter text-white text-center mb-2">Verify Your Identity</h3>
            <p className="text-white/40 text-sm text-center mb-8 leading-relaxed">
                We match this Google sign-in email to your waitlist record. This does not request inbox access.
            </p>

            {/* Email Pill */}
            <div className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-2xl px-6 py-4 mb-8">
                <div className="w-10 h-10 bg-clay/20 rounded-full flex items-center justify-center shrink-0">
                    <Mail size={18} className="text-clay" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-[9px] font-black uppercase tracking-[0.4em] text-white/30 mb-0.5">Linked Account</p>
                    <p className="text-sm font-bold text-white truncate">{email}</p>
                </div>
                <CheckCircle size={18} className="text-clay shrink-0" />
            </div>

            <div className="space-y-3">
                <button
                    onClick={onConfirm}
                    disabled={isLoading}
                    className="w-full bg-clay text-black py-5 rounded-2xl font-black text-[11px] uppercase tracking-[0.4em] flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_10px_40px_rgba(0,147,59,0.3)]"
                >
                    {isLoading ? (
                        <RefreshCw size={18} className="animate-spin" />
                    ) : (
                        <><Sparkles size={18} /> Confirm & Sync Rank</>
                    )}
                </button>
                <button onClick={onClose} className="w-full py-4 text-white/30 hover:text-white text-[10px] font-black uppercase tracking-[0.4em] transition-colors">
                    Cancel
                </button>
            </div>
        </motion.div>
    </motion.div>
);

// ── Animated Rank Number ──────────────────────────────────────────────────────
const AnimatedRank: React.FC<{ rank: number | string; isHighlighted?: boolean }> = ({ rank, isHighlighted }) => (
    <motion.span
        key={String(rank)}
        initial={{ scale: 1.4, opacity: 0, y: -10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 180, damping: 28, mass: 1 }}
        className={`font-black text-5xl tracking-tighter ${isHighlighted ? 'text-clay' : 'text-white'}`}
    >
        #{rank}
    </motion.span>
);

// ── Main Component ────────────────────────────────────────────────────────────
const WaitingPage: React.FC = () => {
    const { user, currentUserStatus, refreshUserStatus } = useSupabase();
    const navigate = useNavigate();
    const [entry, setEntry] = useState<WaitlistEntry | null>(null);
    const [rankResult, setRankResult] = useState<RankResult | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [copied, setCopied] = useState(false);
    const [syncDone, setSyncDone] = useState(false);
    const [syncError, setSyncError] = useState<string | null>(null);

    useEffect(() => {
        if (!user) { navigate('/login'); return; }
        if (currentUserStatus === 'accepted' || currentUserStatus === 'admin') { navigate('/dashboard'); return; }
        fetchData();
    }, [user, currentUserStatus]);

    useEffect(() => {
        const onFocus = () => { void refreshUserStatus(); };
        window.addEventListener('focus', onFocus);
        return () => window.removeEventListener('focus', onFocus);
    }, [refreshUserStatus]);

    const fetchData = async () => {
        if (!user?.email) return;
        setIsLoading(true);
        try {
            const res = await api.get<ApiWaitlist>(`/api/v1/waitlist/entry?email=${encodeURIComponent(user.email)}`);
            if (!isApiError(res) && res.data) setEntry(fromApiWaitlist(res.data));
        } catch (err) {
            console.error('Error fetching waitlist entry:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleRankSync = useCallback(async () => {
        if (!user?.email) return;
        setIsSyncing(true);
        setSyncError(null);
        try {
            const res = await api.post<ApiRankResult>('/api/v1/waitlist/rank/compute', { email: user.email });
            if (isApiError(res)) throw new Error(res.error);
            const result = res.data!;
            setRankResult(result);
            setEntry(fromApiWaitlist(result.entry));
            setSyncDone(true);
            setIsModalOpen(false);
        } catch (err: any) {
            setSyncError(err.message || 'Failed to sync rank. Please try again.');
            setIsModalOpen(false);
        } finally {
            setIsSyncing(false);
        }
    }, [user]);

    const shareLink = `${appUrl('/join-waitlist')}?ref=${entry?.personal_referral_code || 'YRKMNY'}`;
    const shareText = "I'm moving up the Yureka.One waitlist! Join using my link and we both climb faster.";

    const copyToClipboard = () => {
        navigator.clipboard.writeText(shareLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
    };

    const displayRank = rankResult?.effectiveRank ?? entry?.rank ?? '1000+';
    const isRankSynced = !!rankResult;

    if (isLoading) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2.2, repeat: Infinity, ease: 'linear' }}
                    className="w-14 h-14 border-2 border-clay/30 border-t-clay rounded-full"
                />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center px-6 py-24 relative overflow-hidden">

            {/* Background ambience */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80%] h-[50%] bg-clay/5 blur-[150px] rounded-full" />
                <div className="absolute bottom-0 left-0 w-[40%] h-[40%] bg-clay/3 blur-[120px] rounded-full" />
                <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
            </div>

            {/* Gmail Modal */}
            <AnimatePresence>
                {isModalOpen && user?.email && (
                    <GmailModal
                        email={user.email}
                        onConfirm={handleRankSync}
                        onClose={() => setIsModalOpen(false)}
                        isLoading={isSyncing}
                    />
                )}
            </AnimatePresence>

            <motion.div
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: 'spring', bounce: 0, duration: 0.55 }}
                className="max-w-3xl w-full relative z-10 space-y-8"
            >
                {/* ── Status Header ─────────────────────────────────── */}
                {currentUserStatus === 'rejected' ? (
                    <div className="text-center space-y-6">
                        <div className="w-24 h-24 bg-red-500/10 rounded-[2rem] flex items-center justify-center mx-auto border border-red-500/20">
                            <XCircle size={40} className="text-red-400" />
                        </div>
                        <h1 className="text-5xl md:text-7xl font-heading italic tracking-tighter text-white">Access Revoked.</h1>
                        <p className="text-white/40 text-lg italic">Your application did not meet current curation standards.</p>
                    </div>
                ) : currentUserStatus === 'on-hold' ? (
                    <div className="text-center space-y-6">
                        <div className="w-24 h-24 bg-blue-500/10 rounded-[2rem] flex items-center justify-center mx-auto border border-blue-500/20">
                            <AlertCircle size={40} className="text-blue-400" />
                        </div>
                        <h1 className="text-5xl md:text-7xl font-heading italic tracking-tighter text-white">Status: On Hold.</h1>
                        <p className="text-white/40 text-lg italic">Our team needs more information. We'll reach out shortly.</p>
                    </div>
                ) : (
                    <>
                        {/* ── Hero ──────────────────────────────────────── */}
                        <div className="text-center space-y-5">
                            <div className="relative w-24 h-24 mx-auto">
                                <div className="w-24 h-24 bg-clay/10 rounded-[2rem] flex items-center justify-center border border-clay/20">
                                    <Clock size={36} className="text-clay animate-pulse" />
                                </div>
                                <motion.div
                                    animate={{ scale: [1, 1.06, 1], opacity: [0.85, 1, 0.85] }}
                                    transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
                                    className="absolute -top-2 -right-2 w-8 h-8 bg-clay rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(0,147,59,0.45)]"
                                >
                                    <Sparkles size={16} className="text-black" />
                                </motion.div>
                            </div>
                            <h1 className="text-5xl md:text-7xl font-heading italic tracking-tighter text-white leading-none">
                                Patience is<br />Luxury.
                            </h1>
                            <p className="text-white/40 text-lg italic">Your application is in the review queue.</p>
                        </div>

                        {/* ── Rank Card ─────────────────────────────────── */}
                        <div className="bg-white/[0.03] border border-white/8 rounded-[2.5rem] p-8 relative overflow-hidden">
                            <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-clay/40 to-transparent" />

                            <div className="flex flex-col md:flex-row items-center gap-8">
                                {/* Rank Display */}
                                <div className="flex-1 text-center md:text-left space-y-2">
                                    <p className="text-[9px] font-black uppercase tracking-[0.6em] text-white/20">Current Global Rank</p>
                                    <div className="flex items-center gap-4 justify-center md:justify-start">
                                        <AnimatedRank rank={displayRank} isHighlighted={isRankSynced} />
                                        {isRankSynced && rankResult.rankBoost > 0 && (
                                            <motion.div
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                className="flex items-center gap-2 bg-clay/15 border border-clay/30 rounded-full px-4 py-2"
                                            >
                                                <TrendingUp size={14} className="text-clay" />
                                                <span className="text-[10px] font-black uppercase tracking-widest text-clay">+{rankResult.rankBoost} Climbed</span>
                                            </motion.div>
                                        )}
                                    </div>
                                    {isRankSynced && (
                                        <motion.p
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            className="text-[11px] text-white/30 font-medium"
                                        >
                                            Base rank #{rankResult.baseRank} → Effective #{rankResult.effectiveRank} (after referral boosts)
                                        </motion.p>
                                    )}
                                </div>

                                {/* Verify Button */}
                                <div className="shrink-0 flex flex-col items-center gap-3">
                                    <button
                                        onClick={() => setIsModalOpen(true)}
                                        disabled={isSyncing}
                                        className="group flex items-center gap-3 bg-white text-black px-8 py-5 rounded-2xl font-black text-[10px] uppercase tracking-[0.4em] hover:bg-clay transition-all hover:scale-105 active:scale-95 shadow-2xl disabled:opacity-50"
                                    >
                                        {isSyncing ? (
                                            <RefreshCw size={16} className="animate-spin" />
                                        ) : (
                                            <>
                                                <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0">
                                                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                                                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                                                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                                                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                                                </svg>
                                                Sync Latest Rank
                                            </>
                                        )}
                                    </button>
                                    {syncDone && (
                                        <motion.p initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="text-[9px] font-black uppercase tracking-widest text-clay flex items-center gap-1.5">
                                            <CheckCircle size={12} /> Synced just now
                                        </motion.p>
                                    )}
                                    {syncError && (
                                        <motion.p initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="text-[9px] font-black uppercase tracking-widest text-red-400">
                                            {syncError}
                                        </motion.p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* ── Rank Formula Explainer ─────────────────────── */}
                        {isRankSynced ? (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="grid grid-cols-1 md:grid-cols-3 gap-4"
                            >
                                {[
                                    {
                                        icon: Users,
                                        label: 'Total Referrals',
                                        value: rankResult.totalReferrals,
                                        sub: `${rankResult.totalReferrals} × ${RANK_BOOST_PER_REFERRAL} = ${rankResult.totalReferrals * RANK_BOOST_PER_REFERRAL} positions`,
                                        color: 'text-clay',
                                        border: 'border-clay/20',
                                    },
                                    {
                                        icon: ShieldCheck,
                                        label: 'Admin Approved',
                                        value: rankResult.approvedReferrals,
                                        sub: `${rankResult.approvedReferrals} × ${RANK_BOOST_PER_APPROVAL} = ${rankResult.approvedReferrals * RANK_BOOST_PER_APPROVAL} positions`,
                                        color: 'text-[#00933b]',
                                        border: 'border-[#00933b]/20',
                                    },
                                    {
                                        icon: TrendingUp,
                                        label: 'Total Rank Boost',
                                        value: `+${rankResult.rankBoost}`,
                                        sub: 'Positions climbed from base',
                                        color: 'text-white',
                                        border: 'border-white/10',
                                    },
                                ].map(({ icon: Icon, label, value, sub, color, border }) => (
                                    <div key={label} className={`bg-white/[0.03] border ${border} rounded-3xl p-6`}>
                                        <Icon size={22} className={`${color} mb-4`} />
                                        <p className="text-[9px] font-black uppercase tracking-[0.4em] text-white/30 mb-1">{label}</p>
                                        <p className={`text-3xl font-black italic tracking-tighter ${color} mb-1`}>{value}</p>
                                        <p className="text-[10px] text-white/30">{sub}</p>
                                    </div>
                                ))}
                            </motion.div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {[
                                    {
                                        icon: Trophy, label: 'Move Up the Rank',
                                        desc: `Each referral who joins moves you up ${RANK_BOOST_PER_REFERRAL} positions. Each admin-approved referral adds ${RANK_BOOST_PER_APPROVAL} more.`,
                                    },
                                    {
                                        icon: Rocket, label: 'Priority Lab Access',
                                        desc: 'Top 5% of referrers get direct access to Yureka Intelligence Lab early builds and beta features.',
                                    },
                                ].map(({ icon: Icon, label, desc }) => (
                                    <div key={label} className="bg-white/[0.03] border border-white/8 rounded-3xl p-7 hover:border-clay/20 transition-colors group">
                                        <Icon className="text-clay mb-4 group-hover:scale-110 transition-transform" size={28} />
                                        <h3 className="text-white font-black text-base mb-2 tracking-tight">{label}</h3>
                                        <p className="text-white/30 text-xs leading-relaxed">{desc}</p>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* ── Referral Link Block ────────────────────────── */}
                        <div className="bg-white/[0.03] border border-white/8 rounded-[2.5rem] p-8 relative overflow-hidden">
                            <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />

                            <p className="text-[9px] font-black uppercase tracking-[0.6em] text-white/20 mb-5 text-center">Your Accelerator Link</p>

                            <div className="flex items-center gap-3 bg-black/50 border border-white/5 rounded-2xl p-2 mb-6">
                                <span className="flex-1 font-mono text-sm font-bold text-clay tracking-wider pl-4 truncate">{shareLink}</span>
                                <button
                                    onClick={copyToClipboard}
                                    className={`flex items-center gap-2 px-5 py-3 rounded-xl font-black text-[9px] uppercase tracking-[0.3em] transition-all shrink-0 ${copied ? 'bg-clay/20 text-clay border border-clay/30' : 'bg-clay text-black hover:scale-105 active:scale-95'}`}
                                >
                                    {copied ? <><CheckCircle size={14} /> Copied!</> : <><Copy size={14} /> Copy</>}
                                </button>
                            </div>

                            <div className="flex items-center justify-center gap-4">
                                {[
                                    { href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareLink)}`, icon: Twitter, label: 'X / Twitter' },
                                    { href: `https://wa.me/?text=${encodeURIComponent(shareText + ' ' + shareLink)}`, icon: MessageCircle, label: 'WhatsApp' },
                                    { href: `https://t.me/share/url?url=${encodeURIComponent(shareLink)}&text=${encodeURIComponent(shareText)}`, icon: Send, label: 'Telegram' },
                                ].map(({ href, icon: Icon, label }) => (
                                    <a
                                        key={label}
                                        href={href}
                                        target="_blank"
                                        rel="noreferrer"
                                        title={label}
                                        className="w-14 h-14 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center text-white/40 hover:text-white hover:bg-clay/20 hover:border-clay/30 transition-all hover:scale-110"
                                    >
                                        <Icon size={20} />
                                    </a>
                                ))}
                            </div>
                        </div>
                    </>
                )}

                {/* ── Footer ────────────────────────────────────────── */}
                <div className="text-center">
                    <a href={landingUrl('/')} className="inline-flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.5em] text-white/20 hover:text-clay transition-all group">
                        <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
                        Back to Home
                    </a>
                </div>
            </motion.div>
        </div>
    );
};

export default WaitingPage;

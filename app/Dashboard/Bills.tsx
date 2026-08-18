import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
    Search, RefreshCw, AlertCircle, Calendar, CreditCard, 
    ShieldCheck, Bell, Sparkles, LogIn, Lock, ArrowUpRight
} from 'lucide-react';
import { useSupabase } from '@shared/SupabaseProvider';
import { ScannerProgress } from './ScannerProgress';

interface ParsedTransaction {
    brandName: string;
    amount: string;
    description: string;
    date: string;
    sender: string;
    type?: string;
}

const Bills: React.FC = () => {
    const {
        session,
        ledgerTransactions,
        ledgerLoading: loading, 
        ledgerError: error, 
        scanProgress, 
        syncLedger,
        ledgerResyncQuota,
    } = useSupabase();
    
    const [searchQuery, setSearchQuery] = useState('');

    const transactions = useMemo(() => {
        return (ledgerTransactions || []).filter((tx: ParsedTransaction) => {
            const type = (tx.type || '').toLowerCase();
            return type !== 'transaction' && type !== '';
        });
    }, [ledgerTransactions]);

    const remaining = ledgerResyncQuota?.remaining
    const resyncBlocked = remaining === 0
    const nextResync = ledgerResyncQuota?.nextAvailableAt
        ? new Date(ledgerResyncQuota.nextAvailableAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
        : null

    const triggerSync = () => {
        if (resyncBlocked) return
        syncLedger(true);
    };

    // Computes bills metrics
    const metrics = useMemo(() => {
        if (transactions.length === 0) return { total: '₹ 0', count: 0, average: '₹ 0', topBillingService: 'N/A' };
        
        let totalINR = 0;
        let count = 0;
        const merchantCounts: Record<string, number> = {};

        transactions.forEach(tx => {
            const amtStr = tx.amount.replace(/[₹$,\s]/g, '');
            const parsed = parseFloat(amtStr);
            if (!isNaN(parsed)) {
                totalINR += parsed;
                count++;
            }
            const name = tx.brandName || 'Unknown';
            merchantCounts[name] = (merchantCounts[name] || 0) + 1;
        });

        const topBillingService = Object.entries(merchantCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';
        const average = count > 0 ? totalINR / count : 0;

        return {
            total: `₹ ${totalINR.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
            count,
            average: `₹ ${average.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
            topBillingService
        };
    }, [transactions]);

    const filteredTransactions = useMemo(() => {
        return transactions.filter(tx => 
            tx.brandName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            tx.description.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [transactions, searchQuery]);

    return (
        <div className="space-y-12">
            {/* Header Toolbar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                <div className="relative w-full sm:w-96">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-white/30" size={18} />
                    <input
                        type="text"
                        placeholder="Search standard bills & alerts..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full pl-12 pr-6 py-4 bg-white/[0.02] border border-white/5 rounded-2xl text-white placeholder-white/30 text-sm focus:outline-none focus:border-clay/50 transition-all font-sans"
                    />
                </div>
                <div className="w-full sm:w-auto flex flex-col items-stretch sm:items-end gap-2">
                <button
                    disabled={loading || resyncBlocked}
                    onClick={triggerSync}
                    className="w-full sm:w-auto px-6 py-4 bg-white/[0.02] border border-white/5 hover:border-white/10 rounded-2xl flex items-center justify-center gap-3 text-white/70 hover:text-white transition-all text-xs uppercase tracking-[0.2em] font-black group cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    <RefreshCw size={14} className={`${loading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
                    {loading ? 'Analyzing...' : resyncBlocked ? 'Resync used' : 'Resync Inbox'}
                </button>
                <p className="text-[10px] text-white/35 uppercase tracking-widest text-center sm:text-right">
                    {resyncBlocked
                        ? `Next resync ${nextResync || 'after 15 days'}`
                        : `${remaining ?? 2} of 2 resyncs left · 15 days`}
                </p>
                </div>
            </div>

            {/* Error Notification Alert */}
            <AnimatePresence>
                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="w-full bg-red-500/10 border border-red-500/20 rounded-3xl p-6 flex flex-col sm:flex-row items-center justify-between gap-6"
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-red-500/10 rounded-2xl flex items-center justify-center shrink-0 border border-red-500/20">
                                <AlertCircle className="text-red-400" size={20} />
                            </div>
                            <div className="text-left">
                                <h4 className="text-white font-bold text-sm">
                                    {error === "AUTH_EXPIRED" ? "Gmail inbox access needed" : error === "RESYNC_LIMIT" ? "Resync limit reached" : "Synchronisation Failed"}
                                </h4>
                                <p className="text-white/40 text-xs mt-1">
                                    {error === "AUTH_EXPIRED" 
                                        ? "Grant read-only Gmail access so we can pull bill and subscription emails for your ledger."
                                        : error === "RESYNC_LIMIT"
                                        ? `You can resync inbox twice every 15 days. Next available ${nextResync || 'soon'}.`
                                        : error
                                    }
                                </p>
                            </div>
                        </div>
                        {error === "AUTH_EXPIRED" && (
                            <button
                                type="button"
                                onClick={triggerSync}
                                className="px-5 py-3 rounded-2xl bg-clay text-black text-[10px] font-black uppercase tracking-[0.2em] inline-flex items-center gap-2"
                            >
                                <LogIn size={14} /> Connect Gmail
                            </button>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Scanning Loader Progress */}
            <AnimatePresence>
                {loading && (
                    <ScannerProgress progress={scanProgress} />
                )}
            </AnimatePresence>

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: 'Cumulative Bills', value: metrics.total, desc: 'Decrypted sum total', icon: CreditCard, color: 'text-clay' },
                    { label: 'Bills Sync Count', value: metrics.count, desc: 'Alerts & subscriptions', icon: Bell, color: 'text-blue-400' },
                    { label: 'Average Payment', value: metrics.average, desc: 'Value per bill payment', icon: ArrowUpRight, color: 'text-purple-400' },
                    { label: 'Primary Service', value: metrics.topBillingService, desc: 'Most recurrent bills', icon: ShieldCheck, color: 'text-yellow-400' }
                ].map((stat, idx) => (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        key={stat.label}
                        className="bg-white/[0.01] border border-white/5 backdrop-blur-3xl p-8 rounded-[2rem] relative overflow-hidden group hover:border-white/10 transition-all"
                    >
                        <div className="flex items-center justify-between mb-6">
                            <p className="text-[9px] font-black uppercase tracking-[0.3em] text-white/30">{stat.label}</p>
                            <stat.icon size={18} className={stat.color} />
                        </div>
                        <p className="text-3xl font-black italic tracking-tighter text-white leading-none uppercase mb-2">
                            {stat.value}
                        </p>
                        <p className="text-[10px] text-white/40 font-serif italic">{stat.desc}</p>
                    </motion.div>
                ))}
            </div>

            {/* Bills ledger list */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white/[0.01] border border-white/5 rounded-[2.5rem] overflow-hidden"
            >
                <div className="p-8 border-b border-white/5 flex items-center justify-between">
                    <h3 className="text-lg font-black uppercase tracking-[0.2em] text-white">Subscriptions & Bills</h3>
                    <span className="px-4 py-1.5 bg-white/5 rounded-full text-[9px] font-black uppercase tracking-[0.2em] text-white/50">
                        {filteredTransactions.length} items logged
                    </span>
                </div>

                <div className="overflow-x-auto">
                    {filteredTransactions.length === 0 ? (
                        <div className="py-20 text-center flex flex-col items-center justify-center">
                            <AlertCircle size={32} className="text-white/20 mb-4" />
                            <p className="text-white/40 font-serif italic text-lg">No synchronized bills found.</p>
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-white/5 text-[9px] font-black uppercase tracking-[0.3em] text-white/30 bg-white/[0.01]">
                                    <th className="py-6 px-8">Provider</th>
                                    <th className="py-6 px-8">Payment Value</th>
                                    <th className="py-6 px-8">Classification</th>
                                    <th className="py-6 px-8">Billing Date</th>
                                    <th className="py-6 px-8 text-right">Verification</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredTransactions.map((tx, idx) => (
                                    <tr 
                                        key={idx}
                                        className="border-b border-white/[0.02] hover:bg-white/[0.01] transition-all group"
                                    >
                                        <td className="py-6 px-8">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center shrink-0 border border-white/5 text-white/50 group-hover:text-clay group-hover:border-clay/20 transition-all font-black text-sm uppercase">
                                                    {tx.brandName?.[0] || 'B'}
                                                </div>
                                                <span className="font-bold text-white text-sm">{tx.brandName}</span>
                                            </div>
                                        </td>
                                        <td className="py-6 px-8 text-clay font-black text-sm">
                                            {tx.amount}
                                        </td>
                                        <td className="py-6 px-8 text-white/60 text-xs max-w-xs truncate font-serif italic">
                                            {tx.description}
                                        </td>
                                        <td className="py-6 px-8 text-white/40 text-xs font-sans">
                                            {tx.date}
                                        </td>
                                        <td className="py-6 px-8 text-right">
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-clay/10 text-clay rounded-full text-[8px] font-black uppercase tracking-widest border border-clay/20">
                                                <span className="w-1 h-1 bg-clay rounded-full animate-ping" />
                                                AutoPay Active
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </motion.div>
        </div>
    );
};

export default Bills;

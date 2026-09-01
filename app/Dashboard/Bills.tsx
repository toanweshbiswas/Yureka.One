import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    Search, RefreshCw, AlertCircle, Calendar, CreditCard,
    ShieldCheck, Bell, LogIn, ArrowUpRight
} from 'lucide-react';
import { useSupabase } from '@shared/SupabaseProvider';
import { GmailLimitedUseNotice } from '@shared/GmailLimitedUseNotice';
import { ScannerProgress } from './ScannerProgress';
import { api, isApiError } from '@backend/lib/api/client';

type BillRow = {
    brandName: string;
    amount: string;
    description: string;
    date: string;
    sender: string;
    type?: string;
    dueDate?: string | null;
    minimumDue?: string | null;
    totalDue?: string | null;
};

const Bills: React.FC = () => {
    const {
        ledgerLoading: loading,
        ledgerError: error,
        scanProgress,
        syncLedger,
        ledgerResyncQuota,
    } = useSupabase();

    const [searchQuery, setSearchQuery] = useState('');
    const [bills, setBills] = useState<BillRow[]>([]);
    const [billsLoading, setBillsLoading] = useState(true);

    const loadBills = async () => {
        setBillsLoading(true);
        const res = await api.get<{ bills: BillRow[]; scannedAt?: string | null; count?: number }>(
            '/api/v1/ledger/bills',
            { timeoutMs: 15000 },
        );
        if (!isApiError(res) && Array.isArray(res.data?.bills)) {
            setBills(res.data.bills);
        }
        setBillsLoading(false);
    };

    useEffect(() => {
        void loadBills();
    }, []);

    useEffect(() => {
        if (!loading && !error) {
            void loadBills();
        }
    }, [loading, error]);

    const remaining = ledgerResyncQuota?.remaining
    const used = ledgerResyncQuota?.used ?? 0
    const limit = ledgerResyncQuota?.limit ?? 5
    const windowDays = ledgerResyncQuota?.windowDays ?? 15
    const resyncBlocked = remaining === 0
    const nextResync = ledgerResyncQuota?.nextAvailableAt
        ? new Date(ledgerResyncQuota.nextAvailableAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
        : null

    const triggerSync = () => {
        if (resyncBlocked) return
        syncLedger(true);
    };

    const metrics = useMemo(() => {
        if (bills.length === 0) return { total: '₹ 0', count: 0, average: '₹ 0', topBillingService: 'N/A' };

        let totalINR = 0;
        let count = 0;
        const merchantCounts: Record<string, number> = {};

        bills.forEach(tx => {
            const amtStr = (tx.totalDue || tx.amount).replace(/[₹$,\s]/g, '');
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
    }, [bills]);

    const filteredTransactions = useMemo(() => {
        return bills.filter(tx =>
            tx.brandName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            tx.description.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [bills, searchQuery]);

    const showLoader = loading || billsLoading;

    return (
        <div className="space-y-12">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                <div className="relative w-full sm:w-96">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-white/30" size={18} />
                    <input
                        type="text"
                        placeholder="Search credit card bills & alerts..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full pl-12 pr-6 py-4 bg-white/[0.02] border border-white/5 rounded-2xl text-white placeholder-white/30 text-sm focus:outline-none focus:border-clay/50 transition-all font-sans"
                    />
                </div>
                <div className="w-full sm:w-auto flex flex-col items-stretch sm:items-end gap-2">
                <button
                    disabled={showLoader || resyncBlocked}
                    onClick={triggerSync}
                    className="w-full sm:w-auto px-6 py-4 bg-white/[0.02] border border-white/5 hover:border-white/10 rounded-2xl flex items-center justify-center gap-3 text-white/70 hover:text-white transition-all text-xs uppercase tracking-[0.2em] font-black group cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    <RefreshCw size={14} className={`${showLoader ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
                    {showLoader ? 'Analyzing...' : resyncBlocked ? 'Resync used' : 'Resync Inbox'}
                </button>
                <p className="text-[10px] text-white/35 uppercase tracking-widest text-center sm:text-right">
                    {resyncBlocked
                        ? `Next resync ${nextResync || `after ${windowDays} days`}`
                        : `${used} used · ${remaining ?? limit} of ${limit} left · ${windowDays} days`}
                </p>
                </div>
            </div>

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
                                        ? "Connect Gmail only if you want us to parse card statements and due-date emails."
                                        : error === "RESYNC_LIMIT"
                                        ? `You can resync inbox ${limit} times every ${windowDays} days. Next available ${nextResync || 'soon'}.`
                                        : error
                                    }
                                </p>
                                {error === "AUTH_EXPIRED" && (
                                    <GmailLimitedUseNotice className="mt-2 text-[11px] leading-relaxed text-white/35" />
                                )}
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

            <AnimatePresence>
                {loading && scanProgress > 0 && (
                    <ScannerProgress progress={scanProgress} />
                )}
            </AnimatePresence>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: 'Total Due (tracked)', value: metrics.total, desc: 'From statement emails', icon: CreditCard, color: 'text-clay' },
                    { label: 'Bills Sync Count', value: metrics.count, desc: 'Card & utility alerts', icon: Bell, color: 'text-blue-400' },
                    { label: 'Average Bill', value: metrics.average, desc: 'Per statement email', icon: ArrowUpRight, color: 'text-purple-400' },
                    { label: 'Primary Issuer', value: metrics.topBillingService, desc: 'Most frequent bills', icon: ShieldCheck, color: 'text-yellow-400' }
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

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white/[0.01] border border-white/5 rounded-[2.5rem] overflow-hidden"
            >
                <div className="p-8 border-b border-white/5 flex items-center justify-between">
                    <h3 className="text-lg font-black uppercase tracking-[0.2em] text-white">Credit Card Bills</h3>
                    <span className="px-4 py-1.5 bg-white/5 rounded-full text-[9px] font-black uppercase tracking-[0.2em] text-white/50">
                        {filteredTransactions.length} bills
                    </span>
                </div>

                <div className="overflow-x-auto">
                    {filteredTransactions.length === 0 ? (
                        <div className="py-20 text-center flex flex-col items-center justify-center">
                            <AlertCircle size={32} className="text-white/20 mb-4" />
                            <p className="text-white/40 font-serif italic text-lg">No synchronized bills found.</p>
                            <p className="text-white/25 text-xs mt-2 max-w-md">Connect Gmail to pull card statement emails with due dates and amounts.</p>
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-white/5 text-[9px] font-black uppercase tracking-[0.3em] text-white/30 bg-white/[0.01]">
                                    <th className="py-6 px-8">Issuer</th>
                                    <th className="py-6 px-8">Total Due</th>
                                    <th className="py-6 px-8">Min Due</th>
                                    <th className="py-6 px-8">Due Date</th>
                                    <th className="py-6 px-8">Statement</th>
                                    <th className="py-6 px-8 text-right">Type</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredTransactions.map((tx, idx) => (
                                    <tr
                                        key={tx.dueDate ? `${tx.brandName}-${tx.dueDate}-${idx}` : idx}
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
                                            {tx.totalDue || tx.amount}
                                        </td>
                                        <td className="py-6 px-8 text-white/60 text-xs">
                                            {tx.minimumDue || '—'}
                                        </td>
                                        <td className="py-6 px-8 text-white/70 text-xs font-sans">
                                            <span className="inline-flex items-center gap-1.5">
                                                <Calendar size={12} className="text-white/30" />
                                                {tx.dueDate || tx.date || '—'}
                                            </span>
                                        </td>
                                        <td className="py-6 px-8 text-white/60 text-xs max-w-xs truncate font-serif italic">
                                            {tx.description}
                                        </td>
                                        <td className="py-6 px-8 text-right">
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-clay/10 text-clay rounded-full text-[8px] font-black uppercase tracking-widest border border-clay/20">
                                                {tx.type || 'Bill'}
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

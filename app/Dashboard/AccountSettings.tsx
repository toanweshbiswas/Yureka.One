import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
    User, Mail, Phone, Calendar,
    Save, ShieldCheck, Loader2, Sparkles, Check
} from 'lucide-react';
import { useSupabase } from '@shared/SupabaseProvider';
import { api, isApiError } from '@backend/lib/api/client';
import type { Waitlist as ApiWaitlist } from '@backend/lib/api/types';
import AddToHomeScreen from '@shared/AddToHomeScreen';
import { googleAvatarUrl, prettyGender } from '@shared/userProfile';

const AccountSettings: React.FC = () => {
    const { user } = useSupabase();
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [waitlistId, setWaitlistId] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        mobileNumber: '',
        dateOfBirth: '',
        gender: ''
    });
    const [yurekaScore, setYurekaScore] = useState<number | null>(null);
    const [scoreDecision, setScoreDecision] = useState<string | null>(null);

    useEffect(() => {
        if (user) loadAccountData();
    }, [user]);

    useEffect(() => {
        const onScore = (event: Event) => {
            const detail = (event as CustomEvent).detail || {}
            const next = Number(detail.score)
            if (!Number.isFinite(next)) return
            setYurekaScore(next)
            setScoreDecision(typeof detail.decision === 'string' ? detail.decision : null)
        }
        window.addEventListener('yureka-score-updated', onScore)
        return () => window.removeEventListener('yureka-score-updated', onScore)
    }, []);

    const loadAccountData = async () => {
        try {
            const res = await api.get<ApiWaitlist>(`/api/v1/waitlist/entry?email=${encodeURIComponent(user!.email)}`);
            if (!isApiError(res) && res.data) {
                const entry = res.data;
                setWaitlistId(entry.id ?? null);
                const googleName = String(user?.user_metadata?.full_name || user?.user_metadata?.name || '').trim()
                const fullName = String(entry.name || googleName).trim()
                const parts = fullName.split(/\s+/).filter(Boolean)
                setFormData({
                    firstName: entry.firstName || parts[0] || '',
                    lastName: entry.lastName || parts.slice(1).join(' ') || '',
                    email: entry.email || user?.email || '',
                    mobileNumber: entry.mobileNumber || '',
                    dateOfBirth: entry.dateOfBirth || '',
                    gender: entry.gender || '',
                });
                setYurekaScore(entry.yurekaScore ?? null);
                setScoreDecision(entry.scoreDecision ?? null);
            } else if (user) {
                const googleName = String(user.user_metadata?.full_name || user.user_metadata?.name || '').trim()
                const parts = googleName.split(/\s+/).filter(Boolean)
                setFormData((prev) => ({
                    ...prev,
                    firstName: parts[0] || prev.firstName,
                    lastName: parts.slice(1).join(' ') || prev.lastName,
                    email: user.email || prev.email,
                }))
            }
        } catch (err) {
            console.error("Failed to load account:", err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        if (!waitlistId) return;
        setIsSaving(true);
        try {
            const res = await api.patch(`/api/v1/waitlist/${waitlistId}/metadata`, {
                mobile_number: formData.mobileNumber,
                date_of_birth: formData.dateOfBirth,
                gender: formData.gender,
            });
            if (isApiError(res)) throw new Error(res.error);
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 3000);
        } catch (err) {
            alert("Failed to update profile.");
        } finally {
            setIsSaving(false);
        }
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

    const avatarUrl = googleAvatarUrl(user);
    const initials = `${formData.firstName?.[0] || ''}${formData.lastName?.[0] || ''}`.toUpperCase() || 'U';

    return (
        <div className="max-w-4xl space-y-10 md:space-y-16">
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card rounded-[2rem] md:rounded-[3rem] p-6 sm:p-8 md:p-12 relative overflow-hidden"
            >
                <div className="absolute top-0 right-0 w-64 h-64 bg-clay/5 blur-[100px] rounded-full -mr-32 -mt-32" />
                
                <div className="relative z-10 space-y-10 md:space-y-12">
                    <div className="flex flex-col md:flex-row items-center gap-6 md:gap-10">
                        <div className="relative group">
                            <div className="w-24 h-24 md:w-28 md:h-28 bg-clay text-black rounded-3xl overflow-hidden flex items-center justify-center font-black text-3xl shadow-[0_20px_40px_rgba(0,147,59,0.3)] group-hover:scale-105 transition-transform duration-500">
                                {avatarUrl ? (
                                    <img src={avatarUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                                ) : (
                                    initials
                                )}
                            </div>
                            <div className="absolute -bottom-2 -right-2 w-10 h-10 glass-dark border border-white/10 rounded-xl flex items-center justify-center text-clay shadow-xl">
                                <ShieldCheck size={20} />
                            </div>
                        </div>
                        <div className="text-center md:text-left">
                            <div className="flex items-center gap-3 mb-2 justify-center md:justify-start">
                                <div className="w-2 h-2 bg-clay rounded-full animate-pulse shadow-[0_0_10px_rgba(0,147,59,0.8)]" />
                                <p className="text-[10px] font-black uppercase tracking-[0.5em] text-clay">Identity Confirmed</p>
                            </div>
                            <h3 className="text-3xl sm:text-4xl md:text-5xl font-black italic tracking-tighter text-white leading-none">
                                {formData.firstName} {formData.lastName}
                            </h3>
                            <p className="text-white/30 text-sm font-serif italic mt-3">Authorized explorer within the Yureka intelligence network.</p>
                            <div className="mt-5 flex justify-center md:justify-start">
                                <AddToHomeScreen mode="button" />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="rounded-2xl border border-clay/20 bg-clay/10 px-5 py-4">
                            <p className="text-[9px] font-black uppercase tracking-[0.25em] text-clay/80 mb-1">Yureka Score</p>
                            {yurekaScore != null ? (
                                <>
                                    <p className="text-3xl font-black text-white tabular-nums leading-none">
                                        {yurekaScore}<span className="text-base text-white/35">/100</span>
                                    </p>
                                    {scoreDecision && (
                                        <p className="text-[11px] text-white/45 mt-2 capitalize">{scoreDecision}</p>
                                    )}
                                </>
                            ) : (
                                <p className="text-sm text-white/40">Not scored yet</p>
                            )}
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4">
                            <p className="text-[9px] font-black uppercase tracking-[0.25em] text-white/35 mb-1">Gender</p>
                            <p className="text-xl font-black text-white">{prettyGender(formData.gender)}</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4">
                            <p className="text-[9px] font-black uppercase tracking-[0.25em] text-white/35 mb-1">Google photo</p>
                            <p className="text-sm font-bold text-white/70">
                                {avatarUrl ? 'Linked from Gmail' : 'Sign in with Google to sync photo'}
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10 pt-6">
                        <div className="space-y-4">
                            <label className="text-[10px] font-black uppercase tracking-[0.6em] text-white/30 ml-1">Secure Identifier (Email)</label>
                            <div className="relative group">
                                <Mail className="absolute left-8 top-1/2 -translate-y-1/2 text-white/10 group-hover:text-white/20 transition-colors" size={20} />
                                <input 
                                    type="email" value={formData.email} disabled
                                    className="w-full glass-dark border border-white/5 rounded-2xl pl-20 pr-8 py-6 text-white/20 outline-none cursor-not-allowed text-sm font-bold tracking-wide"
                                />
                                <div className="absolute right-8 top-1/2 -translate-y-1/2 text-[9px] font-black uppercase tracking-[0.3em] text-white/10">Read Only</div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <label className="text-[10px] font-black uppercase tracking-[0.6em] text-white/30 ml-1">Communication Node (Mobile)</label>
                            <div className="relative group">
                                <Phone className="absolute left-8 top-1/2 -translate-y-1/2 text-white/20 group-hover:text-clay transition-colors" size={20} />
                                <input 
                                    type="tel" value={formData.mobileNumber}
                                    onChange={e => setFormData({...formData, mobileNumber: e.target.value})}
                                    className="w-full glass-card border border-white/5 rounded-2xl pl-20 pr-8 py-6 text-white outline-none focus:border-clay/50 transition-all text-sm font-bold tracking-wide placeholder:text-white/10"
                                    placeholder="+91 XXXXX XXXXX"
                                />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <label className="text-[10px] font-black uppercase tracking-[0.6em] text-white/30 ml-1">Temporal Origin (DOB)</label>
                            <div className="relative group">
                                <Calendar className="absolute left-8 top-1/2 -translate-y-1/2 text-white/20 group-hover:text-clay transition-colors" size={20} />
                                <input 
                                    type="date" value={formData.dateOfBirth}
                                    onChange={e => setFormData({...formData, dateOfBirth: e.target.value})}
                                    className="w-full glass-card border border-white/5 rounded-2xl pl-20 pr-8 py-6 text-white outline-none focus:border-clay/50 transition-all text-sm font-bold tracking-wide appearance-none"
                                />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <label className="text-[10px] font-black uppercase tracking-[0.6em] text-white/30 ml-1">Entity Classification (Gender)</label>
                            <div className="relative">
                                <select 
                                    value={formData.gender}
                                    onChange={e => setFormData({...formData, gender: e.target.value})}
                                    className="w-full glass-card border border-white/5 rounded-2xl px-8 py-6 text-white outline-none focus:border-clay/50 transition-all text-sm font-bold tracking-wide appearance-none bg-black cursor-pointer"
                                >
                                    <option value="" className="bg-[#0f0f0f]">Select Classification</option>
                                    <option value="male" className="bg-[#0f0f0f]">Masculine</option>
                                    <option value="female" className="bg-[#0f0f0f]">Feminine</option>
                                    <option value="other" className="bg-[#0f0f0f]">Other / Undisclosed</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="pt-12 border-t border-white/5 flex flex-col lg:flex-row items-center justify-between gap-10">
                        <div className="flex items-center gap-5">
                            <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center text-white/20 border border-white/10">
                                <ShieldCheck size={24} />
                            </div>
                            <p className="text-[11px] font-medium leading-relaxed italic text-white/30 max-w-sm">
                                Authentication protocols active. Profile modifications are secured via SHA-256 neural encryption.
                            </p>
                        </div>
                        
                        <button 
                            onClick={handleSave}
                            disabled={isSaving}
                            className={`w-full lg:w-auto px-12 py-6 rounded-2xl flex items-center justify-center gap-6 transition-all active:scale-95 disabled:opacity-50 shadow-2xl ${showSuccess ? 'bg-clay text-black' : 'bg-white text-black hover:bg-clay'}`}
                        >
                            <span className="text-[11px] font-black uppercase tracking-[0.5em]">
                                {isSaving ? 'Encrypting...' : showSuccess ? 'Success: Secured' : 'Authorize Changes'}
                            </span>
                            {isSaving ? <Loader2 className="animate-spin" size={20} /> : showSuccess ? <Check size={20} /> : <Save size={20} />}
                        </button>
                    </div>
                </div>
            </motion.div>

            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="p-10 bg-red-500/[0.02] border border-red-500/10 rounded-[3rem] flex flex-col md:flex-row items-center gap-8 group"
            >
                <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center text-red-500 shrink-0 border border-red-500/20 group-hover:scale-110 transition-transform">
                    <Sparkles size={28} />
                </div>
                <div className="flex-1 text-center md:text-left">
                    <p className="text-[10px] font-black uppercase tracking-[0.6em] text-red-500 mb-2">High Risk Protocol</p>
                    <p className="text-sm text-white/30 italic font-serif leading-relaxed">
                        Revocation of credentials will permanently terminate your access to the Lab, erase all portfolio sync data, and forfeit your priority rank.
                    </p>
                </div>
                <button className="px-8 py-4 glass-dark border border-red-500/10 rounded-2xl text-[10px] font-black uppercase tracking-[0.4em] text-red-500/40 hover:text-red-500 hover:bg-red-500/5 transition-all">
                    Terminate Identity
                </button>
            </motion.div>
        </div>
    );
};

export default AccountSettings;

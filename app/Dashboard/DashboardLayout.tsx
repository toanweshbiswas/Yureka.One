import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
    PanelLeft, PanelLeftClose, X,
} from 'lucide-react';
import { useNavigate, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { useSupabase } from '@shared/SupabaseProvider';
import { signOutGmail } from '@shared/auth';
import AddToHomeScreen from '@shared/AddToHomeScreen';
import { cacheInvalidate } from '@shared/dashboardCache';
import { shouldHandoffToNativeApp, tryOpenNativeApp } from '@shared/nativeAppHandoff';
import WelcomeBanner from './WelcomeBanner';
import { googleAvatarUrl } from '@shared/userProfile';
import Icon3d from '@shared/Icon3d';
import YurekaBrandMark from '@shared/YurekaBrandMark';


// Sub-components (to be built)
import ReferralDashboard from './ReferralDashboard';
import AccountSettings from './AccountSettings';
import Expenses from './Expenses';
import Bills from './Bills';
import ExpensePlanning from './ExpensePlanning';
import YurekaAIPage from '@landing/YurekaAIPage';
import WaitlistPage from '@app/WaitlistPage';
import GoldbackHome from './GoldbackHome';
import OffersPage from './OffersPage';
import GiftCardsPage from './GiftCardsPage';
import GiftCardOrderPage from './GiftCardOrderPage';
import ExtensionPage from './ExtensionPage';
// import ExploreScenePage from './ExploreScenePage';
// import SuperBrowsePage from './SuperBrowse';

import { api, isApiError } from '@backend/lib/api/client';

type NavItem = {
    id: string
    label: string
    icon: string
    path: string
    comingSoon?: boolean
}

const PRIMARY_NAV: NavItem[] = [
    { id: 'home', label: 'Home', icon: 'dollar', path: '/dashboard/home' },
    { id: 'offers', label: 'Offers', icon: 'bag', path: '/dashboard/offers' },
    { id: 'giftcards', label: 'Gift cards', icon: 'gift', path: '/dashboard/giftcards' },
];

const SECONDARY_NAV: NavItem[] = [
    { id: 'expenses', label: 'Expenses', icon: 'chart', path: '/dashboard/expenses' },
    { id: 'planning', label: 'Planning', icon: 'calender', path: '/dashboard/planning' },
    { id: 'bills', label: 'Bills', icon: 'wallet', path: '/dashboard/bills' },
    { id: 'referrals', label: 'Referrals', icon: 'heart', path: '/dashboard/referrals' },
    { id: 'profile', label: 'Profile', icon: 'boy', path: '/dashboard/profile' },
];

const SOON_NAV: NavItem[] = [
    { id: 'extension', label: 'Extension', icon: 'flash', path: '/dashboard/extension' },
    { id: 'redemption', label: 'Redeem', icon: 'star', comingSoon: true, path: '/dashboard/redemption' },
];

const NAV_ITEMS = [...PRIMARY_NAV, ...SECONDARY_NAV, ...SOON_NAV];

type InboxNotification = {
    id: string
    title: string
    body: string
    type?: string
    href?: string | null
    imageUrl?: string | null
    readAt?: string | null
    createdAt?: string
}

const NotificationBell = () => {
    const { user } = useSupabase();
    const navigate = useNavigate();
    const [notifications, setNotifications] = useState<InboxNotification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    const applyInbox = (payload: { items?: InboxNotification[]; unreadCount?: number } | InboxNotification[] | null | undefined) => {
        const items = Array.isArray(payload) ? payload : payload?.items || [];
        const unread = Array.isArray(payload)
            ? items.filter((n) => !n.readAt).length
            : typeof payload?.unreadCount === 'number'
                ? payload.unreadCount
                : items.filter((n) => !n.readAt).length;
        setNotifications(items);
        setUnreadCount(unread);
    };

    const authHeaders = user?.id ? { 'x-user-id': user.id } : undefined;

    useEffect(() => {
        if (!user?.id && !user?.email) return;
        const load = async () => {
            setLoading(true);
            const res = await api.get<{ items: InboxNotification[]; unreadCount: number }>(
                '/api/notifications',
                { headers: authHeaders, timeoutMs: 8000 },
            );
            if (!isApiError(res) && res.data) applyInbox(res.data);
            setLoading(false);
        };
        load();
        const interval = setInterval(load, 30000);
        return () => clearInterval(interval);
    }, [user?.id, user?.email]);

    const handleOpen = async () => {
        const next = !isOpen;
        setIsOpen(next);
        if (next && unreadCount > 0) {
            setUnreadCount(0);
            const res = await api.patch<{ items: InboxNotification[]; unreadCount: number }>(
                '/api/notifications/read-all',
                {},
                { headers: authHeaders },
            );
            if (!isApiError(res) && res.data) applyInbox(res.data);
        }
    };

    const handleOpenItem = async (n: InboxNotification) => {
        setNotifications((prev) => prev.filter((x) => x.id !== n.id));
        if (n.href && n.href.startsWith('/')) {
            setIsOpen(false);
            navigate(n.href);
        }
        await api.post(`/api/notifications/${n.id}/dismiss`, {}, { headers: authHeaders });
    };

    const handleDismiss = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setNotifications((prev) => prev.filter((n) => n.id !== id));
        const res = await api.post<{ items: InboxNotification[]; unreadCount: number }>(
            `/api/notifications/${id}/dismiss`,
            {},
            { headers: authHeaders },
        );
        if (!isApiError(res) && res.data) applyInbox(res.data);
    };

    return (
        <div className="relative z-[100]">
            <button 
                onClick={handleOpen}
                className="w-11 h-11 rounded-2xl border border-white/10 bg-white/[0.03] flex items-center justify-center text-white/35 hover:text-white hover:border-white/20 transition-all relative group"
            >
                <Icon3d
                    name="megaphone"
                    className={`h-[22px] w-[22px] object-contain transition-transform ${isOpen ? 'scale-110' : 'group-hover:rotate-12'}`}
                    alt=""
                />
                {unreadCount > 0 && (
                    <div className="absolute -top-1 -right-1 min-w-[1.125rem] h-[1.125rem] px-1 bg-clay rounded-full shadow-[0_0_12px_rgba(52,211,153,0.8)] flex items-center justify-center text-[8px] text-black font-black leading-none">
                        {unreadCount}
                    </div>
                )}
            </button>

            <AnimatePresence>
                {isOpen && (
                    <>
                        <motion.div 
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            onClick={() => setIsOpen(false)}
                            className="fixed inset-0 z-40"
                        />
                        <motion.div 
                            initial={{ opacity: 0, y: 8, scale: 0.98 }} 
                            animate={{ opacity: 1, y: 0, scale: 1 }} 
                            exit={{ opacity: 0, y: 8, scale: 0.98 }}
                            transition={{ type: 'spring', bounce: 0, duration: 0.35 }}
                            className="fixed sm:absolute top-[4.5rem] sm:top-[120%] right-3 sm:right-0 w-[min(22rem,calc(100vw-1.5rem))] bg-black/90 backdrop-blur-2xl border border-white/10 shadow-2xl rounded-3xl z-50 overflow-hidden"
                        >
                            <div className="p-5 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                                <h3 className="font-bold text-white text-sm tracking-widest uppercase">Notifications</h3>
                                <span className="text-[10px] text-clay font-mono">{notifications.length} Active</span>
                            </div>
                            
                            <div className="max-h-[60vh] overflow-y-auto dashboard-scroll p-2">
                                {notifications.length === 0 ? (
                                    <div className="p-8 text-center text-white/30 text-xs font-bold uppercase tracking-widest">
                                        {loading ? 'Loading…' : 'No notifications yet'}
                                    </div>
                                ) : (
                                    <div className="space-y-1">
                                        {notifications.map(n => (
                                            <div 
                                                key={n.id} 
                                                onClick={() => handleOpenItem(n)}
                                                className="p-4 rounded-2xl hover:bg-white/[0.03] transition-colors cursor-pointer group flex flex-col gap-3 relative"
                                            >
                                                <button
                                                    type="button"
                                                    onClick={(e) => handleDismiss(e, n.id)}
                                                    className="absolute top-3 right-3 text-white/20 hover:text-white/70 p-1"
                                                    aria-label="Dismiss notification"
                                                >
                                                    <X size={12} />
                                                </button>
                                                <div className="flex gap-4">
                                                    <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${n.readAt ? 'bg-white/20' : 'bg-clay shadow-[0_0_8px_#00933b]'}`} />
                                                    <div className="flex-1 pr-4">
                                                        <h4 className="text-white text-sm font-bold mb-1">{n.title}</h4>
                                                        <p className="text-white/60 text-xs leading-relaxed">{n.body}</p>
                                                    </div>
                                                </div>
                                                {n.imageUrl && (
                                                    <div className="w-full h-32 rounded-xl overflow-hidden mt-1 border border-white/5 relative ml-6">
                                                        <img src={n.imageUrl} alt="" className="w-full h-full object-cover" />
                                                    </div>
                                                )}
                                                <div className="pl-6">
                                                    <p className="text-[9px] uppercase tracking-widest text-white/20 font-mono">
                                                        {n.createdAt ? new Date(n.createdAt).toLocaleDateString() : ''}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
};

const KEEP_ALIVE_TABS = ['home', 'offers', /* 'browse', */ 'giftcards', 'expenses', 'planning', 'bills', 'referrals', 'profile'] as const;

const DashboardLayout: React.FC = () => {
    const { user } = useSupabase();
    const navigate = useNavigate();
    const location = useLocation();
    
    const reduceMotion = useReducedMotion();
    const [isSidebarOpen, setIsSidebarOpen] = useState(
        () => typeof window === 'undefined' || window.innerWidth >= 768
    );
    const [mountedTabs, setMountedTabs] = useState<Set<string>>(() => {
        try {
            const raw = sessionStorage.getItem('yureka-mounted-tabs')
            if (raw) {
                const parsed = JSON.parse(raw) as string[]
                if (Array.isArray(parsed) && parsed.length) return new Set(parsed)
            }
        } catch { /* ignore */ }
        return new Set(['home'])
    });

    const activeTab = NAV_ITEMS.find(i => i.path && (location.pathname === i.path || location.pathname.startsWith(i.path + '/')))?.id
        || (location.pathname === '/dashboard' || location.pathname === '/dashboard/' ? 'home' : 'home');

    useEffect(() => {
        if (!KEEP_ALIVE_TABS.includes(activeTab as typeof KEEP_ALIVE_TABS[number])) return;
        setMountedTabs((prev) => {
            if (prev.has(activeTab)) return prev;
            const next = new Set(prev);
            next.add(activeTab);
            return next;
        });
    }, [activeTab]);

    useEffect(() => {
        try {
            sessionStorage.setItem('yureka-mounted-tabs', JSON.stringify([...mountedTabs]))
        } catch { /* ignore */ }
    }, [mountedTabs]);

    // Warm Goldback / Offers / Gift cards in the background so the first tab
    // switch is instant and served from keep-alive + dashboardCache.
    useEffect(() => {
        const t = window.setTimeout(() => {
            setMountedTabs((prev) => {
                const next = new Set(prev);
                next.add('offers');
                next.add('giftcards');
                // next.add('browse');
                return next;
            });
        }, 450);
        return () => window.clearTimeout(t);
    }, []);

    const isGiftOrder = /\/dashboard\/giftcards\/orders\//.test(location.pathname);
    const isNativeEmbedded =
        typeof window !== 'undefined' &&
        (window.navigator.userAgent.includes('YurekaApp') ||
            new URLSearchParams(window.location.search).get('embedded') === '1');
    // In-app Super Browse / embed paused — leave the wiring here to restore later.
    // const isExplore = /^\/dashboard\/explore(\/|$)/.test(location.pathname);
    // const browseHasUrl =
    //     location.pathname.startsWith('/dashboard/browse') &&
    //     new URLSearchParams(location.search).has('url');
    // const isEmbeddedBrowse = isExplore || browseHasUrl;
    const isExplore = false;
    const isEmbeddedBrowse = isNativeEmbedded;
    const useKeepAlive =
        KEEP_ALIVE_TABS.includes(activeTab as typeof KEEP_ALIVE_TABS[number]) &&
        !isGiftOrder &&
        !isExplore;

    const keepAlivePanels = useMemo(() => ({
        home: <GoldbackHome />,
        offers: <OffersPage />,
        // browse: <SuperBrowsePage />,
        giftcards: <GiftCardsPage />,
        expenses: <Expenses />,
        planning: <ExpensePlanning />,
        bills: <Bills />,
        referrals: <ReferralDashboard />,
        profile: <AccountSettings />,
    }), []);

    const handleLogout = async () => {
        cacheInvalidate('auth');
        cacheInvalidate('giftcards');
        cacheInvalidate('goldback');
        cacheInvalidate('offers');
        try { sessionStorage.removeItem('yureka-mounted-tabs') } catch { /* ignore */ }
        await signOutGmail();
        navigate('/');
    };

    const renderEmpty = () => (
        <div className="flex flex-col items-center justify-center h-full text-center py-20">
            <motion.div 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-20 h-20 bg-clay/10 rounded-[1.75rem] flex items-center justify-center border border-clay/20 mb-6"
            >
                <Icon3d name="star" className="h-10 w-10 object-contain" alt="" />
            </motion.div>
            <h2 className="text-3xl font-black tracking-tight text-white mb-3">Coming soon</h2>
            <p className="text-white/40 max-w-sm mx-auto text-[15px] leading-relaxed">
                This piece of Yureka is still baking. Goldback and Offers are live today.
            </p>
            <Link
                to="/dashboard/offers"
                className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-clay text-black px-6 py-3.5 text-[11px] font-black uppercase tracking-[0.2em] hover:brightness-110 transition"
            >
                Browse offers
            </Link>
        </div>
    );

    const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Member';
    const isCoreTab = activeTab === 'home' || activeTab === 'offers' || activeTab === 'giftcards' /* || activeTab === 'browse' */;
    const activeLabel = NAV_ITEMS.find(i => i.id === activeTab)?.label || 'Home';
    const avatarUrl = googleAvatarUrl(user);

    const NavLink = ({ item, idx }: { item: NavItem; idx: number }) => {
        const active = activeTab === item.id
        return (
        <Link to={item.path!} onClick={() => { if (window.innerWidth < 768) setIsSidebarOpen(false); }}>
            <motion.div
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ type: 'spring', bounce: 0, duration: 0.4, delay: idx * 0.02 }}
                whileTap={{ scale: 0.97 }}
                className={
                    isSidebarOpen
                        ? `w-full flex items-center gap-3 px-3 py-2.5 rounded-[1.15rem] ${
                              active
                                  ? 'bg-white/[0.12] text-white'
                                  : 'text-white/45 hover:bg-white/[0.06] hover:text-white'
                          }`
                        : `mx-auto flex h-11 w-11 items-center justify-center rounded-[1.05rem] ${
                              active
                                  ? 'bg-white/[0.14] text-white'
                                  : 'text-white/40 hover:bg-white/[0.08] hover:text-white'
                          }`
                }
            >
                <Icon3d
                    name={item.icon}
                    className={`h-6 w-6 object-contain shrink-0 ${active ? 'scale-110' : 'opacity-80'}`}
                    alt=""
                />
                {isSidebarOpen && (
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="text-[13px] font-medium tracking-[-0.01em] truncate">{item.label}</span>
                        {item.comingSoon && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${
                                active ? 'bg-white/10 text-white/55' : 'bg-white/5 text-white/30'
                            }`}>Soon</span>
                        )}
                    </div>
                )}
            </motion.div>
        </Link>
        )
    };

    const MOBILE_TABS = PRIMARY_NAV;

    return (
        <div className="h-dvh min-h-0 bg-[#070707] flex overflow-hidden font-sans selection:bg-clay selection:text-black safe-area-x">
            {isSidebarOpen && (
                <button
                    type="button"
                    aria-label="Close menu"
                    onClick={() => setIsSidebarOpen(false)}
                    className="md:hidden fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
                />
            )}

            <aside className={`fixed md:relative z-50 h-dvh md:h-full border-r border-white/[0.07] bg-[#0a0a0a]/95 backdrop-blur-xl md:backdrop-blur-none md:bg-[#0a0a0a] transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] md:transition-[width] ${
                isSidebarOpen ? 'translate-x-0 w-[min(17.5rem,88vw)]' : '-translate-x-full md:translate-x-0 md:w-[4.5rem]'
            }`}
            style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
            >
                <div className={`h-full flex flex-col ${isSidebarOpen ? 'p-5' : 'px-2 py-5'}`}>
                    <div className={`flex items-center mb-8 ${isSidebarOpen ? 'gap-3 px-1' : 'justify-center'}`}>
                        <YurekaBrandMark className="w-11 h-11 rounded-2xl object-cover shrink-0 shadow-[0_0_20px_rgba(0,147,59,0.28)]" />
                        {isSidebarOpen && (
                            <div className="flex flex-col min-w-0">
                                <span className="text-[17px] font-semibold tracking-[-0.03em] text-white leading-none">Yureka</span>
                                <span className="text-[11px] font-medium tracking-[0.04em] text-clay/80 mt-1">Goldback</span>
                            </div>
                        )}
                        <button
                            type="button"
                            aria-label="Close menu"
                            onClick={() => setIsSidebarOpen(false)}
                            className="md:hidden ml-auto w-10 h-10 rounded-full bg-white/[0.06] flex items-center justify-center text-white/50 active:scale-[0.97]"
                        >
                            <X size={16} />
                        </button>
                    </div>

                    <nav className="flex-1 space-y-5 dashboard-scroll overflow-y-auto pr-1">
                        <div className="space-y-1">
                            {isSidebarOpen && (
                                <p className="px-4 pb-1 text-[9px] font-black uppercase tracking-[0.3em] text-white/25">Earn</p>
                            )}
                            {PRIMARY_NAV.map((item, idx) => (
                                <NavLink key={item.id} item={item} idx={idx} />
                            ))}
                        </div>
                        <div className="space-y-1">
                            {isSidebarOpen && (
                                <p className="px-4 pb-1 text-[9px] font-black uppercase tracking-[0.3em] text-white/25">Account</p>
                            )}
                            {SECONDARY_NAV.map((item, idx) => (
                                <NavLink key={item.id} item={item} idx={idx + 2} />
                            ))}
                        </div>
                        <div className="space-y-1">
                            {isSidebarOpen && (
                                <p className="px-4 pb-1 text-[9px] font-black uppercase tracking-[0.3em] text-white/25">Next</p>
                            )}
                            {SOON_NAV.map((item, idx) => (
                                <NavLink key={item.id} item={item} idx={idx + 7} />
                            ))}
                        </div>
                    </nav>

                    <div className="pt-4 border-t border-white/[0.07] mt-auto space-y-1">
                        <motion.button
                            type="button"
                            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                            whileTap={{ scale: 0.94 }}
                            transition={{ type: 'spring', bounce: 0, duration: 0.35 }}
                            aria-label={isSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
                            title={isSidebarOpen ? 'Collapse' : 'Expand'}
                            className={
                                isSidebarOpen
                                    ? 'hidden md:flex w-full items-center gap-3 px-3 py-2.5 rounded-[1.15rem] text-white/50 hover:bg-white/[0.08] hover:text-white'
                                    : 'hidden md:flex mx-auto h-11 w-11 items-center justify-center rounded-[1.05rem] bg-white/[0.08] text-white/70 hover:bg-white/[0.12] hover:text-white'
                            }
                        >
                            {isSidebarOpen ? <PanelLeftClose size={18} strokeWidth={1.8} /> : <PanelLeft size={18} strokeWidth={1.8} />}
                            {isSidebarOpen && <span className="text-[13px] font-medium tracking-[-0.01em]">Collapse</span>}
                        </motion.button>
                        <button 
                            onClick={handleLogout}
                            className={
                                isSidebarOpen
                                    ? 'w-full flex items-center gap-3 px-3 py-2.5 rounded-[1.15rem] text-white/40 hover:bg-red-500/10 hover:text-red-300'
                                    : 'mx-auto flex h-11 w-11 items-center justify-center rounded-[1.05rem] text-white/40 hover:bg-red-500/10 hover:text-red-300'
                            }
                        >
                            <Icon3d name="lock" className="h-6 w-6 object-contain" alt="" />
                            {isSidebarOpen && <span className="text-[13px] font-medium tracking-[-0.01em]">Sign out</span>}
                        </button>
                    </div>
                </div>
            </aside>

            <main className={`flex-1 relative min-w-0 min-h-0 ${
                isEmbeddedBrowse
                    ? 'flex flex-col overflow-hidden'
                    : 'overflow-y-auto overflow-x-hidden dashboard-scroll pb-[calc(4.75rem+env(safe-area-inset-bottom,0px))] md:pb-10'
            }`}>
                {shouldHandoffToNativeApp() ? (
                    <div
                        className="sticky top-0 z-50 px-4 py-3 bg-emerald-500/10 border-b border-emerald-500/25 text-center"
                        style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top, 0px))' }}
                    >
                        <p className="text-sm text-white/80">
                            You&apos;re viewing Yureka in Safari. Use the native app from your home screen for the real mobile experience.
                        </p>
                        <button
                            type="button"
                            onClick={() => tryOpenNativeApp()}
                            className="mt-2 text-emerald-400 font-bold text-sm"
                        >
                            Open Yureka app
                        </button>
                    </div>
                ) : null}
                {!isEmbeddedBrowse && (
                <div
                    className="sticky top-0 z-30 flex items-center justify-between gap-3 px-4 sm:px-5 md:px-10 py-3 md:py-4 bg-[#070707]/80 backdrop-blur-xl border-b border-white/[0.05]"
                    style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top, 0px))' }}
                >
                    <div className="flex items-center gap-3 min-w-0">
                        <YurekaBrandMark className="md:hidden h-8 w-8 rounded-xl object-cover shrink-0" />
                        <div className="md:hidden flex flex-col min-w-0">
                            <span className="text-[9px] font-black uppercase tracking-[0.28em] text-white/30">Yureka</span>
                            <h1 className="text-base font-black tracking-tight text-white truncate leading-tight">
                                {activeLabel}
                            </h1>
                        </div>
                        {!isCoreTab && (
                            <h1 className="hidden md:block text-xl font-black tracking-tight text-white truncate">{activeLabel}</h1>
                        )}
                        {isCoreTab && (
                            <p className="text-[10px] font-black uppercase tracking-[0.35em] text-white/30 hidden md:block">
                                Discount → Goldback → redeem
                            </p>
                        )}
                    </div>
                    <div className="flex items-center gap-2.5 sm:gap-4 shrink-0">
                        <NotificationBell />
                        <Link
                            to="/dashboard/profile"
                            className="flex items-center gap-3 pl-2.5 sm:pl-3 border-l border-white/10 active:scale-[0.97] transition-transform duration-100"
                            aria-label="Open profile"
                        >
                            <div className="text-right hidden sm:block">
                                <p className="text-[9px] font-black uppercase tracking-[0.25em] text-white/25">Member</p>
                                <p className="text-xs font-bold text-white mt-0.5 truncate max-w-[9rem]">{displayName}</p>
                            </div>
                            <div className="w-10 h-10 sm:w-11 sm:h-11 bg-clay text-black rounded-2xl overflow-hidden flex items-center justify-center font-black text-base shadow-[0_0_24px_rgba(52,211,153,0.25)]">
                                {avatarUrl ? (
                                    <img src={avatarUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                                ) : (
                                    displayName[0]?.toUpperCase() || 'U'
                                )}
                            </div>
                        </Link>
                    </div>
                </div>
                )}

                <div className={isEmbeddedBrowse ? 'flex min-h-0 flex-1 flex-col' : 'p-4 sm:p-5 md:p-10 max-w-6xl mx-auto'}>
                    {activeTab === 'home' && !isEmbeddedBrowse && <WelcomeBanner />}
                    {/* Keep primary tabs mounted so switching doesn't remount / refetch */}
                    {useKeepAlive && (
                        <div className={isEmbeddedBrowse ? 'flex min-h-0 flex-1 flex-col' : undefined}>
                            {(Object.keys(keepAlivePanels) as Array<keyof typeof keepAlivePanels>).map((id) => {
                                if (!mountedTabs.has(id)) return null
                                const active = activeTab === id
                                return (
                                    <div
                                        key={id}
                                        hidden={!active}
                                        aria-hidden={!active}
                                        className={
                                          active
                                            ? isEmbeddedBrowse
                                              ? 'flex min-h-0 flex-1 flex-col'
                                              : 'block'
                                            : 'hidden'
                                        }
                                    >
                                        {keepAlivePanels[id]}
                                    </div>
                                )
                            })}
                        </div>
                    )}
                    {!useKeepAlive && (
                        <div className={isEmbeddedBrowse ? 'flex min-h-0 flex-1 flex-col' : undefined}>
                        <Routes>
                            <Route index element={<Navigate to="home" replace />} />
                            <Route path="giftcards/orders/:orderId" element={<GiftCardOrderPage />} />
                            {/* <Route path="explore/:sceneId" element={<ExploreScenePage />} /> */}
                            <Route path="yureka-ai" element={<YurekaAIPage />} />
                            <Route path="join-waitlist" element={<WaitlistPage />} />
                            <Route path="extension" element={<ExtensionPage />} />
                            <Route path="*" element={renderEmpty()} />
                        </Routes>
                        </div>
                    )}
                    {/* Ensure /dashboard redirects even when keep-alive is active */}
                    {(location.pathname === '/dashboard' || location.pathname === '/dashboard/') && (
                        <Navigate to="home" replace />
                    )}
                    {location.pathname.startsWith('/dashboard/cards') && (
                        <Navigate to="/dashboard/home" replace />
                    )}
                </div>
            </main>

            {/* Mobile bottom tab bar — translucent material, content scrolls under */}
            {!isEmbeddedBrowse && (
            <nav
                className="md:hidden fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.08] bg-[#0a0a0a]/78 backdrop-blur-2xl"
                style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
                aria-label="Primary"
            >
                <div className="pointer-events-none absolute inset-x-0 -top-6 h-6 bg-gradient-to-t from-[#070707]/80 to-transparent" />
                <div className="grid grid-cols-4 h-[3.75rem]">
                    {MOBILE_TABS.map((item) => {
                        const active = activeTab === item.id
                        return (
                            <Link
                                key={item.id}
                                to={item.path}
                                className={`relative flex flex-col items-center justify-center gap-1 active:scale-[0.96] transition-transform duration-100 ${
                                    active ? 'text-clay' : 'text-white/35'
                                }`}
                            >
                                {/* {item.id === 'browse' && (
                                    <span className="absolute top-0.5 rounded-full bg-[#f5c542] px-1.5 text-[7px] font-black leading-4 text-black">
                                        NEW
                                    </span>
                                )} */}
                                <Icon3d
                                    name={item.icon}
                                    className={`h-6 w-6 object-contain ${active ? 'scale-110' : 'opacity-75'}`}
                                    alt=""
                                />
                                <span className="max-w-full truncate px-0.5 text-[9px] font-black uppercase tracking-[0.12em]">
                                    {item.label}
                                </span>
                            </Link>
                        )
                    })}
                    <button
                        type="button"
                        onClick={() => setIsSidebarOpen(true)}
                        className={`flex flex-col items-center justify-center gap-1 active:scale-[0.96] transition-transform duration-100 ${
                            !isCoreTab || isSidebarOpen ? 'text-clay' : 'text-white/35'
                        }`}
                        aria-label="More"
                    >
                        <Icon3d
                            name="plus"
                            className={`h-6 w-6 object-contain ${!isCoreTab || isSidebarOpen ? 'scale-110' : 'opacity-75'}`}
                            alt=""
                        />
                        <span className="text-[9px] font-black uppercase tracking-[0.12em]">More</span>
                    </button>
                </div>
            </nav>
            )}

            <AddToHomeScreen liftForTabBar={!isEmbeddedBrowse} />
        </div>
    );
};

export default DashboardLayout;

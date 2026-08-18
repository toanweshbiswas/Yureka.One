import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    Receipt, Wallet, Store,
    Gift, Zap, Sparkles, Users, User, Home,
    LogOut, Menu, Bell, Coins, MoreHorizontal, X
} from 'lucide-react';
import { useNavigate, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { useSupabase } from '@shared/SupabaseProvider';
import { signOutGmail } from '@shared/auth';
import AddToHomeScreen from '@shared/AddToHomeScreen';
import { cacheInvalidate } from '@shared/dashboardCache';
import WelcomeBanner from './WelcomeBanner';
import { googleAvatarUrl } from '@shared/userProfile';


// Sub-components (to be built)
import ReferralDashboard from './ReferralDashboard';
import AccountSettings from './AccountSettings';
import Expenses from './Expenses';
import Bills from './Bills';
import YurekaAIPage from '@landing/YurekaAIPage';
import WaitlistPage from '@app/WaitlistPage';
import GoldbackHome from './GoldbackHome';
import OffersPage from './OffersPage';
import GiftCardsPage from './GiftCardsPage';
import GiftCardOrderPage from './GiftCardOrderPage';

import { api, isApiError } from '@backend/lib/api/client';

type NavItem = {
    id: string
    label: string
    icon: typeof Coins
    path: string
    comingSoon?: boolean
}

const PRIMARY_NAV: NavItem[] = [
    { id: 'home', label: 'Home', icon: Home, path: '/dashboard/home' },
    { id: 'offers', label: 'Offers', icon: Store, path: '/dashboard/offers' },
    { id: 'giftcards', label: 'Gift cards', icon: Gift, path: '/dashboard/giftcards' },
];

const SECONDARY_NAV: NavItem[] = [
    { id: 'expenses', label: 'Expenses', icon: Receipt, path: '/dashboard/expenses' },
    { id: 'bills', label: 'Bills', icon: Wallet, path: '/dashboard/bills' },
    { id: 'referrals', label: 'Referrals', icon: Users, path: '/dashboard/referrals' },
    { id: 'profile', label: 'Profile', icon: User, path: '/dashboard/profile' },
];

const SOON_NAV: NavItem[] = [
    { id: 'extension', label: 'Extension', icon: Zap, comingSoon: true, path: '/dashboard/extension' },
    { id: 'redemption', label: 'Redeem', icon: Sparkles, comingSoon: true, path: '/dashboard/redemption' },
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
                <Bell size={18} className={`transition-transform ${isOpen ? 'text-clay' : 'group-hover:rotate-12'}`} />
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

const KEEP_ALIVE_TABS = ['home', 'offers', 'giftcards', 'expenses', 'bills', 'referrals', 'profile'] as const;

const DashboardLayout: React.FC = () => {
    const { user } = useSupabase();
    const navigate = useNavigate();
    const location = useLocation();
    
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
                return next;
            });
        }, 450);
        return () => window.clearTimeout(t);
    }, []);

    const isGiftOrder = /\/dashboard\/giftcards\/orders\//.test(location.pathname);
    const useKeepAlive = KEEP_ALIVE_TABS.includes(activeTab as typeof KEEP_ALIVE_TABS[number]) && !isGiftOrder;

    const keepAlivePanels = useMemo(() => ({
        home: <GoldbackHome />,
        offers: <OffersPage />,
        giftcards: <GiftCardsPage />,
        expenses: <Expenses />,
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
                <Sparkles size={32} className="text-clay" />
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
    const isCoreTab = activeTab === 'home' || activeTab === 'offers' || activeTab === 'giftcards';
    const activeLabel = NAV_ITEMS.find(i => i.id === activeTab)?.label || 'Home';
    const avatarUrl = googleAvatarUrl(user);

    const NavLink = ({ item, idx }: { item: NavItem; idx: number }) => (
        <Link to={item.path!} onClick={() => { if (window.innerWidth < 768) setIsSidebarOpen(false); }}>
            <motion.div
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.03 }}
                className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all group relative active:scale-[0.98] ${
                    activeTab === item.id
                        ? 'bg-white text-black shadow-lg shadow-white/5'
                        : 'text-white/35 hover:bg-white/[0.04] hover:text-white'
                }`}
            >
                <item.icon size={18} className={activeTab === item.id ? 'text-black' : 'group-hover:scale-110 transition-transform'} />
                {isSidebarOpen && (
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="text-[11px] font-black uppercase tracking-[0.15em] truncate">{item.label}</span>
                        {item.comingSoon && (
                            <span className={`text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded-md shrink-0 ${
                                activeTab === item.id ? 'bg-black/10 text-black/50' : 'bg-white/5 text-white/30'
                            }`}>Soon</span>
                        )}
                    </div>
                )}
            </motion.div>
        </Link>
    );

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
                isSidebarOpen ? 'translate-x-0 w-[min(17.5rem,88vw)]' : '-translate-x-full md:translate-x-0 md:w-[4.75rem]'
            }`}
            style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
            >
                <div className="h-full flex flex-col p-5">
                    <div className="flex items-center gap-3 mb-10 px-2">
                        <div className="w-11 h-11 bg-clay rounded-2xl flex items-center justify-center shrink-0 shadow-[0_0_28px_rgba(52,211,153,0.35)]">
                            <Coins size={20} className="text-black" />
                        </div>
                        {isSidebarOpen && (
                            <div className="flex flex-col min-w-0">
                                <span className="text-base font-black tracking-tight text-white leading-none">Yureka</span>
                                <span className="text-[9px] font-black uppercase tracking-[0.35em] text-clay/70 mt-1.5">Goldback</span>
                            </div>
                        )}
                        <button
                            type="button"
                            aria-label="Close menu"
                            onClick={() => setIsSidebarOpen(false)}
                            className="md:hidden ml-auto w-10 h-10 rounded-xl border border-white/10 flex items-center justify-center text-white/40 active:scale-[0.97]"
                        >
                            <span className="text-lg leading-none">×</span>
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

                    <div className="pt-5 border-t border-white/[0.07] mt-auto space-y-1">
                        <button
                            type="button"
                            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                            className="hidden md:flex w-full items-center gap-4 px-4 py-3 rounded-2xl text-white/25 hover:text-white/60 hover:bg-white/[0.03] transition text-[10px] font-black uppercase tracking-[0.2em]"
                        >
                            <Menu size={18} />
                            {isSidebarOpen && <span>Collapse</span>}
                        </button>
                        <button 
                            onClick={handleLogout}
                            className="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl text-white/30 hover:bg-red-500/10 hover:text-red-300 transition-all group"
                        >
                            <LogOut size={18} className="group-hover:-translate-x-0.5 transition-transform" />
                            {isSidebarOpen && <span className="text-[10px] font-black uppercase tracking-[0.25em]">Sign out</span>}
                        </button>
                    </div>
                </div>
            </aside>

            <main className="flex-1 relative overflow-y-auto overflow-x-hidden dashboard-scroll min-w-0 min-h-0 pb-[calc(4.75rem+env(safe-area-inset-bottom,0px))] md:pb-10">
                <div
                    className="sticky top-0 z-30 flex items-center justify-between gap-3 px-4 sm:px-5 md:px-10 py-3 md:py-4 bg-[#070707]/80 backdrop-blur-xl border-b border-white/[0.05]"
                    style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top, 0px))' }}
                >
                    <div className="flex items-center gap-3 min-w-0">
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

                <div className="p-4 sm:p-5 md:p-10 max-w-6xl mx-auto">
                    {activeTab === 'home' && <WelcomeBanner />}
                    {/* Keep primary tabs mounted so switching doesn't remount / refetch */}
                    {useKeepAlive && (
                        <div>
                            {(Object.keys(keepAlivePanels) as Array<keyof typeof keepAlivePanels>).map((id) => {
                                if (!mountedTabs.has(id)) return null
                                const active = activeTab === id
                                return (
                                    <div
                                        key={id}
                                        hidden={!active}
                                        aria-hidden={!active}
                                        className={active ? 'block' : 'hidden'}
                                    >
                                        {keepAlivePanels[id]}
                                    </div>
                                )
                            })}
                        </div>
                    )}
                    {!useKeepAlive && (
                        <Routes>
                            <Route index element={<Navigate to="home" replace />} />
                            <Route path="giftcards/orders/:orderId" element={<GiftCardOrderPage />} />
                            <Route path="yureka-ai" element={<YurekaAIPage />} />
                            <Route path="join-waitlist" element={<WaitlistPage />} />
                            <Route path="*" element={renderEmpty()} />
                        </Routes>
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
                                className={`flex flex-col items-center justify-center gap-1 active:scale-[0.96] transition-transform duration-100 ${
                                    active ? 'text-clay' : 'text-white/35'
                                }`}
                            >
                                <item.icon size={20} strokeWidth={active ? 2.4 : 1.8} />
                                <span className="text-[9px] font-black uppercase tracking-[0.12em]">{item.label}</span>
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
                        <MoreHorizontal size={20} strokeWidth={!isCoreTab ? 2.4 : 1.8} />
                        <span className="text-[9px] font-black uppercase tracking-[0.12em]">More</span>
                    </button>
                </div>
            </nav>

            <AddToHomeScreen liftForTabBar />
        </div>
    );
};

export default DashboardLayout;

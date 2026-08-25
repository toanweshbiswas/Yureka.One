import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
    Compass,
    Ellipsis,
    Gift,
    House,
    PanelLeft, PanelLeftClose, ShoppingBag, X,
} from 'lucide-react';
import { useNavigate, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { useSupabase } from '@shared/SupabaseProvider';
import { signOutGmail } from '@shared/auth';
import AddToHomeScreen from '@shared/AddToHomeScreen';
import { cacheInvalidate } from '@shared/dashboardCache';
import { startCatalogSync } from '@shared/catalogSync';
import WelcomeBanner from './WelcomeBanner';
import GmailSyncPrompt from './GmailSyncPrompt';
import NotificationBell from './NotificationBell';
import { googleAvatarUrl } from '@shared/userProfile';
import Icon3d from '@shared/Icon3d';
import YurekaBrandMark from '@shared/YurekaBrandMark';
import {
    restoreDashboardPosition,
    saveDashboardScroll,
} from '@shared/dashboardScroll';
import { ErrorBoundary } from '@shared/ErrorBoundary';


// Sub-components (to be built)
import ReferralDashboard from './ReferralDashboard';
import AccountSettings from './AccountSettings';
import Expenses from './Expenses';
import Bills from './Bills';
import ExpensePlanning from './ExpensePlanning';
import YurekaAIPage from '@landing/YurekaAIPage';
// import WaitlistPage from '@app/WaitlistPage'; // waitlist paused
import GoldbackHome from './GoldbackHome';
import OffersPage from './OffersPage';
import GiftCardsPage from './GiftCardsPage';
import GiftCardOrderPage from './GiftCardOrderPage';
import ExtensionPage from './ExtensionPage';
import SuperBrowsePage from './SuperBrowse';
import ExploreScenePage from './ExploreScenePage';
import GetawayPage from './Getaway/GetawayPage';
import { canUseInAppBrowse } from '@shared/pwaDisplay';
// import ExploreScenePage from './ExploreScenePage';
// import SuperBrowsePage from './SuperBrowse';

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
    { id: 'getaway', label: 'Join your getaway', icon: 'flash', path: '/dashboard/getaway' },
];

const BROWSE_NAV: NavItem = { id: 'browse', label: 'Explore', icon: 'flash', path: '/dashboard/browse' };

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

const NAV_ITEMS = [...PRIMARY_NAV, BROWSE_NAV, ...SECONDARY_NAV, ...SOON_NAV];

const TAB_ICONS: Record<string, typeof House> = {
    home: House,
    browse: Compass,
    offers: ShoppingBag,
    giftcards: Gift,
};

const TAB_LABELS: Record<string, string> = {
    home: 'Home',
    browse: 'Explore',
    offers: 'Offers',
    giftcards: 'Gifts',
};

const KEEP_ALIVE_TABS = ['home', 'offers', 'browse', 'giftcards', 'getaway', 'expenses', 'planning', 'bills', 'referrals', 'profile'] as const;

const SIDEBAR_PREF_KEY = 'yureka-sidebar-open'

function readSidebarOpenPref(): boolean {
    if (typeof window === 'undefined') return true
    // Mobile drawer always starts closed — avoids flash of open overlay on reload.
    if (window.innerWidth < 768) return false
    try {
        const raw = localStorage.getItem(SIDEBAR_PREF_KEY)
        if (raw === '0') return false
        if (raw === '1') return true
    } catch { /* ignore */ }
    return true
}

const DashboardLayout: React.FC = () => {
    const { user } = useSupabase();
    const navigate = useNavigate();
    const location = useLocation();
    const reduceMotion = useReducedMotion();
    const [isSidebarOpen, setIsSidebarOpen] = useState(readSidebarOpenPref);
    // Avoid width/transform transition fighting first paint (looks like a flicker).
    const [sidebarReady, setSidebarReady] = useState(false);
    const [mountedTabs, setMountedTabs] = useState<Set<string>>(() => {
        // On reload only keep the current route (+ home). Warming every tab
        // (Expenses + Planning + …) was stacking API work and nearly crashing.
        const initial = new Set<string>(['home'])
        try {
            const path = window.location.pathname
            const hit = NAV_ITEMS.find(
                (i) => i.path && (path === i.path || path.startsWith(i.path + '/')),
            )
            if (hit) initial.add(hit.id)
        } catch { /* ignore */ }
        return initial
    });

    useEffect(() => {
        const id = window.requestAnimationFrame(() => setSidebarReady(true))
        return () => window.cancelAnimationFrame(id)
    }, [])

    // Poll admin catalog revision so Super Browse / offers update without relaunching.
    useEffect(() => startCatalogSync(), [])

    useEffect(() => {
        // Only remember collapse preference on desktop.
        if (typeof window === 'undefined' || window.innerWidth < 768) return
        try {
            localStorage.setItem(SIDEBAR_PREF_KEY, isSidebarOpen ? '1' : '0')
        } catch { /* ignore */ }
    }, [isSidebarOpen])

    useEffect(() => {
        let wasDesktop = window.innerWidth >= 768
        const onResize = () => {
            const desktop = window.innerWidth >= 768
            if (wasDesktop && !desktop) setIsSidebarOpen(false)
            if (!wasDesktop && desktop) setIsSidebarOpen(readSidebarOpenPref())
            wasDesktop = desktop
        }
        window.addEventListener('resize', onResize)
        return () => window.removeEventListener('resize', onResize)
    }, [])

    const activeTab = NAV_ITEMS.find(i => i.path && (location.pathname === i.path || location.pathname.startsWith(i.path + '/')))?.id
        || (location.pathname === '/dashboard' || location.pathname === '/dashboard/' ? 'home' : 'home');

    // Blur focus when parking a keep-alive panel so a11y doesn't see focused+hidden.
    useEffect(() => {
        const el = document.activeElement
        if (!(el instanceof HTMLElement)) return
        const panel = el.closest('[data-keepalive-panel]')
        if (!panel) return
        if (panel.hasAttribute('hidden') || panel.hasAttribute('inert')) {
            el.blur()
        }
    }, [activeTab, location.pathname])

    const mainRef = useRef<HTMLElement | null>(null)
    const prevPathRef = useRef(location.pathname)
    const prevSearchRef = useRef(location.search)

    const onMainScroll = useCallback(() => {
        // Don't persist scroll while the in-app store chrome is fullscreen.
        if (new URLSearchParams(location.search).has('url')) return
        saveDashboardScroll(location.pathname)
    }, [location.pathname, location.search])

    useEffect(() => {
        const pathChanged = prevPathRef.current !== location.pathname
        const searchChanged = prevSearchRef.current !== location.search
        const leftEmbedded =
            new URLSearchParams(prevSearchRef.current).has('url') &&
            !new URLSearchParams(location.search).has('url')
        prevPathRef.current = location.pathname
        prevSearchRef.current = location.search

        if (new URLSearchParams(location.search).has('url')) return
        if (!pathChanged && !searchChanged && !leftEmbedded && !location.hash) return

        restoreDashboardPosition({
            pathname: location.pathname,
            hash: location.hash,
        })
    }, [location.pathname, location.search, location.hash])

    useEffect(() => {
        const onShow = () => {
            if (document.visibilityState && document.visibilityState !== 'visible') return
            if (new URLSearchParams(location.search).has('url')) return
            restoreDashboardPosition({
                pathname: location.pathname,
                hash: location.hash,
            })
        }
        window.addEventListener('pageshow', onShow)
        document.addEventListener('visibilitychange', onShow)
        return () => {
            window.removeEventListener('pageshow', onShow)
            document.removeEventListener('visibilitychange', onShow)
        }
    }, [location.pathname, location.search, location.hash])

    useEffect(() => {
        if (!KEEP_ALIVE_TABS.includes(activeTab as typeof KEEP_ALIVE_TABS[number])) return;
        setMountedTabs((prev) => {
            if (prev.has(activeTab) && prev.size <= 4) return prev;
            const next = new Set<string>(['home', activeTab]);
            // Keep at most 3 previously visited light tabs
            for (const id of prev) {
                if (next.size >= 4) break
                if (id === 'expenses' || id === 'planning' || id === 'bills') continue
                next.add(id)
            }
            next.add(activeTab)
            return next;
        });
    }, [activeTab]);

    useEffect(() => {
        try {
            sessionStorage.setItem('yureka-mounted-tabs', JSON.stringify([...mountedTabs]))
        } catch { /* ignore */ }
    }, [mountedTabs]);

    // Warm Offers only on desktop after idle — dual-mount of Offers+Gifts was
    // spiking memory/CPU on mobile and felt like crashes + slow first load.
    useEffect(() => {
        if (typeof window !== 'undefined' && window.innerWidth < 768) return
        const t = window.setTimeout(() => {
            const warm = () => {
                setMountedTabs((prev) => {
                    if (prev.size >= 3 || prev.has('offers')) return prev
                    const next = new Set(prev);
                    next.add('offers');
                    return next;
                });
            };
            if (typeof requestIdleCallback === 'function') {
                requestIdleCallback(warm, { timeout: 8000 });
            } else {
                warm();
            }
        }, 8000);
        return () => window.clearTimeout(t);
    }, []);

    const isGiftOrder = /\/dashboard\/giftcards\/orders\//.test(location.pathname);
    // Persist the embedded flag in sessionStorage so it survives React Router
    // redirects (e.g. /login → back to /dashboard after auth) that drop the
    // ?embedded=1 query param. YurekaApp UA also signals the native WebView shell.
    const isNativeEmbedded = (() => {
        if (typeof window === 'undefined') return false;
        if (window.navigator.userAgent.includes('YurekaApp')) return true;
        if (new URLSearchParams(window.location.search).get('embedded') === '1') {
            try { sessionStorage.setItem('yureka-embedded', '1'); } catch { /* ignore */ }
            return true;
        }
        try {
            return sessionStorage.getItem('yureka-embedded') === '1';
        } catch {
            return false;
        }
    })();
    const pwaBrowse = canUseInAppBrowse();
    const isExplore = /^\/dashboard\/explore(\/|$)/.test(location.pathname);
    // Any /browse?url= session uses the fullscreen store chrome — not only installed PWAs.
    // That keeps Super Browse inside Yureka instead of Universal-Linking into merchant apps.
    const browseHasUrl =
        location.pathname.startsWith('/dashboard/browse') &&
        new URLSearchParams(location.search).has('url');
    const isEmbeddedBrowse = isNativeEmbedded || isExplore || browseHasUrl;
    const useKeepAlive =
        KEEP_ALIVE_TABS.includes(activeTab as typeof KEEP_ALIVE_TABS[number]) &&
        !isGiftOrder &&
        !isExplore;

    const keepAlivePanels = useMemo(() => ({
        home: <GoldbackHome />,
        offers: <OffersPage />,
        browse: <SuperBrowsePage />,
        giftcards: <GiftCardsPage />,
        getaway: <GetawayPage />,
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
    const isCoreTab = activeTab === 'home' || activeTab === 'offers' || activeTab === 'giftcards' || activeTab === 'browse';
    const activeLabel = NAV_ITEMS.find(i => i.id === activeTab)?.label || 'Home';
    const avatarUrl = googleAvatarUrl(user);

    const NavLink = ({ item }: { item: NavItem }) => {
        const active = activeTab === item.id
        return (
        <Link to={item.path!} onClick={() => { if (window.innerWidth < 768) setIsSidebarOpen(false); }}>
            <div
                className={
                    isSidebarOpen
                        ? `w-full flex items-center gap-3 px-3 py-2.5 rounded-[1.15rem] transition-colors duration-150 ${
                              active
                                  ? 'bg-white/[0.12] text-white'
                                  : 'text-white/45 hover:bg-white/[0.06] hover:text-white'
                          }`
                        : `mx-auto flex h-11 w-11 items-center justify-center rounded-[1.05rem] transition-colors duration-150 ${
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
            </div>
        </Link>
        )
    };

    const MOBILE_TABS = pwaBrowse
        ? [
            PRIMARY_NAV[0],
            BROWSE_NAV,
            PRIMARY_NAV[1],
            PRIMARY_NAV[2],
          ]
        : PRIMARY_NAV;

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

            <aside className={`fixed md:relative z-50 h-dvh md:h-full border-r border-white/[0.07] bg-[#0a0a0a]/95 backdrop-blur-xl md:backdrop-blur-none md:bg-[#0a0a0a] ${
                sidebarReady
                    ? 'transition-transform duration-300 ease-out md:transition-[width] md:duration-300'
                    : ''
            } ${
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
                            {PRIMARY_NAV.map((item) => (
                                <NavLink key={item.id} item={item} />
                            ))}
                        </div>
                        <div className="space-y-1">
                            {isSidebarOpen && (
                                <p className="px-4 pb-1 text-[9px] font-black uppercase tracking-[0.3em] text-white/25">Account</p>
                            )}
                            {SECONDARY_NAV.map((item) => (
                                <NavLink key={item.id} item={item} />
                            ))}
                        </div>
                        <div className="space-y-1">
                            {isSidebarOpen && (
                                <p className="px-4 pb-1 text-[9px] font-black uppercase tracking-[0.3em] text-white/25">Next</p>
                            )}
                            {SOON_NAV.map((item) => (
                                <NavLink key={item.id} item={item} />
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

            <main
                ref={mainRef}
                onScroll={onMainScroll}
                className={`flex-1 relative min-w-0 min-h-0 ${
                isEmbeddedBrowse
                    ? 'flex flex-col overflow-hidden'
                    : 'overflow-y-auto overflow-x-hidden dashboard-scroll pb-[calc(4.75rem+env(safe-area-inset-bottom,0px))] md:pb-10'
            }`}>
                {!isEmbeddedBrowse && (
                <div
                    className={`sticky top-0 z-30 items-center justify-between gap-3 px-4 sm:px-5 md:px-10 py-3 md:py-4 bg-[#070707]/80 backdrop-blur-xl border-b border-white/[0.05] ${
                        activeTab === 'home' ? 'hidden md:flex' : 'flex'
                    }`}
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

                <div
                    className={
                        isEmbeddedBrowse
                            ? 'flex min-h-0 flex-1 flex-col'
                            : activeTab === 'home'
                              ? // Mobile home hides sticky chrome — content must clear the status bar itself.
                                'max-w-6xl mx-auto px-4 pb-4 sm:px-5 sm:pb-5 md:p-10 pt-[max(1rem,calc(env(safe-area-inset-top,0px)+0.75rem))] md:pt-10'
                              : 'p-4 sm:p-5 md:p-10 max-w-6xl mx-auto'
                    }
                >
                    {!isEmbeddedBrowse && <GmailSyncPrompt />}
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
                                        data-keepalive-panel={id}
                                        hidden={!active}
                                        // Prefer inert over aria-hidden so a focused child
                                        // inside a parked tab doesn't trip a11y warnings.
                                        inert={!active ? true : undefined}
                                        className={
                                          active
                                            ? isEmbeddedBrowse
                                              ? 'flex min-h-0 flex-1 flex-col'
                                              : 'block'
                                            : 'hidden'
                                        }
                                    >
                                        <ErrorBoundary
                                            fallback={
                                                <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-6 text-center">
                                                    <p className="text-sm font-medium text-red-100/90">
                                                        This tab hit an error.
                                                    </p>
                                                    <button
                                                        type="button"
                                                        className="mt-3 text-[12px] font-semibold text-clay underline"
                                                        onClick={() => window.location.reload()}
                                                    >
                                                        Reload
                                                    </button>
                                                </div>
                                            }
                                        >
                                            {keepAlivePanels[id]}
                                        </ErrorBoundary>
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
                            <Route path="getaway/*" element={<GetawayPage />} />
                            <Route path="explore/:sceneId" element={<ExploreScenePage />} />
                            <Route path="browse" element={<SuperBrowsePage />} />
                            <Route path="yureka-ai" element={<YurekaAIPage />} />
                            {/* Waitlist paused — restore WaitlistPage when VITE_WAITLIST_REQUIRED=true */}
                            <Route path="join-waitlist" element={<Navigate to="/dashboard/home" replace />} />
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

            {/* Mobile tab bar — iOS-style: equal cells, system type, glass, safe area */}
            {!isEmbeddedBrowse && (
            <nav
                className="md:hidden fixed inset-x-0 bottom-0 z-40"
                style={{
                    paddingBottom: 'env(safe-area-inset-bottom, 0px)',
                    background: 'rgba(10, 10, 10, 0.72)',
                    backdropFilter: 'blur(20px) saturate(180%)',
                    WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                    boxShadow: '0 -0.5px 0 rgba(255,255,255,0.18)',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif',
                }}
                aria-label="Primary"
            >
                <div
                    className={`grid ${pwaBrowse ? 'grid-cols-5' : 'grid-cols-4'}`}
                    style={{ height: 49 }}
                >
                    {MOBILE_TABS.map((item) => {
                        const active = activeTab === item.id
                        const Icon = TAB_ICONS[item.id] || House
                        return (
                            <Link
                                key={item.id}
                                to={item.path}
                                aria-current={active ? 'page' : undefined}
                                className="flex h-full min-w-0 flex-col items-center justify-center select-none"
                            >
                                <motion.span
                                    whileTap={{ scale: 0.92 }}
                                    transition={{ type: 'spring', bounce: 0, duration: 0.2 }}
                                    className="flex flex-col items-center justify-center gap-[3px]"
                                >
                                    <Icon
                                        size={22}
                                        strokeWidth={active ? 2.25 : 1.75}
                                        className={active ? 'text-clay' : 'text-white/45'}
                                    />
                                    <span
                                        className={`text-[10px] font-medium leading-none tracking-tight ${
                                            active ? 'text-clay' : 'text-white/45'
                                        }`}
                                    >
                                        {TAB_LABELS[item.id] || item.label}
                                    </span>
                                </motion.span>
                            </Link>
                        )
                    })}
                    <button
                        type="button"
                        onClick={() => setIsSidebarOpen(true)}
                        className="flex h-full min-w-0 flex-col items-center justify-center select-none"
                        aria-label="More"
                        aria-expanded={isSidebarOpen}
                    >
                        <motion.span
                            whileTap={{ scale: 0.92 }}
                            transition={{ type: 'spring', bounce: 0, duration: 0.2 }}
                            className="flex flex-col items-center justify-center gap-[3px]"
                        >
                            <Ellipsis
                                size={22}
                                strokeWidth={!isCoreTab || isSidebarOpen ? 2.25 : 1.75}
                                className={!isCoreTab || isSidebarOpen ? 'text-clay' : 'text-white/45'}
                            />
                            <span
                                className={`text-[10px] font-medium leading-none tracking-tight ${
                                    !isCoreTab || isSidebarOpen ? 'text-clay' : 'text-white/45'
                                }`}
                            >
                                More
                            </span>
                        </motion.span>
                    </button>
                </div>
            </nav>
            )}

            <AddToHomeScreen liftForTabBar={!isEmbeddedBrowse} />
        </div>
    );
};

export default DashboardLayout;

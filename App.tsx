import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation, Navigate, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

import Navbar from '@landing/home-v2/Navbar';
import Footer from '@shared/Footer';
import SEO from '@shared/SEO';
import { SupabaseProvider, useSupabase } from '@shared/SupabaseProvider';
import { ErrorBoundary } from '@shared/ErrorBoundary';
import AddToHomeScreen from '@shared/AddToHomeScreen';
import WaitlistPage from '@app/WaitlistPage';
import WaitingPage from '@app/WaitingPage';
import LoginPage from '@app/LoginPage';
import OutboundBridge from '@app/OutboundBridge';
import ResetPasswordPage from '@app/ResetPasswordPage';
import { staticPageMeta } from '@backend/lib/seo/pageMeta';
import { isStandalonePwa } from '@shared/pwaDisplay';
import {
  resolveSiteRole,
  landingUrl,
  appUrl,
  adminUrl,
  brandUrl,
  wanderworldUrl,
  goExternal,
  isTemporaryPublicHost,
  productionUrlForPath,
  APP_PATH_PREFIXES,
  BRAND_PATH_PREFIXES,
  WANDERWORLD_PATH_PREFIXES,
  type SiteRole,
} from '@shared/hosts';
import { WAITLIST_REQUIRED } from '@shared/waitlistGate';
import { captureGetawayRefFromSearch } from '@app/Dashboard/Getaway/getawayUtils';

// Robust Lazy Loader: after deploys, old HTML can reference deleted chunks.
// Clear Cache Storage then hard-reload once so the fresh shell loads.
const lazyWithRetry = (componentImport: () => Promise<any>) =>
  lazy(async () => {
    const pageHasAlreadyBeenForceRefreshed = JSON.parse(
      window.sessionStorage.getItem('page-has-been-force-refreshed') || 'false'
    );

    try {
      const component = await componentImport();
      window.sessionStorage.setItem('page-has-been-force-refreshed', 'false');
      return component;
    } catch (error) {
      if (!pageHasAlreadyBeenForceRefreshed) {
        console.warn('Chunk loading failed. Clearing caches and hard-reloading.', error);
        window.sessionStorage.setItem('page-has-been-force-refreshed', 'true');
        const reload = () => {
          // Cache-bust the document navigation so intermediaries can't serve
          // a stale shell that still points at missing hashed assets.
          const url = new URL(window.location.href);
          url.searchParams.set('_r', String(Date.now()));
          window.location.replace(url.toString());
        };
        if ('caches' in window) {
          caches
            .keys()
            .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
            .finally(reload);
        } else {
          reload();
        }
        return { default: () => null };
      }
      throw error;
    }
  });

// Landing
const MainPage = lazyWithRetry(() => import('@landing/MainPage'));
const BrandExplorer = lazyWithRetry(() => import('@landing/BrandExplorer'));
const OurStory = lazyWithRetry(() => import('@landing/OurStory'));
const JournalPage = lazyWithRetry(() => import('@landing/JournalPage'));
const BlogDetail = lazyWithRetry(() => import('@landing/BlogDetail'));
const PrivacyPolicy = lazyWithRetry(() => import('@landing/PrivacyPolicy'));
const TermsOfService = lazyWithRetry(() => import('@landing/TermsOfService'));
const SecurityProtocolPage = lazyWithRetry(() => import('@landing/SecurityProtocolPage'));
const CommunityGuidelines = lazyWithRetry(() => import('@landing/CommunityGuidelines'));
const YurekaAIPage = lazyWithRetry(() => import('@landing/YurekaAIPage'));
const CareersPage = lazyWithRetry(() => import('@landing/CareersPage'));
const AboutPage = lazyWithRetry(() => import('@landing/AboutPage'));
const ContactPage = lazyWithRetry(() => import('@landing/ContactPage'));
const FaqPage = lazyWithRetry(() => import('@landing/FaqPage'));
const ForBrands = lazyWithRetry(() => import('@landing/ForBrands'));
const ZwitchPage = lazyWithRetry(() => import('@landing/Zwitch/ZwitchPage'));
const GiftOrderStatusPage = lazyWithRetry(() => import('@landing/GiftOrderStatusPage'));
const NotFoundPage = lazyWithRetry(() => import('@landing/NotFoundPage'));

// App (product)
const AdminDashboard = lazyWithRetry(() => import('@app/AdminDashboard'));
const DashboardLayout = lazyWithRetry(() => import('@app/Dashboard/DashboardLayout'));
const BrandPortal = lazyWithRetry(() => import('@app/brand/BrandPortal'));
const BrandLoginPage = lazyWithRetry(() => import('@app/brand/BrandLoginPage'));
const BrandResetPasswordPage = lazyWithRetry(() => import('@app/brand/BrandResetPasswordPage'));
const WwPortal = lazyWithRetry(() => import('@app/wanderworld/WwPortal'));
const WwLoginPage = lazyWithRetry(() => import('@app/wanderworld/WwLoginPage'));
const WwResetPasswordPage = lazyWithRetry(() => import('@app/wanderworld/WwResetPasswordPage'));

const LANDING_PATH_PREFIXES = [
  '/brands',
  '/for-brands',
  '/blog',
  '/blogs',
  '/zwitch',
  '/gift',
  '/privacy-policy',
  '/terms-of-service',
  '/security-protocol',
  '/community-guidelines',
  '/manifesto',
  '/about',
  '/contact',
  '/faq',
  '/jobs',
  '/yureka-ai',
  '/ai-magic',
  '/ai',
  '/yureka-os',
] as const;

function pathStartsWith(pathname: string, prefixes: readonly string[]) {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Send users to the correct subdomain when split hosts are active.
 *  Also permanently migrate traffic off temporary sslip.io / nip.io hosts. */
function HostGate({ role, children }: { role: SiteRole; children: React.ReactNode }) {
  const { pathname, search, hash } = useLocation();
  const rest = `${pathname}${search}${hash}`;

  useEffect(() => {
    if (isTemporaryPublicHost()) {
      goExternal(productionUrlForPath(pathname, search, hash));
      return;
    }

    if (role === 'all') return;

    if (role === 'landing') {
      if (pathname === '/admin' || pathname.startsWith('/admin/')) {
        goExternal(adminUrl(rest === '/admin' ? '/admin' : rest));
        return;
      }
      if (pathStartsWith(pathname, BRAND_PATH_PREFIXES)) {
        goExternal(brandUrl(rest === '/brand' ? '/brand' : rest));
        return;
      }
      if (pathStartsWith(pathname, WANDERWORLD_PATH_PREFIXES)) {
        goExternal(wanderworldUrl(pathname === '/ww' || pathname === '/ww/' ? '/' : rest.replace(/^\/ww/, '') || '/'));
        return;
      }
      if (pathStartsWith(pathname, APP_PATH_PREFIXES)) {
        goExternal(appUrl(rest));
        return;
      }
    }

    if (role === 'app') {
      if (pathname === '/admin' || pathname.startsWith('/admin/')) {
        goExternal(adminUrl(rest === '/admin' ? '/admin' : rest));
        return;
      }
      // WW OAuth bridge + tagged portal callbacks → ops host (before login mounts).
      if (
        pathname === '/ww-oauth' ||
        pathname.startsWith('/ww-oauth/') ||
        new URLSearchParams(search).get('portal') === 'ww'
      ) {
        const destPath =
          pathname.includes('signup') ? '/signup' : pathname.includes('reset-password') ? '/reset-password' : '/login';
        const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
        params.set('portal', 'ww');
        if (!params.get('next') || params.get('next') === '/dashboard' || (params.get('next') || '').startsWith('/dashboard')) {
          params.set('next', '/');
        }
        const q = params.toString();
        goExternal(wanderworldUrl(`${destPath}${q ? `?${q}` : ''}${hash}`));
        return;
      }
      if (pathStartsWith(pathname, BRAND_PATH_PREFIXES)) {
        goExternal(brandUrl(rest === '/brand' ? '/brand' : rest));
        return;
      }
      if (pathStartsWith(pathname, WANDERWORLD_PATH_PREFIXES)) {
        goExternal(wanderworldUrl(pathname === '/ww' || pathname === '/ww/' ? '/' : rest.replace(/^\/ww/, '') || '/'));
        return;
      }
      if (pathStartsWith(pathname, LANDING_PATH_PREFIXES)) {
        goExternal(landingUrl(rest));
        return;
      }
    }

    if (role === 'admin') {
      if (pathname === '/') {
        goExternal(adminUrl('/admin'));
        return;
      }
      if (pathStartsWith(pathname, BRAND_PATH_PREFIXES)) {
        goExternal(brandUrl(rest === '/brand' ? '/brand' : rest));
        return;
      }
      if (pathStartsWith(pathname, WANDERWORLD_PATH_PREFIXES)) {
        goExternal(wanderworldUrl(pathname === '/ww' || pathname === '/ww/' ? '/' : rest.replace(/^\/ww/, '') || '/'));
        return;
      }
      if (pathStartsWith(pathname, APP_PATH_PREFIXES)) {
        goExternal(appUrl(rest));
        return;
      }
      if (pathStartsWith(pathname, LANDING_PATH_PREFIXES)) {
        goExternal(landingUrl(rest));
        return;
      }
    }

    if (role === 'brand') {
      if (pathname === '/') {
        goExternal(brandUrl('/brand'));
        return;
      }
      if (pathname === '/admin' || pathname.startsWith('/admin/')) {
        goExternal(adminUrl(rest === '/admin' ? '/admin' : rest));
        return;
      }
      if (pathStartsWith(pathname, WANDERWORLD_PATH_PREFIXES)) {
        goExternal(wanderworldUrl(pathname === '/ww' || pathname === '/ww/' ? '/' : rest.replace(/^\/ww/, '') || '/'));
        return;
      }
      if (pathStartsWith(pathname, LANDING_PATH_PREFIXES)) {
        goExternal(landingUrl(rest));
        return;
      }
      if (pathname === '/login' || pathname === '/signup' || pathname === '/reset-password') {
        const dest =
          pathname === '/signup'
            ? '/brand/signup'
            : pathname === '/reset-password'
              ? '/brand/reset-password'
              : '/brand/login';
        goExternal(brandUrl(`${dest}${search}${hash}`));
        return;
      }
      if (pathStartsWith(pathname, APP_PATH_PREFIXES)) {
        goExternal(appUrl(rest));
        return;
      }
    }

    if (role === 'wanderworld') {
      // Root and auth paths stay on this host (portal lives at /).
      if (pathname === '/ww' || pathname.startsWith('/ww/')) {
        const stripped =
          pathname === '/ww' || pathname === '/ww/'
            ? '/'
            : pathname.replace(/^\/ww/, '') || '/'
        goExternal(wanderworldUrl(`${stripped}${search}${hash}`));
        return;
      }
      if (pathname === '/admin' || pathname.startsWith('/admin/')) {
        goExternal(adminUrl(rest === '/admin' ? '/admin' : rest));
        return;
      }
      if (pathStartsWith(pathname, BRAND_PATH_PREFIXES)) {
        goExternal(brandUrl(rest === '/brand' ? '/brand' : rest));
        return;
      }
      if (pathStartsWith(pathname, LANDING_PATH_PREFIXES)) {
        goExternal(landingUrl(rest));
        return;
      }
      // Auth + home stay here.
      if (
        pathname === '/' ||
        pathname === '/login' ||
        pathname === '/signup' ||
        pathname === '/reset-password'
      ) {
        return;
      }
      // Never bounce WW traffic to app.yureka.one (OAuth/next=?/dashboard used to do that).
      // Keep users on ops: send stray app paths back to WW home.
      if (pathStartsWith(pathname, APP_PATH_PREFIXES)) {
        goExternal(wanderworldUrl('/'));
        return;
      }
      // Unknown paths → ops home
      goExternal(wanderworldUrl('/'));
    }
  }, [role, pathname, search, hash, rest]);

  return <>{children}</>;
}

// Optimized Scroll Management
const ScrollToTop = () => {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    // Dashboard keep-alive tabs scroll their own pane — don't jump the whole app.
    if (pathname.startsWith('/dashboard')) return;
    const isAuthHash =
      hash.includes('access_token') ||
      hash.includes('refresh_token') ||
      hash.includes('type=recovery') ||
      hash.includes('error=');
    if (!hash || isAuthHash) {
      window.scrollTo(0, 0);
    } else {
      const id = hash.replace('#', '');
      const scrollWithRetry = (retryCount = 0) => {
        const element = document.getElementById(id);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
        } else if (retryCount < 15) {
          setTimeout(() => scrollWithRetry(retryCount + 1), 100);
        }
      };
      scrollWithRetry();
    }
  }, [pathname, hash]);

  return null;
};

/** Persist WanderWorld promoter ?ref= before auth redirects drop the getaway page. */
const CaptureWwPromoterRef = () => {
  const { search } = useLocation();
  // Sync write — ProtectedRoute may Navigate away before useEffect runs.
  captureGetawayRefFromSearch(search);
  return null;
};

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUserStatus, isLoading, user } = useSupabase();
  const location = useLocation();

  // Never tear down the dashboard for a background status/CMS refresh.
  // Waitlist open: any signed-in session can stay (incl. status "none" while
  // /auth/status auto-accept catches up — that used to bounce signup → login).
  if (
    currentUserStatus === 'accepted' ||
    currentUserStatus === 'admin' ||
    (!WAITLIST_REQUIRED && Boolean(user) && currentUserStatus !== 'loading')
  ) {
    return <>{children}</>;
  }

  if (isLoading || currentUserStatus === 'loading') {
    return (
      <div className="fixed inset-0 bg-[#070707] flex items-center justify-center">
        <Loader2 className="animate-spin text-clay" size={48} />
      </div>
    );
  }

  // Preserve ?embedded=1 so the login page also hides web chrome in the native WebView.
  const isEmbedded =
    new URLSearchParams(location.search).get('embedded') === '1' ||
    (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('yureka-embedded') === '1');
  const embeddedSuffix = isEmbedded ? '&embedded=1' : '';

  if (!user || currentUserStatus === 'none' || !currentUserStatus) {
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}${embeddedSuffix}`} state={{ from: location }} replace />;
  }

  if (WAITLIST_REQUIRED) {
    if (currentUserStatus === 'pending' || currentUserStatus === 'on-hold') {
      return <Navigate to="/waiting" replace />;
    }
    if (currentUserStatus === 'rejected') {
      return <Navigate to="/waiting" replace />;
    }
  }

  return <>{children}</>;
};

function LegacyBlogsRedirect() {
  const { slug } = useParams();
  return <Navigate to={slug ? `/blog/${slug}` : '/blog'} replace />;
}

function LandingRoutes() {
  return (
    <Routes>
      <Route path="/" element={<MainPage />} />
      <Route path="/gift/orders/:token" element={<GiftOrderStatusPage />} />
      <Route path="/zwitch" element={<><SEO {...staticPageMeta['/zwitch']} /><ZwitchPage /></>} />
      <Route path="/brands" element={<BrandExplorer />} />
      <Route path="/brands/:category" element={<BrandExplorer />} />
      <Route path="/for-brands" element={<ForBrands />} />
      <Route path="/blog" element={<><SEO {...staticPageMeta['/blog']} /><JournalPage /></>} />
      <Route path="/blog/:slug" element={<BlogDetail />} />
      <Route path="/blogs" element={<Navigate to="/blog" replace />} />
      <Route path="/blogs/:slug" element={<LegacyBlogsRedirect />} />
      <Route path="/privacy-policy" element={<PrivacyPolicy />} />
      <Route path="/terms-of-service" element={<TermsOfService />} />
      <Route path="/security-protocol" element={<SecurityProtocolPage />} />
      <Route path="/community-guidelines" element={<CommunityGuidelines />} />
      <Route path="/yureka-os" element={<Navigate to="/" replace />} />
      <Route path="/manifesto" element={<OurStory />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/contact" element={<ContactPage />} />
      <Route path="/faq" element={<FaqPage />} />
      <Route path="/jobs" element={<CareersPage />} />
      <Route path="/yureka-ai" element={<><SEO {...staticPageMeta['/yureka-ai']} /><YurekaAIPage /></>} />
      <Route path="/ai-magic" element={<Navigate to="/yureka-ai" replace />} />
      <Route path="/ai" element={<Navigate to="/yureka-ai" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

function ProductRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard/home" replace />} />
      <Route path="/go" element={<OutboundBridge />} />
      <Route path="/ww-oauth" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<><SEO {...staticPageMeta['/login']} /><LoginPage /></>} />
      <Route path="/signup" element={<><SEO {...staticPageMeta['/login']} /><LoginPage /></>} />
      {/* Waitlist paused — set VITE_WAITLIST_REQUIRED=true to restore pages */}
      <Route
        path="/join-waitlist"
        element={
          WAITLIST_REQUIRED ? (
            <><SEO {...staticPageMeta['/join-waitlist']} /><WaitlistPage /></>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="/waiting"
        element={
          WAITLIST_REQUIRED ? (
            <><SEO {...staticPageMeta['/waiting']} /><WaitingPage /></>
          ) : (
            <Navigate to="/dashboard" replace />
          )
        }
      />
      <Route path="/reset-password" element={<><SEO {...staticPageMeta['/reset-password'] || staticPageMeta['/login']} /><ResetPasswordPage /></>} />
      <Route path="/privacy-policy" element={<PrivacyPolicy />} />
      <Route path="/terms-of-service" element={<TermsOfService />} />
      <Route
        path="/dashboard/*"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

function AdminRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/admin" replace />} />
      <Route path="/admin" element={<><SEO {...staticPageMeta['/admin']} /><AdminDashboard /></>} />
      <Route path="/admin/*" element={<><SEO {...staticPageMeta['/admin']} /><AdminDashboard /></>} />
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  );
}

function BrandRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/brand" replace />} />
      <Route path="/brand/login" element={<><SEO {...staticPageMeta['/brand']} /><BrandLoginPage /></>} />
      <Route path="/brand/signup" element={<><SEO {...staticPageMeta['/brand']} /><BrandLoginPage /></>} />
      <Route path="/brand/reset-password" element={<><SEO {...staticPageMeta['/brand']} /><BrandResetPasswordPage /></>} />
      <Route path="/brand" element={<BrandPortal />} />
      <Route path="/brand/*" element={<BrandPortal />} />
      <Route path="*" element={<Navigate to="/brand" replace />} />
    </Routes>
  );
}

function WanderworldRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<WwLoginPage />} />
      <Route path="/signup" element={<WwLoginPage />} />
      <Route path="/reset-password" element={<WwResetPasswordPage />} />
      <Route path="/" element={<WwPortal />} />
      {/* Legacy /ww paths → root */}
      <Route path="/ww/login" element={<Navigate to="/login" replace />} />
      <Route path="/ww/signup" element={<Navigate to="/signup" replace />} />
      <Route path="/ww/reset-password" element={<Navigate to="/reset-password" replace />} />
      <Route path="/ww" element={<Navigate to="/" replace />} />
      <Route path="/ww/*" element={<Navigate to="/" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function MarketingOrPwaHome() {
  const pwa =
    isStandalonePwa() ||
    (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('source') === 'pwa')
  if (pwa) return <Navigate to="/dashboard/home" replace />
  return <MainPage />
}

function CombinedRoutes() {
  return (
    <Routes>
      <Route path="/" element={<MarketingOrPwaHome />} />
      <Route path="/go" element={<OutboundBridge />} />
      <Route path="/gift/orders/:token" element={<GiftOrderStatusPage />} />
      <Route path="/zwitch" element={<><SEO {...staticPageMeta['/zwitch']} /><ZwitchPage /></>} />
      <Route path="/brands" element={<BrandExplorer />} />
      <Route path="/brands/:category" element={<BrandExplorer />} />
      <Route path="/for-brands" element={<ForBrands />} />
      <Route path="/blog" element={<><SEO {...staticPageMeta['/blog']} /><JournalPage /></>} />
      <Route path="/blog/:slug" element={<BlogDetail />} />
      <Route path="/blogs" element={<Navigate to="/blog" replace />} />
      <Route path="/blogs/:slug" element={<LegacyBlogsRedirect />} />
      <Route path="/admin" element={<><SEO {...staticPageMeta['/admin']} /><AdminDashboard /></>} />
      <Route path="/brand/login" element={<><SEO {...staticPageMeta['/brand']} /><BrandLoginPage /></>} />
      <Route path="/brand/signup" element={<><SEO {...staticPageMeta['/brand']} /><BrandLoginPage /></>} />
      <Route path="/brand/reset-password" element={<><SEO {...staticPageMeta['/brand']} /><BrandResetPasswordPage /></>} />
      <Route path="/brand" element={<BrandPortal />} />
      <Route path="/brand/*" element={<BrandPortal />} />
      <Route path="/ww/login" element={<WwLoginPage />} />
      <Route path="/ww/signup" element={<WwLoginPage />} />
      <Route path="/ww/reset-password" element={<WwResetPasswordPage />} />
      <Route path="/ww" element={<WwPortal />} />
      <Route path="/ww/*" element={<WwPortal />} />
      <Route path="/login" element={<><SEO {...staticPageMeta['/login']} /><LoginPage /></>} />
      <Route path="/signup" element={<><SEO {...staticPageMeta['/login']} /><LoginPage /></>} />
      {/* Waitlist paused — set VITE_WAITLIST_REQUIRED=true to restore pages */}
      <Route
        path="/join-waitlist"
        element={
          WAITLIST_REQUIRED ? (
            <><SEO {...staticPageMeta['/join-waitlist']} /><WaitlistPage /></>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="/waiting"
        element={
          WAITLIST_REQUIRED ? (
            <><SEO {...staticPageMeta['/waiting']} /><WaitingPage /></>
          ) : (
            <Navigate to="/dashboard" replace />
          )
        }
      />
      <Route path="/reset-password" element={<><SEO {...staticPageMeta['/reset-password'] || staticPageMeta['/login']} /><ResetPasswordPage /></>} />
      <Route
        path="/dashboard/*"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      />
      <Route path="/privacy-policy" element={<PrivacyPolicy />} />
      <Route path="/terms-of-service" element={<TermsOfService />} />
      <Route path="/security-protocol" element={<SecurityProtocolPage />} />
      <Route path="/community-guidelines" element={<CommunityGuidelines />} />
      <Route path="/yureka-os" element={<Navigate to="/" replace />} />
      <Route path="/manifesto" element={<OurStory />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/contact" element={<ContactPage />} />
      <Route path="/faq" element={<FaqPage />} />
      <Route path="/jobs" element={<CareersPage />} />
      <Route path="/yureka-ai" element={<><SEO {...staticPageMeta['/yureka-ai']} /><YurekaAIPage /></>} />
      <Route path="/ai-magic" element={<Navigate to="/yureka-ai" replace />} />
      <Route path="/ai" element={<Navigate to="/yureka-ai" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

const AppContent: React.FC = () => {
  const location = useLocation();
  const role = resolveSiteRole();
  const isAdminRoute = location.pathname.startsWith('/admin') || role === 'admin';
  const isBrandRoute = location.pathname.startsWith('/brand') || role === 'brand';
  const isWwHostShell = role === 'wanderworld';
  const isWwRoute = location.pathname.startsWith('/ww') || isWwHostShell;
  const isDashboardRoute = location.pathname.startsWith('/dashboard');
  const isHomeRoute = location.pathname === '/' && (role === 'landing' || role === 'all');
  const isForBrandsRoute = location.pathname === '/for-brands';
  const isBlogRoute =
    location.pathname === '/blog' ||
    location.pathname.startsWith('/blog/') ||
    location.pathname === '/blogs' ||
    location.pathname.startsWith('/blogs/');
  const isSpecialRoute =
    isAdminRoute ||
    isDashboardRoute ||
    isBrandRoute ||
    isWwRoute ||
    isWwHostShell ||
    isForBrandsRoute ||
    role === 'app';
  const applyEditorialGrid = !isSpecialRoute && !isHomeRoute && !isBlogRoute;
  const isZwitchRoute = location.pathname === '/zwitch';
  const noTopPadding = isSpecialRoute || isHomeRoute || isZwitchRoute || isWwHostShell;
  const isProductShell =
    role === 'app' ||
    role === 'admin' ||
    role === 'brand' ||
    role === 'wanderworld' ||
    isAdminRoute ||
    isDashboardRoute ||
    isBrandRoute ||
    isWwRoute;
  const shellBg = isHomeRoute || isProductShell || isWwHostShell ? 'bg-[#070707]' : 'bg-cream';
  const showSiteNavbar =
    role === 'landing' || role === 'all'
      ? !isHomeRoute && (!isSpecialRoute || isForBrandsRoute)
      : false;

  const appRoutes =
    role === 'landing'
      ? <LandingRoutes />
      : role === 'app'
        ? <ProductRoutes />
        : role === 'admin'
          ? <AdminRoutes />
          : role === 'brand'
            ? <BrandRoutes />
            : role === 'wanderworld'
              ? <WanderworldRoutes />
              : <CombinedRoutes />;

  const suspenseFallback = (
    <div className={`fixed inset-0 ${shellBg} flex items-center justify-center`} style={{ zIndex: 100 }}>
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="animate-spin text-clay" size={34} />
        <span className="text-[10px] font-black uppercase tracking-[0.28em] text-white/35">Loading</span>
      </div>
    </div>
  )

  return (
    <HostGate role={role}>
      <div className={`min-h-screen font-sans text-white relative ${shellBg} ${isProductShell ? 'yureka-product' : ''} ${noTopPadding ? 'pt-0' : 'pt-24 md:pt-28'}`}>
        <ScrollToTop />
        <CaptureWwPromoterRef />
        {showSiteNavbar && <Navbar />}

        <main className={`relative z-10 ${noTopPadding ? 'pt-0' : ''}`}>
          <Suspense fallback={suspenseFallback}>
            <ErrorBoundary>
              {applyEditorialGrid ? (
                <div className="grid grid-cols-1 lg:grid-cols-5 w-full relative">
                  <div className="hidden lg:block border-r border-white/5 bg-white/[0.02] h-full min-h-screen" />
                  <div className="col-span-1 lg:col-span-3 flex flex-col items-stretch relative z-10 min-w-0">
                    {appRoutes}
                    <Footer />
                  </div>
                  <div className="hidden lg:block border-l border-white/5 bg-white/[0.02] h-full min-h-screen" />
                </div>
              ) : (
                <>
                  {appRoutes}
                  {isBlogRoute ? <Footer /> : null}
                </>
              )}
            </ErrorBoundary>
          </Suspense>
        </main>
        {/* Dashboard mounts its own banner above the tab bar; auth pages need one too */}
        {isProductShell && !isDashboardRoute && <AddToHomeScreen />}
      </div>
    </HostGate>
  );
};

const App: React.FC = () => {
  useEffect(() => {
    // Strip one-shot cache-bust query left by lazyWithRetry hard reloads.
    const url = new URL(window.location.href);
    if (url.searchParams.has('_r')) {
      url.searchParams.delete('_r');
      window.history.replaceState({}, '', url.pathname + url.search + url.hash);
    }
  }, []);

  return (
    <BrowserRouter>
      <SupabaseProvider>
        <AppContent />
      </SupabaseProvider>
    </BrowserRouter>
  );
};

export default App;

import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
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
import ResetPasswordPage from '@app/ResetPasswordPage';
import { staticPageMeta } from '@backend/lib/seo/pageMeta';
import {
  resolveSiteRole,
  landingUrl,
  appUrl,
  adminUrl,
  goExternal,
  isTemporaryPublicHost,
  productionUrlForPath,
  type SiteRole,
} from '@shared/hosts';

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
const ForBrands = lazyWithRetry(() => import('@landing/ForBrands'));
const ZwitchPage = lazyWithRetry(() => import('@landing/Zwitch/ZwitchPage'));
const NotFoundPage = lazyWithRetry(() => import('@landing/NotFoundPage'));

// App (product)
const AdminDashboard = lazyWithRetry(() => import('@app/AdminDashboard'));
const DashboardLayout = lazyWithRetry(() => import('@app/Dashboard/DashboardLayout'));

const APP_PATH_PREFIXES = ['/login', '/signup', '/join-waitlist', '/waiting', '/dashboard'] as const;
const LANDING_PATH_PREFIXES = [
  '/brands',
  '/for-brands',
  '/blogs',
  '/zwitch',
  '/privacy-policy',
  '/terms-of-service',
  '/security-protocol',
  '/community-guidelines',
  '/manifesto',
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
      if (pathStartsWith(pathname, APP_PATH_PREFIXES)) {
        goExternal(appUrl(rest));
        return;
      }
      if (pathStartsWith(pathname, LANDING_PATH_PREFIXES)) {
        goExternal(landingUrl(rest));
        return;
      }
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
    if (!hash) {
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

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUserStatus, isLoading } = useSupabase();
  const location = useLocation();
  const canStay =
    currentUserStatus === 'accepted' || currentUserStatus === 'admin';

  // Never tear down the dashboard for a background status/CMS refresh.
  if (canStay) return <>{children}</>;

  if (isLoading || currentUserStatus === 'loading') {
    return (
      <div className="fixed inset-0 bg-[#070707] flex items-center justify-center">
        <Loader2 className="animate-spin text-clay" size={48} />
      </div>
    );
  }

  if (currentUserStatus === 'none' || !currentUserStatus) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (currentUserStatus === 'pending' || currentUserStatus === 'on-hold') {
    return <Navigate to="/waiting" replace />;
  }

  if (currentUserStatus === 'rejected') {
    return <Navigate to="/waiting" replace />;
  }

  return <>{children}</>;
};

function LandingRoutes() {
  return (
    <Routes>
      <Route path="/" element={<MainPage />} />
      <Route path="/zwitch" element={<><SEO {...staticPageMeta['/zwitch']} /><ZwitchPage /></>} />
      <Route path="/brands" element={<><SEO {...staticPageMeta['/brands']} /><BrandExplorer /></>} />
      <Route path="/for-brands" element={<ForBrands />} />
      <Route path="/blogs" element={<><SEO {...staticPageMeta['/blogs']} /><JournalPage /></>} />
      <Route path="/blogs/:slug" element={<BlogDetail />} />
      <Route path="/privacy-policy" element={<PrivacyPolicy />} />
      <Route path="/terms-of-service" element={<TermsOfService />} />
      <Route path="/security-protocol" element={<SecurityProtocolPage />} />
      <Route path="/community-guidelines" element={<CommunityGuidelines />} />
      <Route path="/yureka-os" element={<Navigate to="/" replace />} />
      <Route path="/manifesto" element={<OurStory />} />
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
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<><SEO {...staticPageMeta['/login']} /><LoginPage /></>} />
      <Route path="/signup" element={<><SEO {...staticPageMeta['/login']} /><LoginPage /></>} />
      <Route path="/join-waitlist" element={<><SEO {...staticPageMeta['/join-waitlist']} /><WaitlistPage /></>} />
      <Route path="/waiting" element={<><SEO {...staticPageMeta['/waiting']} /><WaitingPage /></>} />
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

function CombinedRoutes() {
  return (
    <Routes>
      <Route path="/" element={<MainPage />} />
      <Route path="/zwitch" element={<><SEO {...staticPageMeta['/zwitch']} /><ZwitchPage /></>} />
      <Route path="/brands" element={<><SEO {...staticPageMeta['/brands']} /><BrandExplorer /></>} />
      <Route path="/for-brands" element={<ForBrands />} />
      <Route path="/blogs" element={<><SEO {...staticPageMeta['/blogs']} /><JournalPage /></>} />
      <Route path="/blogs/:slug" element={<BlogDetail />} />
      <Route path="/admin" element={<><SEO {...staticPageMeta['/admin']} /><AdminDashboard /></>} />
      <Route path="/login" element={<><SEO {...staticPageMeta['/login']} /><LoginPage /></>} />
      <Route path="/signup" element={<><SEO {...staticPageMeta['/login']} /><LoginPage /></>} />
      <Route path="/join-waitlist" element={<><SEO {...staticPageMeta['/join-waitlist']} /><WaitlistPage /></>} />
      <Route path="/waiting" element={<><SEO {...staticPageMeta['/waiting']} /><WaitingPage /></>} />
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
  const isDashboardRoute = location.pathname.startsWith('/dashboard');
  const isHomeRoute = location.pathname === '/' && (role === 'landing' || role === 'all');
  const isForBrandsRoute = location.pathname === '/for-brands';
  const isSpecialRoute = isAdminRoute || isDashboardRoute || isForBrandsRoute || role === 'app';
  const applyEditorialGrid = !isSpecialRoute && !isHomeRoute;
  const isZwitchRoute = location.pathname === '/zwitch';
  const noTopPadding = isSpecialRoute || isHomeRoute || isZwitchRoute;
  const isProductShell = role === 'app' || role === 'admin' || isAdminRoute || isDashboardRoute;
  const shellBg = isHomeRoute || isProductShell ? 'bg-[#070707]' : 'bg-cream';
  const showSiteNavbar =
    role === 'landing' || role === 'all'
      ? !isHomeRoute && (!isSpecialRoute || isForBrandsRoute)
      : false;

  const appRoutes =
    role === 'landing' ? <LandingRoutes /> : role === 'app' ? <ProductRoutes /> : role === 'admin' ? <AdminRoutes /> : <CombinedRoutes />;

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
                appRoutes
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

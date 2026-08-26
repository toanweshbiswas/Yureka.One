import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { Card, Blog, Review, WaitlistEntry } from '@/types';
import { featuredCards } from '@landing/data';
import { api, isApiError } from '@backend/lib/api/client';
import { fromApiCard, fromApiBlog, fromApiReview } from '@backend/lib/api/mappers';
import type { Card as ApiCard, Blog as ApiBlog, Review as ApiReview, Waitlist as ApiWaitlist, LedgerResyncQuota } from '@backend/lib/api/types';
import {
  getSupabaseBrowser,
  setAuthTokenGetter,
  normalizeWaitlistStatus,
  type AppUserStatus,
  type Session,
  type User,
  supabaseConfigured,
} from '@shared/auth';
import { cacheGet, cacheSet, CACHE_TTL, getLastAuthStatus, persistAuthSnapshot } from '@shared/dashboardCache';
import { isStandalonePwa } from '@shared/pwaDisplay';
import { listenForPwaInstall, trackPwaPresence } from '@shared/pwaInstallTrack';
import {
  clearStoredGmailAccessToken,
  getStoredGmailAccessToken,
  requestGmailReadonlyToken,
} from '@shared/gmailConsent';
import { filterMarketingTransactions } from '@backend/lib/ledger/marketingFilter';
import { WAITLIST_REQUIRED } from '@shared/waitlistGate';

export interface ParsedTransaction {
  brandName: string;
  amount: string;
  description: string;
  date: string;
  sender: string;
  type?: string;
}

type LedgerCachePayload = {
  profile?: Record<string, unknown>
  transactions?: ParsedTransaction[]
  score?: unknown
  resyncQuota?: LedgerResyncQuota
  cachedAt?: string
  source?: 'scan' | 'server' | 'local'
}

function ledgerCacheKey(email: string) {
  return `yureka_financial_ledger_${email}`
}

function gmailSyncedKey(email: string) {
  return `yureka_gmail_synced:${String(email || '').trim().toLowerCase()}`
}

function readGmailSyncedFlag(email: string): boolean {
  try {
    if (localStorage.getItem(gmailSyncedKey(email)) === '1') return true
    const local = readLocalLedger(email)
    if (local?.source === 'scan') return true
  } catch {
    /* ignore */
  }
  return false
}

function persistGmailSyncedFlag(email: string) {
  try {
    localStorage.setItem(gmailSyncedKey(email), '1')
  } catch {
    /* ignore */
  }
}

function spendTotalInr(txs: ParsedTransaction[] | undefined | null): number {
  let sum = 0
  for (const tx of txs || []) {
    const n = parseFloat(String(tx.amount || '').replace(/[₹$,\s]/g, ''))
    if (Number.isFinite(n)) sum += n
  }
  return Math.round(sum)
}

function shouldPreferServer(local: LedgerCachePayload | null, serverTxs: ParsedTransaction[]): boolean {
  const localTxs = local?.transactions || []
  if (!localTxs.length) return serverTxs.length > 0
  if (!serverTxs.length) return false
  // Prefer the fuller ledger so mobile PWA can't stay stuck on an old local scan
  if (serverTxs.length > localTxs.length) return true
  if (spendTotalInr(serverTxs) > spendTotalInr(localTxs) + 1) return true
  const localAt = local?.cachedAt ? Date.parse(local.cachedAt) : 0
  // Refresh at least every 6 hours from server cache (no Gmail quota used)
  if (!Number.isFinite(localAt) || Date.now() - localAt > 6 * 60 * 60 * 1000) return true
  return false
}

function readLocalLedger(email: string): LedgerCachePayload | null {
  try {
    const raw = localStorage.getItem(ledgerCacheKey(email))
    if (!raw) return null
    const data = JSON.parse(raw) as LedgerCachePayload
    if (!Array.isArray(data.transactions)) return null
    return {
      ...data,
      transactions: filterMarketingTransactions(data.transactions) as ParsedTransaction[],
    }
  } catch {
    return null
  }
}

function writeLocalLedger(email: string, data: LedgerCachePayload) {
  const payload: LedgerCachePayload = {
    ...data,
    transactions: filterMarketingTransactions(data.transactions || []) as ParsedTransaction[],
    cachedAt: data.cachedAt || new Date().toISOString(),
  }
  localStorage.setItem(ledgerCacheKey(email), JSON.stringify(payload))
  return payload
}

interface SupabaseContextType {
  cards: Card[];
  blogs: Blog[];
  reviews: Review[];
  waitlist: WaitlistEntry[];
  team: any[];
  logs: any[];
  user: User | null;
  session: Session | null;
  currentUserStatus: AppUserStatus;
  syncStatus: 'connected' | 'reconnecting' | 'error';
  isLoading: boolean;
  isAdminDataLoaded: boolean;
  refreshAll: () => Promise<void>;
  refreshUserStatus: () => Promise<void>;
  setCards: React.Dispatch<React.SetStateAction<Card[]>>;
  setBlogs: React.Dispatch<React.SetStateAction<Blog[]>>;
  setReviews: React.Dispatch<React.SetStateAction<Review[]>>;
  setWaitlist: React.Dispatch<React.SetStateAction<WaitlistEntry[]>>;
  setTeam: React.Dispatch<React.SetStateAction<any[]>>;

  ledgerTransactions: ParsedTransaction[];
  ledgerLoading: boolean;
  ledgerError: string | null;
  scanProgress: number;
  ledgerResyncQuota: LedgerResyncQuota | null;
  /** True until the member completes at least one Gmail inbox sync on this device. */
  needsGmailSync: boolean;
  syncLedger: (forceSync?: boolean) => Promise<void>;
}

const SupabaseContext = createContext<SupabaseContextType | undefined>(undefined);

/**
 * Admin CMS for the SPA is loaded via authenticated /api/admin/* after login
 * (see AdminDashboard). Never call unauthenticated /api/v1/admin/* here . 
 * those routes return 401 and previously leaked waitlist PII on the login page.
 */
async function loadAdminData(_setters: {
  setCards: (v: any) => void; setBlogs: (v: any) => void; setReviews: (v: any) => void;
  setWaitlist: (v: any) => void; setTeam: (v: any) => void; setLogs: (v: any) => void;
}) {
  // no-op: waitlist/team/audit require X-Admin-Session on /api/admin/*
}

async function resolveUserStatus(
  email: string,
  accessToken?: string | null
): Promise<'none' | 'pending' | 'accepted' | 'admin' | 'rejected' | 'on-hold'> {
  if (!email) return 'none';
  const authOpts = accessToken ? { token: accessToken, timeoutMs: 6000 } : { timeoutMs: 6000 }
  try {
    const statusRes = await api.get<{
      role?: string
      status?: string
      canAccessDashboard?: boolean
    }>(`/api/v1/auth/status?email=${encodeURIComponent(email)}`, authOpts)
    if (!isApiError(statusRes) && statusRes.data?.status) {
      const s = statusRes.data.status
      if (s === 'admin' || s === 'accepted' || s === 'pending' || s === 'rejected' || s === 'on-hold') {
        return s
      }
      if (s === 'on_hold') return 'on-hold'
      if (s === 'none') {
        // Open onboard: signed-in + none still means dashboard (API race / auto-accept lag).
        return WAITLIST_REQUIRED ? 'none' : 'accepted'
      }
    }

    // Fallback if older API without /auth/status (still requires Bearer)
    const fallbackOpts = accessToken ? { token: accessToken, timeoutMs: 5000 } : { timeoutMs: 5000 }
    const [roleRes, entryRes] = await Promise.all([
      api.get<{ role: string }>(`/api/v1/auth/role?email=${encodeURIComponent(email)}`, fallbackOpts),
      api.get<ApiWaitlist>(`/api/v1/waitlist/entry?email=${encodeURIComponent(email)}`, fallbackOpts),
    ]);
    if (!isApiError(roleRes) && ['admin', 'editor', 'writer', 'superadmin'].includes(roleRes.data?.role ?? '')) {
      return 'admin';
    }
    if (!isApiError(entryRes) && entryRes.data) {
      const normalized = normalizeWaitlistStatus(entryRes.data.status);
      if (normalized) return normalized;
    }
  } catch {
    // fall through
  }
  // Auth status failed (401 race, network): when waitlist is open, signed-in users stay in.
  return WAITLIST_REQUIRED ? 'none' : 'accepted'
}

export const SupabaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const [cards, setCards] = useState<Card[]>([]);
  const [blogs, setBlogs] = useState<Blog[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [team, setTeam] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);

  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [currentUserStatus, setCurrentUserStatus] = useState<AppUserStatus>(() => {
    const restored = getLastAuthStatus()
    return (restored as AppUserStatus) || 'loading'
  });
  const [syncStatus, setSyncStatus] = useState<'connected' | 'reconnecting' | 'error'>('connected');
  const [isLoading, setIsLoading] = useState(() => {
    const restored = getLastAuthStatus()
    return restored !== 'accepted' && restored !== 'admin'
  });
  const [isAdminDataLoaded, setIsAdminDataLoaded] = useState(false);
  const isInitialLoad = useRef(true);
  const publicDataLoaded = useRef(false);
  const sessionRef = useRef<Session | null>(null);
  const statusRequestId = useRef(0);

  const [ledgerTransactions, setLedgerTransactions] = useState<ParsedTransaction[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerError, setLedgerError] = useState<string | null>(null);
  const [scanProgress, setScanProgress] = useState(0);
  const [ledgerResyncQuota, setLedgerResyncQuota] = useState<LedgerResyncQuota | null>(null);
  /** null = not hydrated yet (hide prompt); false = must sync; true = done */
  const [gmailSynced, setGmailSynced] = useState<boolean | null>(null);

  const markGmailSynced = useCallback((email: string) => {
    persistGmailSyncedFlag(email)
    setGmailSynced(true)
  }, []);

  const applyStatusForEmail = useCallback(async (
    email: string | undefined | null,
    opts?: { silent?: boolean; signedOut?: boolean }
  ) => {
    const reqId = ++statusRequestId.current;
    if (!email) {
      if (reqId !== statusRequestId.current) return;
      setCurrentUserStatus('none');
      persistAuthSnapshot(null, 'none');
      return;
    }
    const statusKey = `auth:status:${email.toLowerCase()}`
    const cached = cacheGet<AppUserStatus>(statusKey, CACHE_TTL.authStatus)

    setCurrentUserStatus((prev) => {
      if (prev === 'accepted' || prev === 'admin' || prev === 'pending' || prev === 'on-hold' || prev === 'rejected') {
        return prev
      }
      if (cached?.data && cached.data !== 'loading') return cached.data
      if (opts?.silent) return prev
      return 'loading'
    })

    const status = await resolveUserStatus(email, sessionRef.current?.access_token);
    if (reqId !== statusRequestId.current) return;
    setCurrentUserStatus(status);
    cacheSet(statusKey, status);
    persistAuthSnapshot(email, status);
  }, []);

  const refreshUserStatus = useCallback(async () => {
    if (!sessionRef.current?.user?.email) {
      const sb = getSupabaseBrowser()
      if (sb) {
        const { data } = await sb.auth.getSession()
        if (data.session) {
          sessionRef.current = data.session
          setSession(data.session)
          setUser(data.session.user)
        }
      }
    }
    await applyStatusForEmail(sessionRef.current?.user?.email);
  }, [applyStatusForEmail]);

  const ledgerResyncQuotaRef = useRef<LedgerResyncQuota | null>(null);
  const syncInFlightRef = useRef(false);
  const softSyncedEmailRef = useRef<string | null>(null);
  const softSyncedAtRef = useRef(0);

  useEffect(() => {
    ledgerResyncQuotaRef.current = ledgerResyncQuota;
  }, [ledgerResyncQuota]);

  const syncLedger = useCallback(async (forceSync = false) => {
    const userEmail = sessionRef.current?.user?.email;
    if (!userEmail) return;

    if (syncInFlightRef.current) return
    // Soft sync at most once every 5 minutes per email (stops quota/state update loops).
    if (
      !forceSync &&
      softSyncedEmailRef.current === userEmail &&
      Date.now() - softSyncedAtRef.current < 5 * 60 * 1000
    ) {
      return
    }

    syncInFlightRef.current = true

    setLedgerLoading(true);
    setLedgerError(null);

    const local = readLocalLedger(userEmail)
    if (local?.transactions?.length) {
      setLedgerTransactions(local.transactions)
      if (!forceSync) setLedgerLoading(false)
    }

    try {
      if (forceSync) {
        const quota = ledgerResyncQuotaRef.current
        if (quota && Number(quota.remaining) <= 0) {
          setLedgerError('RESYNC_LIMIT');
          setLedgerLoading(false);
          return;
        }
        setScanProgress(10);
        let gmailToken = getStoredGmailAccessToken() || '';
        if (!gmailToken) {
          setScanProgress(20);
          const consent = await requestGmailReadonlyToken({ forceConsent: true });
          if (!consent.accessToken) {
            setLedgerError(consent.error || 'AUTH_EXPIRED');
            setScanProgress(0);
            return;
          }
          gmailToken = consent.accessToken;
        }

        setScanProgress(35);
        const scanRes = await api.post<{ profile: any; transactions: any[]; score?: any; resyncQuota?: LedgerResyncQuota }>(
          '/api/v1/ledger/scan',
          {
            accessToken: gmailToken,
            email: userEmail,
            fallbackData: { email: userEmail },
          },
          { timeoutMs: 180_000 }
        );
        setScanProgress(75);

        const quotaFromError = (scanRes as { resyncQuota?: LedgerResyncQuota }).resyncQuota
        if (quotaFromError) setLedgerResyncQuota(quotaFromError)

        if (!isApiError(scanRes) && Array.isArray(scanRes.data?.transactions)) {
          const saved = writeLocalLedger(userEmail, {
            ...scanRes.data,
            source: 'scan',
            cachedAt: new Date().toISOString(),
          })
          setLedgerTransactions(saved.transactions || []);
          softSyncedEmailRef.current = userEmail
          softSyncedAtRef.current = Date.now()
          if (scanRes.data.resyncQuota) setLedgerResyncQuota(scanRes.data.resyncQuota)
          else if (quotaFromError) setLedgerResyncQuota(quotaFromError)
          if (scanRes.data.score && Number.isFinite(Number(scanRes.data.score.score))) {
            window.dispatchEvent(new CustomEvent('yureka-score-updated', { detail: scanRes.data.score }));
          }
          markGmailSynced(userEmail);
          setScanProgress(100);
          return;
        }

        if (isApiError(scanRes)) {
          const err = scanRes.error || 'Ledger scan failed';
          if (err === 'AUTH_EXPIRED' || /AUTH_EXPIRED|invalid_grant|invalid credentials/i.test(err)) {
            clearStoredGmailAccessToken();
            setLedgerError('AUTH_EXPIRED');
          } else if (err === 'RESYNC_LIMIT') {
            setLedgerError('RESYNC_LIMIT');
          } else {
            setLedgerError(err);
          }
        }

        const dbRes = await api.get<{ profile: any; transactions: any[]; resyncQuota?: LedgerResyncQuota }>(
          `/api/v1/ledger?email=${encodeURIComponent(userEmail)}`,
          { timeoutMs: 15000 }
        );
        if (!isApiError(dbRes) && dbRes.data?.transactions?.length) {
          const saved = writeLocalLedger(userEmail, {
            ...dbRes.data,
            source: 'server',
            cachedAt: new Date().toISOString(),
          })
          setLedgerTransactions(saved.transactions || []);
          softSyncedEmailRef.current = userEmail
          softSyncedAtRef.current = Date.now()
        }
        if (!isApiError(dbRes) && dbRes.data?.resyncQuota) {
          setLedgerResyncQuota(dbRes.data.resyncQuota)
          if (Number(dbRes.data.resyncQuota.used) > 0) markGmailSynced(userEmail)
        }
        setScanProgress(100);
      } else {
        const res = await api.get<{ profile: any; transactions: any[]; score?: any; resyncQuota?: LedgerResyncQuota }>(
          `/api/v1/ledger?email=${encodeURIComponent(userEmail)}`,
          { timeoutMs: 15000 }
        );
        if (!isApiError(res) && Array.isArray(res.data?.transactions)) {
          const serverTxs = filterMarketingTransactions(res.data.transactions) as ParsedTransaction[]
          if (shouldPreferServer(local, serverTxs)) {
            const saved = writeLocalLedger(userEmail, {
              ...res.data,
              transactions: serverTxs,
              source: 'server',
              cachedAt: new Date().toISOString(),
            })
            setLedgerTransactions(saved.transactions || []);
          } else if (!local?.transactions?.length && serverTxs.length) {
            const saved = writeLocalLedger(userEmail, {
              ...res.data,
              transactions: serverTxs,
              source: 'server',
              cachedAt: new Date().toISOString(),
            })
            setLedgerTransactions(saved.transactions || []);
          }
        }
        softSyncedEmailRef.current = userEmail
        softSyncedAtRef.current = Date.now()
        if (!isApiError(res) && res.data?.resyncQuota) {
          setLedgerResyncQuota(res.data.resyncQuota)
          if (Number(res.data.resyncQuota.used) > 0) markGmailSynced(userEmail)
          else setGmailSynced((prev) => (prev === true ? true : readGmailSyncedFlag(userEmail)))
        } else {
          setGmailSynced((prev) => (prev === true ? true : readGmailSyncedFlag(userEmail)))
        }
      }
    } catch (err) {
      console.error("Ledger sync error:", err);
      setLedgerError("Failed to synchronize with email ledger.");
      setScanProgress(0);
    } finally {
      syncInFlightRef.current = false
      setTimeout(() => {
        setLedgerLoading(false);
        setScanProgress(0);
      }, 600);
    }
  }, [markGmailSynced]);

  useEffect(() => {
    const email = session?.user?.email
    if (!email) {
      softSyncedEmailRef.current = null
      setGmailSynced(null)
      return
    }
    setGmailSynced(readGmailSyncedFlag(email))
    void syncLedger(false);
  }, [session?.user?.email, syncLedger]);

  // Real Supabase Auth. replaces demo stub
  useEffect(() => {
    setAuthTokenGetter(() => sessionRef.current?.access_token ?? null);

    const sb = getSupabaseBrowser();
    if (!sb) {
      console.warn(
        supabaseConfigured
          ? 'Auth client failed to initialize'
          : 'Sign-in is not configured on this build. Gating will treat users as logged out.'
      );
      setUser(null);
      setSession(null);
      sessionRef.current = null;
      setCurrentUserStatus('none');
      setIsLoading(false);
      return () => setAuthTokenGetter(null);
    }

    let cancelled = false;

    const applySession = async (
      next: Session | null,
      opts?: { silent?: boolean; signedOut?: boolean }
    ) => {
      if (cancelled) return;
      sessionRef.current = next;
      setSession(next);
      setUser(next?.user ?? null);
      await applyStatusForEmail(next?.user?.email, opts);
    };

    sb.auth.getSession().then(({ data }) => {
      void applySession(data.session, { silent: true });
    });

    const { data: sub } = sb.auth.onAuthStateChange((event, next) => {
      if (event === 'TOKEN_REFRESHED' && next?.user?.id && next.user.id === sessionRef.current?.user?.id) {
        sessionRef.current = next;
        return;
      }
      void applySession(next, {
        silent: event !== 'SIGNED_IN',
        signedOut: event === 'SIGNED_OUT',
      });
    });

    // When running inside the Yureka native app's WebView, the native shell
    // injects the Supabase session into localStorage before page JS runs and
    // fires this custom event. Re-reading the session here skips the login page.
    const handleNativeSession = () => {
      sb.auth.getSession().then(({ data }) => {
        if (data.session && !cancelled) {
          void applySession(data.session, { silent: true });
        }
      });
    };
    window.addEventListener('yureka-native-session', handleNativeSession);

    // Also handle the case where the event fired before React mounted.
    if (
      typeof window !== 'undefined' &&
      (window as unknown as Record<string, unknown>).__YUREKA_NATIVE_SESSION__
    ) {
      handleNativeSession();
    }

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
      window.removeEventListener('yureka-native-session', handleNativeSession);
      setAuthTokenGetter(null);
    };
  }, [applyStatusForEmail]);

  // Persist "saved to home screen" when the member opens the installed PWA (or installs it).
  useEffect(() => {
    if (!user?.id && !user?.email) return
    void trackPwaPresence({ userId: user.id, email: user.email })
    return listenForPwaInstall(user.id, user.email)
  }, [user?.id, user?.email]);

  const isAdminRoute = location.pathname.startsWith('/admin');
  const skipPublicCms =
    location.pathname.startsWith('/dashboard') ||
    location.pathname.startsWith('/login') ||
    isStandalonePwa();

  const refreshAll = useCallback(async () => {
    try {
      if (isAdminRoute) {
        await loadAdminData({ setCards, setBlogs, setReviews, setWaitlist, setTeam, setLogs });
      } else {
        const [cRes, bRes, rRes] = await Promise.all([
          api.get<ApiCard[]>('/api/v1/cms/cards', { skipAuth: true }),
          api.get<ApiBlog[]>('/api/v1/cms/blogs', { skipAuth: true }),
          api.get<ApiReview[]>('/api/v1/cms/reviews', { skipAuth: true }),
        ]);
        if (!isApiError(cRes)) {
          const c = (cRes.data ?? []).map(fromApiCard);
          setCards(c.length > 0 ? c : featuredCards);
        } else {
          setCards(featuredCards);
        }
        if (!isApiError(bRes)) {
          setBlogs((bRes.data ?? []).map(fromApiBlog));
        } else {
          setBlogs([]);
        }
        if (!isApiError(rRes)) {
          setReviews((rRes.data ?? []).map(fromApiReview));
        } else {
          setReviews([]);
        }
      }
    } catch (err) {
      console.error('Manual resync failed:', err);
      setSyncStatus('error');
    } finally {
      setIsLoading(false);
    }
  }, [isAdminRoute]);

  useEffect(() => {
    const fallbackTimer = setTimeout(() => {
      setIsLoading(false);
    }, 4000);

    const setup = async () => {
      const restored = getLastAuthStatus()
      const dashboardReady = restored === 'accepted' || restored === 'admin'
      if (isInitialLoad.current && cards.length === 0 && !dashboardReady && !skipPublicCms) {
        setIsLoading(true);
      }
      try {
        if (isAdminRoute) {
          await loadAdminData({ setCards, setBlogs, setReviews, setWaitlist, setTeam, setLogs });
          setIsAdminDataLoaded(true);
        } else if (!publicDataLoaded.current && !skipPublicCms) {
          const [cRes, bRes, rRes] = await Promise.all([
            api.get<ApiCard[]>('/api/v1/cms/cards', { skipAuth: true }),
            api.get<ApiBlog[]>('/api/v1/cms/blogs', { skipAuth: true }),
            api.get<ApiReview[]>('/api/v1/cms/reviews', { skipAuth: true }),
          ]);

          if (!isApiError(cRes)) {
            const mapped = (cRes.data ?? []).map(fromApiCard);
            setCards(mapped.length > 0 ? mapped : featuredCards);
          } else {
            setCards(featuredCards);
          }

          if (!isApiError(bRes)) {
            const mapped = (bRes.data ?? []).map(fromApiBlog).filter(b => b.id && b.title && b.title !== 'Untitled Journal' && b.title !== 'Untitled Blog');
            setBlogs(mapped);
          } else {
            setBlogs([]);
          }

          if (!isApiError(rRes)) {
            const mapped = (rRes.data ?? []).map(fromApiReview);
            setReviews(mapped);
          } else {
            setReviews([]);
          }
        }
      } catch (err) {
        console.error("Supabase Setup Error:", err);
        setSyncStatus('error');
        setCards(prev => prev.length > 0 ? prev : featuredCards);
      } finally {
        setIsLoading(false);
        isInitialLoad.current = false;
        publicDataLoaded.current = true;
        clearTimeout(fallbackTimer);
      }
    };

    setup();

    return () => {
      clearTimeout(fallbackTimer);
    };
  }, [isAdminRoute, skipPublicCms]);

  const contextValue = useMemo(() => ({
    user,
    session,
    currentUserStatus,
    cards, blogs, reviews, waitlist, team, logs,
    syncStatus, isLoading, isAdminDataLoaded, refreshAll, refreshUserStatus,
    setCards, setBlogs, setReviews, setWaitlist, setTeam,
    ledgerTransactions, ledgerLoading, ledgerError, scanProgress, ledgerResyncQuota,
    needsGmailSync: gmailSynced === false,
    syncLedger,
  }), [
    user, session, currentUserStatus,
    cards, blogs, reviews, waitlist, team, logs,
    syncStatus, isLoading, isAdminDataLoaded, refreshAll, refreshUserStatus,
    setCards, setBlogs, setReviews, setWaitlist, setTeam,
    ledgerTransactions, ledgerLoading, ledgerError, scanProgress, ledgerResyncQuota, gmailSynced, syncLedger,
  ]);

  return (
    <SupabaseContext.Provider value={contextValue}>
      {children}
    </SupabaseContext.Provider>
  );
};

export const useSupabase = () => {
  const context = useContext(SupabaseContext);
  if (context === undefined) {
    throw new Error('useSupabase must be used within a SupabaseProvider');
  }
  return context;
};

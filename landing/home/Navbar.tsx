import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useSupabase } from '@shared/SupabaseProvider';
import { appUrl, goExternal, isSplitHostsEnabled } from '@shared/hosts';
import { WAITLIST_REQUIRED } from '@shared/waitlistGate';
import SquashHamburger from './SquashHamburger';
import ScrambleText from './ScrambleText';
import YurekaBrandMark from '@shared/YurekaBrandMark';

interface NavbarProps {
  // Optional homepage flourish: gates the initial fade-in on font readiness
  // instead of firing immediately on mount. Every other route just wants
  // the plain mount fade, so this defaults to true.
  entranceComplete?: boolean;
  /** Green/yellow palette only on `/` (MainPage). Other routes keep the dark shell. */
  theme?: 'landing' | 'site';
}

const NAV_THEMES = {
  landing: {
    logo: 'text-landing-primary',
    link: 'text-landing-sub/75 hover:text-landing-primary',
    cta: 'bg-landing-primary text-landing-ink',
    ctaHover: '#c9de55',
    drawerOverlay: 'bg-landing-bg/80',
    drawerPanel: 'bg-landing-bg',
    drawerTitle: 'text-landing-primary group-hover:text-landing-primary',
    drawerDesc: 'text-landing-muted group-hover:text-landing-caption',
    drawerClose: 'text-landing-primary',
    statusDot: 'bg-landing-primary',
    statusText: 'text-landing-muted',
    hamburger: '#def46e',
  },
  site: {
    logo: 'text-white',
    link: 'text-white/75 hover:text-white',
    cta: 'bg-white text-black',
    ctaHover: '#e2e2e6',
    drawerOverlay: 'bg-black/80',
    drawerPanel: 'bg-black',
    drawerTitle: 'text-white group-hover:text-landing-primary',
    drawerDesc: 'text-white/50 group-hover:text-white/70',
    drawerClose: 'text-white',
    statusDot: 'bg-landing-primary',
    statusText: 'text-white/25',
    hamburger: '#ffffff',
  },
} as const;

const NAV_LINKS = [
  { name: 'Gifting', path: '/gift', desc: 'Send a gift card without signing up' },
  { name: 'Brands', path: '/brands', desc: 'Top reward partner brands' },
  { name: 'About', path: '/about', desc: 'Who builds Yureka' },
  { name: 'FAQ', path: '/faq', desc: 'Goldback, AI, pricing' },
  { name: 'Yureka AI', path: '/yureka-ai', desc: 'Access the intelligence hub' },
  { name: 'Zwitch', path: '/zwitch', desc: 'Premium digital agency experience' },
];

// A single link in the desktop expanding-pill menu, with the same
// scramble-on-hover text effect as the "Join Waitlist" CTA.
function HeaderLogo({
  size = 'desktop',
  logoClass,
}: {
  size?: 'desktop' | 'mobile' | 'drawer';
  logoClass: string;
}) {
  const reduceMotion = useReducedMotion();
  const compact = size !== 'desktop';
  return (
    <Link to="/" aria-label="Yureka home" className="shrink-0">
      <motion.div
        className={
          compact
            ? 'flex h-9 items-center gap-2 rounded-[10px] border border-white/20 bg-white/15 px-2.5 backdrop-blur-[20px] saturate-[180%] active:scale-[0.97]'
            : 'flex h-12 items-center gap-2.5 rounded-[14px] border border-white/20 bg-white/15 px-3.5 backdrop-blur-[20px] saturate-[180%] active:scale-[0.97]'
        }
        style={{
          transformOrigin: 'left center',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.28)',
        }}
        whileHover={reduceMotion ? undefined : { scale: 1.02 }}
        whileTap={reduceMotion ? undefined : { scale: 0.97 }}
        transition={{ type: 'spring', bounce: 0, duration: 0.35 }}
      >
        <YurekaBrandMark
          className={
            compact
              ? 'h-[22px] w-[22px] rounded-[6px] object-cover'
              : 'h-7 w-7 rounded-[8px] object-cover'
          }
        />
        <span
          className={
            compact
              ? `text-[13px] font-semibold leading-none tracking-[-0.02em] whitespace-nowrap ${logoClass}`
              : `text-[16px] font-semibold leading-none tracking-[-0.022em] ${logoClass}`
          }
        >
          Yureka
        </span>
      </motion.div>
    </Link>
  );
}

function ScrambleNavLink({
  to,
  label,
  onClick,
  linkClass,
}: {
  to: string;
  label: string;
  onClick: () => void;
  linkClass: string;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <Link
      to={to}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`text-[15px] tracking-tight transition-colors ${linkClass}`}
    >
      <ScrambleText text={label} isHovered={hovered} />
    </Link>
  );
}



export default function Navbar({ entranceComplete = true, theme = 'site' }: NavbarProps) {
  const palette = NAV_THEMES[theme];
  const navigate = useNavigate();
  const { user, currentUserStatus } = useSupabase();
  const [menuOpen, setMenuOpen] = useState(false);
  const [hoveredCta, setHoveredCta] = useState(false);

  // Desktop menu is an inline expanding pill (see below); close it when the
  // user clicks anywhere outside it or presses Escape.
  const desktopMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (desktopMenuRef.current && !desktopMenuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);

  useEffect(() => {
    if (!menuOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [menuOpen]);

  const goApp = (path: string) => {
    if (isSplitHostsEnabled()) {
      goExternal(appUrl(path));
      return;
    }
    navigate(path);
  };

  // Route CTA by membership status. Waitlist paused unless VITE_WAITLIST_REQUIRED.
  // Mobile gets a shorter label so the pill doesn't overflow narrow widths.
  const open =
    currentUserStatus === 'accepted' ||
    currentUserStatus === 'admin' ||
    (!WAITLIST_REQUIRED && !!user);
  const waiting =
    WAITLIST_REQUIRED &&
    (currentUserStatus === 'pending' ||
      currentUserStatus === 'on-hold' ||
      currentUserStatus === 'rejected');
  const cta = open
    ? {
        label: 'Open Dashboard',
        mobileLabel: 'Dashboard',
        onClick: () => goApp('/dashboard'),
      }
    : waiting
      ? {
          label: 'Waiting Room',
          mobileLabel: 'Waiting',
          onClick: () => goApp(user ? '/waiting' : '/login'),
        }
      : WAITLIST_REQUIRED
        ? {
            label: 'Join Waitlist',
            mobileLabel: 'Join',
            onClick: () => goApp('/join-waitlist'),
          }
        : {
            label: 'Get Started',
            mobileLabel: 'Start',
            onClick: () => goApp('/login'),
          };

  return (
    <>
      <motion.nav
        className="fixed top-0 left-0 right-0 z-50 w-full"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: entranceComplete ? 1 : 0, y: entranceComplete ? 0 : -8 }}
        transition={{ type: 'spring', bounce: 0, duration: 0.45 }}
      >
        {/* Desktop */}
        <div className="hidden md:flex items-center justify-between h-20 px-6 md:mx-auto md:max-w-[60vw] md:px-0">
          <div className="flex items-center gap-2">
            <HeaderLogo logoClass={palette.logo} />

            {/* Inline expanding menu pill: collapsed it's just the toggle
                button; open it grows to the right and reveals the nav links,
                while the hamburger morphs into an X. */}
            <motion.div
              ref={desktopMenuRef}
              className="flex items-center h-12 overflow-hidden rounded-[14px] bg-white/15 backdrop-blur-md"
            >
              <button
                onClick={() => setMenuOpen((v) => !v)}
                aria-label={menuOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={menuOpen}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] transition-colors hover:bg-white/10 active:scale-[0.97] active:bg-white/15"
              >
                <SquashHamburger isOpen={menuOpen} variant="desktop" color={palette.hamburger} />
              </button>

              <AnimatePresence initial={false}>
                {menuOpen && (
                  <motion.div
                    key="desktop-links"
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: 'auto', opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    transition={{
                      width: { type: 'spring', damping: 30, stiffness: 300 },
                      opacity: { duration: 0.18 },
                    }}
                    className="overflow-hidden"
                  >
                    <div className="flex items-center gap-7 whitespace-nowrap pl-1 pr-6">
                      {NAV_LINKS.map((item) => (
                        <ScrambleNavLink
                          key={item.name}
                          to={item.path}
                          label={item.name}
                          onClick={closeMenu}
                          linkClass={palette.link}
                        />
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>

          <motion.button
            className={`h-12 px-6 rounded-full flex items-center gap-2 ${palette.cta}`}
            onMouseEnter={() => setHoveredCta(true)}
            onMouseLeave={() => setHoveredCta(false)}
            onClick={cta.onClick}
            whileHover={{ scale: 1.03, backgroundColor: palette.ctaHover }}
            whileTap={{ scale: 0.97 }}
          >
            <ScrambleText text={cta.label} isHovered={hoveredCta} className="text-[16px]" />
          </motion.button>
        </div>

        {/* Mobile */}
        <div className="flex md:hidden items-center justify-between h-16 px-4 gap-2">
          <HeaderLogo size="mobile" logoClass={palette.logo} />

          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Open menu"
            className="ml-auto mr-2 flex h-9 w-9 shrink-0 touch-manipulation items-center justify-center rounded-[10px] bg-white/15 backdrop-blur-md active:scale-[0.97]"
          >
            <SquashHamburger isOpen={menuOpen} variant="mobile" color={palette.hamburger} />
          </button>

          <motion.button
            type="button"
            className={`h-9 shrink-0 touch-manipulation rounded-full px-3.5 active:scale-[0.97] ${palette.cta}`}
            onClick={cta.onClick}
            whileHover={{ scale: 1.03, backgroundColor: palette.ctaHover }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: 'spring', bounce: 0, duration: 0.35 }}
          >
            <span className="text-[13px] font-medium">{cta.mobileLabel}</span>
          </motion.button>
        </div>
      </motion.nav>

      {/* Slide-out menu -- shared between mobile and desktop so the site's
          full nav (more entries than the compact pill can hold) lives in
          one place instead of duplicating a desktop dropdown and a
          separate mobile drawer. */}
      {/* Full-screen drawer is mobile-only now; desktop uses the inline
          expanding pill above. */}
      <AnimatePresence>
        {menuOpen && (
          <div className="fixed inset-0 z-[110] md:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: 'spring', bounce: 0, duration: 0.35 }}
              className={`absolute inset-0 backdrop-blur-xl ${palette.drawerOverlay}`}
              onClick={closeMenu}
            />

            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
              className={`absolute top-0 right-0 h-full w-[85%] max-w-[400px] border-l border-white/10 p-8 sm:p-10 flex flex-col shadow-2xl ${palette.drawerPanel}`}
              style={{
                paddingTop: 'max(2rem, calc(1.5rem + env(safe-area-inset-top, 0px)))',
                paddingBottom: 'max(2rem, calc(1.5rem + env(safe-area-inset-bottom, 0px)))',
              }}
            >
              <div className="flex justify-between items-center mb-12 sm:mb-16">
                <HeaderLogo size="drawer" logoClass={palette.logo} />
                <button
                  onClick={closeMenu}
                  className={`w-10 h-10 sm:w-12 sm:h-12 bg-white/5 border border-white/10 flex items-center justify-center rounded-full hover:bg-white/10 transition-all ${palette.drawerClose}`}
                >
                  <i className="bi bi-x-lg text-[16px]" />
                </button>
              </div>

              <nav className="flex-1 flex flex-col gap-6 sm:gap-8 overflow-y-auto min-h-0">
                {NAV_LINKS.map((item, idx) => (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.06 }}
                    key={item.name}
                  >
                    <Link to={item.path} onClick={closeMenu} className="group block">
                      <div className={`text-[20px] sm:text-[22px] font-normal transition-colors ${palette.drawerTitle}`}>
                        {item.name}
                      </div>
                      <div
                        style={{ fontFamily: 'Inter, sans-serif' }}
                        className={`text-[11px] uppercase tracking-[0.2em] mt-1 ${palette.drawerDesc}`}
                      >
                        {item.desc}
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </nav>

              {/* Pinned outside the scrollable link list -- with 7 links the
                  panel can run taller than the viewport, and this is the
                  one button on the page that must never require a scroll
                  to reach. */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45 }}
                className="shrink-0 pt-6 flex flex-col gap-3"
              >
                <button
                  onClick={() => {
                    closeMenu();
                    cta.onClick();
                  }}
                  className={`w-full h-14 rounded-full flex items-center justify-center gap-2 text-[14px] font-medium touch-manipulation active:scale-[0.97] ${palette.cta}`}
                >
                  {cta.label}
                </button>
              </motion.div>

              <div className="shrink-0 mt-6 pt-8 sm:pt-10 border-t border-white/5">
                <div
                  style={{ fontFamily: 'Inter, sans-serif' }}
                  className={`flex justify-between items-center text-[10px] uppercase tracking-[0.2em] ${palette.statusText}`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${palette.statusDot}`} />
                    <span>System Online</span>
                  </div>
                  <span>&copy; 2026 YUREKA</span>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

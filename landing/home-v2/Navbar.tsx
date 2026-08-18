import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useSupabase } from '@shared/SupabaseProvider';
import { appUrl, goExternal, isSplitHostsEnabled } from '@shared/hosts';
import YurekaLogo from './YurekaLogo';
import SquashHamburger from './SquashHamburger';
import ScrambleText from './ScrambleText';

interface NavbarProps {
  // Optional homepage flourish: gates the initial fade-in on font readiness
  // instead of firing immediately on mount. Every other route just wants
  // the plain mount fade, so this defaults to true.
  entranceComplete?: boolean;
}

const NAV_LINKS = [
  { name: 'Brands', path: '/brands', desc: 'Top reward partner brands' },
  { name: 'Yureka AI', path: '/yureka-ai', desc: 'Access the intelligence hub' },
  { name: 'For Brands', path: '/for-brands', desc: 'Partner, smart checkout & credit data' },
  { name: 'Zwitch', path: '/zwitch', desc: 'Premium digital agency experience' },
];

// A single link in the desktop expanding-pill menu, with the same
// scramble-on-hover text effect as the "Join Waitlist" CTA.
function ScrambleNavLink({
  to,
  label,
  onClick,
}: {
  to: string;
  label: string;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <Link
      to={to}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="text-[15px] tracking-tight text-white/75 transition-colors hover:text-white"
    >
      <ScrambleText text={label} isHovered={hovered} />
    </Link>
  );
}



export default function Navbar({ entranceComplete = true }: NavbarProps) {
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

  const goApp = (path: string) => {
    if (isSplitHostsEnabled()) {
      goExternal(appUrl(path));
      return;
    }
    navigate(path);
  };

  // Route CTA by membership status so returning users don't restart join.
  // Mobile gets a shorter label so the pill doesn't overflow narrow widths.
  const cta =
    currentUserStatus === 'accepted' || currentUserStatus === 'admin'
      ? {
          label: 'Open Dashboard',
          mobileLabel: 'Dashboard',
          onClick: () => goApp('/dashboard'),
        }
      : currentUserStatus === 'pending' ||
          currentUserStatus === 'on-hold' ||
          currentUserStatus === 'rejected'
        ? {
            label: 'Waiting Room',
            mobileLabel: 'Waiting',
            onClick: () => goApp(user ? '/waiting' : '/login'),
          }
        : {
            label: 'Join Waitlist',
            mobileLabel: 'Join',
            onClick: () => goApp('/join-waitlist'),
          };

  return (
    <>
      <motion.nav
        className="yureka-one-home fixed top-0 left-0 right-0 z-50 h-20 w-full"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: entranceComplete ? 1 : 0, y: entranceComplete ? 0 : -8 }}
        transition={{ type: 'spring', bounce: 0, duration: 0.45 }}
      >
        {/* Desktop */}
        <div className="hidden md:flex items-center justify-between h-full px-6 md:mx-auto md:max-w-[60vw] md:px-0">
          <div className="flex items-center gap-2">
            <Link to="/">
              <motion.div
                className="flex h-12 px-5 items-center gap-2 bg-white/15 backdrop-blur-md rounded-[14px]"
                whileHover={{ scale: 1.02, backgroundColor: 'rgba(255,255,255,0.22)' }}
                whileTap={{ scale: 0.98 }}
              >
                <YurekaLogo className="w-[18px] h-[18px] text-white" />
                <span className="text-white text-[16px] font-medium tracking-tight">Yureka</span>
              </motion.div>
            </Link>

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
                <SquashHamburger isOpen={menuOpen} variant="desktop" />
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
                        />
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>

          <motion.button
            className="h-12 px-6 bg-white rounded-full flex items-center gap-2 text-black"
            onMouseEnter={() => setHoveredCta(true)}
            onMouseLeave={() => setHoveredCta(false)}
            onClick={cta.onClick}
            whileHover={{ scale: 1.03, backgroundColor: '#e2e2e6' }}
            whileTap={{ scale: 0.97 }}
          >
            <ScrambleText text={cta.label} isHovered={hoveredCta} className="text-[16px]" />
          </motion.button>
        </div>

        {/* Mobile */}
        <div className="flex md:hidden items-center justify-between h-full px-4 gap-2">
          <Link to="/" className="shrink-0">
            <div className="h-9 flex items-center gap-1.5 bg-white/15 backdrop-blur-md rounded-[10px] px-3.5">
              <YurekaLogo className="w-[14px] h-[14px] text-white shrink-0" />
              <span className="text-white text-[13px] font-medium tracking-tight whitespace-nowrap">
                Yureka
              </span>
            </div>
          </Link>

          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            className="ml-auto mr-2 flex h-9 w-9 shrink-0 touch-manipulation items-center justify-center rounded-[10px] bg-white/15 backdrop-blur-md active:scale-[0.97]"
          >
            <SquashHamburger isOpen={menuOpen} variant="mobile" />
          </button>

          <motion.button
            type="button"
            className="h-9 shrink-0 touch-manipulation rounded-full bg-white px-3.5 text-black active:scale-[0.97]"
            onClick={cta.onClick}
            whileHover={{ scale: 1.03, backgroundColor: '#e2e2e6' }}
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
          <div className="yureka-one-home fixed inset-0 z-[110] md:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-xl"
              onClick={closeMenu}
            />

            <motion.div
              initial={{ x: '100%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 220 }}
              className="absolute top-0 right-0 h-full w-[85%] max-w-[400px] bg-black border-l border-white/10 p-8 sm:p-10 flex flex-col shadow-2xl"
            >
              <div className="flex justify-between items-center mb-12 sm:mb-16">
                <div className="flex items-center gap-2">
                  <YurekaLogo className="w-[18px] h-[18px] text-white" />
                  <span className="text-white text-[16px] font-medium tracking-tight">Yureka</span>
                </div>
                <button
                  onClick={closeMenu}
                  className="w-10 h-10 sm:w-12 sm:h-12 bg-white/5 border border-white/10 flex items-center justify-center rounded-full text-white hover:bg-white/10 transition-all"
                >
                  <i className="bi bi-x-lg text-[16px]" />
                </button>
              </div>

              <nav className="flex-none flex flex-col gap-6 sm:gap-8 overflow-y-auto max-h-[50vh]">
                {NAV_LINKS.map((item, idx) => (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.06 }}
                    key={item.name}
                  >
                    <Link to={item.path} onClick={closeMenu} className="group block">
                      <div className="text-[20px] sm:text-[22px] font-normal text-white group-hover:text-[#5fae52] transition-colors">
                        {item.name}
                      </div>
                      <div
                        style={{ fontFamily: 'Inter, sans-serif' }}
                        className="text-[11px] uppercase tracking-[0.2em] text-white/30 group-hover:text-white/50 mt-1"
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
                  className="w-full h-14 bg-white text-black rounded-full flex items-center justify-center gap-2 text-[14px] font-medium"
                >
                  {cta.label}
                </button>
              </motion.div>

              <div className="shrink-0 mt-6 pt-8 sm:pt-10 border-t border-white/5">
                <div
                  style={{ fontFamily: 'Inter, sans-serif' }}
                  className="flex justify-between items-center text-white/25 text-[10px] uppercase tracking-[0.2em]"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-[#5fae52] rounded-full animate-pulse" />
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

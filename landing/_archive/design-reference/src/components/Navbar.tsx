import { useState } from 'react';
import { motion } from 'framer-motion';
import YurekaLogo from './YurekaLogo';
import SquashHamburger from './SquashHamburger';
import ScrambleText from './ScrambleText';

interface NavbarProps {
  entranceComplete: boolean;
}

export default function Navbar({ entranceComplete }: NavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [hoveredAbout, setHoveredAbout] = useState(false);
  const [hoveredMetrics, setHoveredMetrics] = useState(false);
  const [hoveredDownload, setHoveredDownload] = useState(false);

  // Sections are pinned scroll sequences of varying height now (not a
  // uniform 100vh each), so nav targets are computed from the wrapper's
  // actual position rather than a fixed window.innerHeight multiplier.
  // extraVh is how far into that wrapper's own pinned sequence to land
  // (e.g. past its slide phase, so the destination section is centered).
  const scrollToId = (id: string, extraVh: number) => {
    const el = document.getElementById(id);
    if (el) {
      window.scrollTo({
        top: el.offsetTop + window.innerHeight * (extraVh / 100),
        behavior: 'smooth',
      });
    }
    setMenuOpen(false);
  };

  return (
    <motion.nav
      className="fixed top-0 left-0 right-0 z-50 h-20 w-full"
      initial={{ opacity: 0 }}
      animate={{ opacity: entranceComplete ? 1 : 0 }}
      transition={{ duration: 0.8 }}
    >
      {/* Desktop */}
      <div className="hidden md:flex items-center justify-between h-full px-6 md:mx-auto md:max-w-[60vw] md:px-0">
        <div className="flex items-center gap-2">
          <motion.div
            className={`${
              menuOpen ? 'hidden md:flex' : 'flex'
            } h-12 px-5 items-center gap-2 bg-white/15 backdrop-blur-md rounded-[14px]`}
            whileHover={{ scale: 1.02, backgroundColor: 'rgba(255,255,255,0.22)' }}
            whileTap={{ scale: 0.98 }}
          >
            <YurekaLogo className="w-[18px] h-[18px] text-white" />
            <span className="text-white text-[16px] font-medium tracking-tight">Yureka</span>
          </motion.div>

          <motion.div
            className="h-12 rounded-[14px] bg-white/15 backdrop-blur-md flex items-center overflow-hidden"
            animate={{ width: menuOpen ? 290 : 48 }}
            transition={{ type: 'spring', stiffness: 350, damping: 28 }}
          >
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className={`flex items-center justify-center shrink-0 transition-colors ${
                menuOpen
                  ? 'w-9 h-9 rounded-[11px] bg-white/10 hover:bg-white/20 ml-1.5'
                  : 'w-12 h-12 rounded-[14px]'
              }`}
            >
              <SquashHamburger isOpen={menuOpen} variant="desktop" />
            </button>

            <motion.div
              className="flex items-center gap-6 pl-4 pr-5 whitespace-nowrap"
              initial={false}
              animate={{ opacity: menuOpen ? 1 : 0, x: menuOpen ? 0 : 15 }}
              transition={{ duration: 0.25 }}
            >
              <button
                onMouseEnter={() => setHoveredAbout(true)}
                onMouseLeave={() => setHoveredAbout(false)}
                onClick={() => scrollToId('hero-cinematic-wrapper', 670)}
              >
                <ScrambleText
                  text="Brands"
                  isHovered={hoveredAbout}
                  className="text-[16px] font-normal text-white/85 hover:text-white"
                />
              </button>
              <button
                onMouseEnter={() => setHoveredMetrics(true)}
                onMouseLeave={() => setHoveredMetrics(false)}
                onClick={() => scrollToId('metrics-technology-wrapper', 0)}
              >
                <ScrambleText
                  text="For Brands"
                  isHovered={hoveredMetrics}
                  className="text-[16px] font-normal text-white/85 hover:text-white"
                />
              </button>
            </motion.div>
          </motion.div>
        </div>

        <motion.button
          className="h-12 px-6 bg-white rounded-full flex items-center gap-2 text-black"
          onMouseEnter={() => setHoveredDownload(true)}
          onMouseLeave={() => setHoveredDownload(false)}
          whileHover={{ scale: 1.03, backgroundColor: '#e2e2e6' }}
          whileTap={{ scale: 0.97 }}
        >
          <i className="bi bi-apple text-[16px]" />
          <ScrambleText text="Join Waitlist" isHovered={hoveredDownload} className="text-[16px]" />
        </motion.button>
      </div>

      {/* Mobile */}
      <div className="flex md:hidden items-center justify-between h-full px-4 gap-2">
        <motion.div
          className="h-9 flex items-center gap-1.5 bg-white/15 backdrop-blur-md rounded-[10px] overflow-hidden shrink-0"
          animate={{ width: menuOpen ? 0 : 'auto', paddingLeft: menuOpen ? 0 : 14, paddingRight: menuOpen ? 0 : 14 }}
          transition={{ type: 'spring', stiffness: 350, damping: 28 }}
        >
          <YurekaLogo className="w-[14px] h-[14px] text-white shrink-0" />
          <span className="text-white text-[13px] font-medium tracking-tight whitespace-nowrap">
            Yureka
          </span>
        </motion.div>

        <motion.div
          className="h-9 rounded-[10px] bg-white/15 backdrop-blur-md flex items-center overflow-hidden"
          animate={{ width: menuOpen ? '100%' : 36 }}
          transition={{ type: 'spring', stiffness: 350, damping: 28 }}
        >
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className={`flex items-center justify-center shrink-0 transition-colors ${
              menuOpen
                ? 'w-7 h-7 rounded-[8px] bg-white/10 hover:bg-white/20 ml-1'
                : 'w-9 h-9 rounded-[10px]'
            }`}
          >
            <SquashHamburger isOpen={menuOpen} variant="mobile" />
          </button>

          <motion.div
            className="flex items-center gap-4 pl-3 pr-4 whitespace-nowrap"
            initial={false}
            animate={{ opacity: menuOpen ? 1 : 0, x: menuOpen ? 0 : 15 }}
            transition={{ duration: 0.25 }}
          >
            <button onClick={() => scrollToId('hero-cinematic-wrapper', 670)} className="text-[13px] font-normal text-white/85">
              Brands
            </button>
            <button onClick={() => scrollToId('metrics-technology-wrapper', 0)} className="text-[13px] font-normal text-white/85">
              For Brands
            </button>
          </motion.div>
        </motion.div>

        <motion.button
          className="h-9 px-3.5 bg-white rounded-full flex items-center gap-1.5 text-black shrink-0"
          whileHover={{ scale: 1.03, backgroundColor: '#e2e2e6' }}
          whileTap={{ scale: 0.97 }}
        >
          <i className="bi bi-apple text-[13px]" />
          <span className="text-[13px]">Join Waitlist</span>
        </motion.button>
      </div>
    </motion.nav>
  );
}

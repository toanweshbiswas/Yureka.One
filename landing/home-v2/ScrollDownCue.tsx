import { motion } from 'motion/react';
import { useEffect, useState } from 'react';

/**
 * Home-only scroll cue. a green mouse/pill with a bouncing dot + "Keep Scrolling"
 * label, pinned to the bottom-right (within the rightmost fifth of the screen).
 * Visible throughout the page, but fades out once the footer scrolls into view.
 * Clicking it scrolls down a screen.
 */
export default function ScrollDownCue() {
  const [atFooter, setAtFooter] = useState(false);

  useEffect(() => {
    const footer = document.querySelector('footer');
    if (!footer) return;
    const io = new IntersectionObserver(
      ([entry]) => setAtFooter(entry.isIntersecting),
      { threshold: 0.01 }
    );
    io.observe(footer);
    return () => io.disconnect();
  }, []);

  const scrollDown = () =>
    window.scrollBy({ top: Math.round(window.innerHeight * 0.9), behavior: 'smooth' });

  return (
    <button
      type="button"
      aria-label="Keep scrolling"
      onClick={scrollDown}
      style={{ fontFamily: 'Inter, sans-serif' }}
      className={`fixed bottom-8 right-[4vw] z-40 hidden items-center gap-3 select-none transition-opacity duration-500 sm:flex ${
        atFooter ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
    >
      {/* Mouse / pill */}
      <span
        className="relative flex justify-center rounded-full"
        style={{ width: 30, height: 50, border: '2px solid #3DF08B', paddingTop: 8 }}
      >
        <motion.span
          className="block rounded-full"
          style={{ width: 10, height: 10, background: '#3DF08B', boxShadow: '0 0 12px rgba(61,240,139,.8)' }}
          animate={{ y: [0, 16, 0], opacity: [1, 0.3, 1] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
        />
      </span>

      <span style={{ fontFamily: 'Inter, sans-serif', color: '#3DF08B', fontSize: 18, fontWeight: 500, letterSpacing: '-0.01em' }}>
        Keep Scrolling
      </span>
    </button>
  );
}

import { useEffect, useRef, useState } from 'react';

const CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+~|}{[]:;?><';

function randomChar() {
  return CHARS[Math.floor(Math.random() * CHARS.length)];
}

// How long the fully-revealed text holds before the scramble replays.
const LOOP_PAUSE_MS = 3000;

interface ScrambleInProps {
  text: string;
  delay: number;
  triggered: boolean;
}

export default function ScrambleIn({ text, delay, triggered }: ScrambleInProps) {
  const [display, setDisplay] = useState('');
  const [started, setStarted] = useState(false);
  const revealRef = useRef(0);

  useEffect(() => {
    if (!triggered) return;
    const timeout = setTimeout(() => setStarted(true), delay);
    return () => clearTimeout(timeout);
  }, [triggered, delay]);

  useEffect(() => {
    if (!started) return;

    // rAF instead of setInterval: stays frame-synced (no jank from timer
    // drift competing with scroll/paint work) and, unlike setInterval,
    // automatically pauses while the tab is backgrounded.
    let raf = 0;
    let pauseTimeout: ReturnType<typeof setTimeout> | undefined;
    let lastTick = performance.now();

    // Runs one scramble-in pass, then schedules the next one after a pause
    // once the text has fully resolved -- looping for as long as this
    // header stays mounted.
    const runReveal = () => {
      revealRef.current = 0;
      lastTick = performance.now();

      const tick = (now: number) => {
        if (now - lastTick >= 25) {
          lastTick = now;
          revealRef.current += 0.5;
          const revealCount = Math.floor(revealRef.current);

          let out = '';
          for (let i = 0; i < text.length; i++) {
            const char = text[i];
            if (char === ' ') {
              out += ' ';
            } else if (i < revealCount) {
              out += char;
            } else if (i < revealCount + 3) {
              out += randomChar();
            }
          }
          setDisplay(out);

          if (revealCount >= text.length) {
            setDisplay(text);
            pauseTimeout = setTimeout(runReveal, LOOP_PAUSE_MS);
            return;
          }
        }
        raf = requestAnimationFrame(tick);
      };

      raf = requestAnimationFrame(tick);
    };

    runReveal();

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(pauseTimeout);
    };
  }, [started, text]);

  if (!triggered) {
    return <span dangerouslySetInnerHTML={{ __html: '&nbsp;' }} />;
  }

  return <span>{display || ' '}</span>;
}

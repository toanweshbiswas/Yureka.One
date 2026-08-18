import { useEffect, useRef, useState } from 'react';

const CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+~|}{[]:;?><';

function randomChar() {
  return CHARS[Math.floor(Math.random() * CHARS.length)];
}

interface ScrambleInProps {
  text: string;
  delay: number;
  triggered: boolean;
  /** When false (default), reveal once and hold — looping scramble reads as broken text. */
  loop?: boolean;
}

/**
 * One-shot (by default) scramble reveal.
 * Always renders the full string length so mid-frames never collapse to
 * garbage like "uHP" / "Uptw )" (previous bug skipped trailing chars).
 * Cadence is capped ~24fps so 120Hz displays don't look frantic.
 */
export default function ScrambleIn({ text, delay, triggered, loop = false }: ScrambleInProps) {
  const [display, setDisplay] = useState(text);
  const [started, setStarted] = useState(false);
  const reduceMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (!triggered) return;
    if (reduceMotion) {
      setDisplay(text);
      setStarted(false);
      return;
    }
    const timeout = setTimeout(() => setStarted(true), delay);
    return () => clearTimeout(timeout);
  }, [triggered, delay, reduceMotion, text]);

  useEffect(() => {
    if (!started || reduceMotion) return;

    let raf = 0;
    let pauseTimeout: ReturnType<typeof setTimeout> | undefined;
    let lastTick = 0;
    let reveal = 0;
    const TICK_MS = 42; // ~24fps — calm on ProMotion / 120Hz

    const paint = (revealCount: number) => {
      let out = '';
      for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (char === ' ') {
          out += ' ';
        } else if (i < revealCount) {
          out += char;
        } else if (i < revealCount + 3) {
          out += randomChar();
        } else {
          // Keep slot occupied with a quiet placeholder so width never collapses
          out += char === '%' || char === '.' ? char : '·';
        }
      }
      setDisplay(out);
    };

    const runReveal = () => {
      reveal = 0;
      lastTick = 0;

      const tick = (now: number) => {
        if (!lastTick) lastTick = now;
        if (now - lastTick >= TICK_MS) {
          lastTick = now;
          reveal += 0.55;
          const revealCount = Math.floor(reveal);
          paint(revealCount);

          if (revealCount >= text.length) {
            setDisplay(text);
            if (loop) {
              pauseTimeout = setTimeout(runReveal, 4000);
            }
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
  }, [started, text, loop, reduceMotion]);

  if (!triggered) {
    return <span className="invisible">{text}</span>;
  }

  return <span>{display}</span>;
}

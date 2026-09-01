import { useEffect, useState } from 'react';

const CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+~|}{[]:;?><';

function randomChar() {
  return CHARS[Math.floor(Math.random() * CHARS.length)];
}

interface ScrambleTextProps {
  text: string;
  isHovered: boolean;
  className?: string;
}

export default function ScrambleText({ text, isHovered, className }: ScrambleTextProps) {
  const [display, setDisplay] = useState(text);

  useEffect(() => {
    if (!isHovered) {
      setDisplay(text);
      return;
    }

    let raf = 0;
    let lastTick = performance.now();
    let tickCount = 0;

    const tick = (now: number) => {
      if (now - lastTick >= 25) {
        lastTick = now;
        tickCount += 1;
        const revealCount = Math.floor(tickCount / 4);

        let out = '';
        for (let i = 0; i < text.length; i++) {
          const char = text[i];
          if (char === ' ') {
            out += ' ';
          } else if (i < revealCount) {
            out += char;
          } else {
            out += randomChar();
          }
        }
        setDisplay(out);

        if (revealCount >= text.length) {
          setDisplay(text);
          return;
        }
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isHovered, text]);

  return <span className={className}>{display}</span>;
}

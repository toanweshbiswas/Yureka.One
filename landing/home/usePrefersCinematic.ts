import { useEffect, useState } from 'react';

/**
 * Pin-scrub cinematic is a pointer+scroll conversation. On touch (phones,
 * iPhone landscape, most tablets) it reads as a dead sticky trap.
 * Only enable it when the viewport is desktop-wide AND the pointer can hover.
 */
const CINEMATIC_QUERY = '(min-width: 1024px) and (hover: hover) and (pointer: fine)';

export function usePrefersCinematic() {
  const [enabled, setEnabled] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(CINEMATIC_QUERY).matches : false,
  );

  useEffect(() => {
    const mq = window.matchMedia(CINEMATIC_QUERY);
    const onChange = () => setEnabled(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return enabled;
}

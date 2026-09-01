import { useEffect, useRef, useState } from 'react';

// `once: true` (the default) is for lazy-loading -- flips to true on first
// intersection and stops observing, since revoking a video's src once the
// user has already scrolled past it would just stall it mid-loop.
// `once: false` is for gating background work (scroll listeners, seeks)
// that should stop when a section leaves view and resume if it comes back.
export function useInView<T extends HTMLElement>(rootMargin = '400px', once = true) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setInView(entry.isIntersecting);
        if (entry.isIntersecting && once) observer.disconnect();
      },
      { rootMargin },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin, once]);

  return { ref, inView };
}

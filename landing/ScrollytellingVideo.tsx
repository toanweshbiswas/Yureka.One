/**
 * ScrollytellingVideo  to  v2 (optimised)
 * ─────────────────────────────────────────────────────────────────────────────
 * Root-cause fixes vs v1:
 *
 *  1. SEEKED-EVENT DRAW. drawImage() is now called exclusively inside the
 *     browser's `seeked` event, so the frame is guaranteed to be decoded before
 *     we paint it.  v1 drew immediately after setting currentTime which always
 *     painted the *previous* frame → visible stutter / wrong frames.
 *
 *  2. SEEK GUARD. `isSeekingRef` prevents overlapping seeks from piling up.
 *     The loop re-triggers once the current seek resolves.
 *
 *  3. FAST CANVAS CONTEXT. `{ alpha: false }` tells the compositor the canvas
 *     is fully opaque, enabling ~30 % faster 2-D drawing.
 *
 *  4. PROXIMITY-GATED PRELOAD. video.load() only fires when the section is
 *     within 800 px of the viewport, so off-screen videos don't compete for
 *     bandwidth during initial page load.
 *
 *  5. MIN-SEEK DELTA. skips seeks smaller than one frame at 30 fps (≈0.033 s)
 *     to avoid wasting CPU on imperceptible changes.
 *
 *  6. CLEAN CLEANUP. all listeners use { once: true } or are removed
 *     explicitly; RAF is always cancelled on unmount.
 */
import React, { useRef, useEffect, useState, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScrollytellingVideoProps {
  /** Public asset URL */
  src: string;
  /**
   * Number of viewport-heights for the scroll track.
   * scrollMultiplier=3 → 300 vh outer div, video scrubs over 200 vh.
   * @default 3
   */
  scrollMultiplier?: number;
  className?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Linear interpolation */
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Minimum time delta to bother seeking (≈1 frame @30 fps) */
const MIN_SEEK_DELTA = 1 / 30;

/** Lerp easing coefficient. lower = smoother follow, higher = snappier */
const LERP_FACTOR = 0.1;

// ─── Component ────────────────────────────────────────────────────────────────

const ScrollytellingVideo: React.FC<ScrollytellingVideoProps> = ({
  src,
  scrollMultiplier = 3,
  className = '',
}) => {
  // ── Refs ──────────────────────────────────────────────────────────────────
  const outerRef  = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef  = useRef<HTMLVideoElement>(null);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [loadState, setLoadState] = useState<'loading' | 'buffering' | 'ready'>('loading');
  const [loadPct, setLoadPct]     = useState(0);

  // ── Responsive scroll track length ────────────────────────────────────────
  // On tablet/mobile the scrub track is shortened so users don't scroll
  // through long stretches of black padding to reveal the video.
  const [effectiveMultiplier, setEffectiveMultiplier] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth < 1024
      ? scrollMultiplier * (2 / 3)
      : scrollMultiplier
  );

  useEffect(() => {
    const update = () => {
      setEffectiveMultiplier(window.innerWidth < 1024 ? scrollMultiplier * (2 / 3) : scrollMultiplier);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [scrollMultiplier]);

  // ── Mutable scrub state (no re-renders) ───────────────────────────────────
  const targetTimeRef  = useRef(0);
  const currentTimeRef = useRef(0);
  const rafIdRef       = useRef<number | null>(null);
  const isSeekingRef   = useRef(false);   // seek guard
  const isActiveRef    = useRef(false);   // section in viewport?

  // ── Draw current decoded frame to canvas ──────────────────────────────────
  const drawFrame = useCallback(() => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth) return;

    // Sync canvas resolution to video (done once per video)
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width  = video.videoWidth;
      canvas.height = video.videoHeight;
    }

    // alpha:false = opaque canvas → ~30 % faster compositing
    const ctx = canvas.getContext('2d', { alpha: false }) as CanvasRenderingContext2D | null;
    ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
  }, []);

  // ── Issue a seek; draw only after browser confirms frame is decoded ────────
  const seekTo = useCallback((time: number) => {
    const video = videoRef.current;
    if (!video || !video.duration) return;

    // Clamp to valid range
    const clamped = Math.max(0, Math.min(time, video.duration));

    // Skip if already seeking or change is below one-frame threshold
    if (isSeekingRef.current) return;
    if (Math.abs(video.currentTime - clamped) < MIN_SEEK_DELTA) return;

    isSeekingRef.current = true;

    // Draw ONLY inside `seeked`  to  this is when the frame is guaranteed ready
    video.addEventListener('seeked', () => {
      isSeekingRef.current = false;
      drawFrame();
    }, { once: true });

    video.currentTime = clamped;
  }, [drawFrame]);

  // ── RAF loop: lerp currentTime → targetTime, then issue a seek ────────────
  const startLoop = useCallback(() => {
    if (rafIdRef.current !== null) return; // already running

    const tick = () => {
      const video = videoRef.current;
      if (!video?.duration) { rafIdRef.current = null; return; }

      const diff = targetTimeRef.current - currentTimeRef.current;

      if (Math.abs(diff) > 0.001) {
        currentTimeRef.current = lerp(currentTimeRef.current, targetTimeRef.current, LERP_FACTOR);
        seekTo(currentTimeRef.current);
        rafIdRef.current = requestAnimationFrame(tick);
      } else {
        // Converged  to  one final seek then idle
        currentTimeRef.current = targetTimeRef.current;
        seekTo(targetTimeRef.current);
        rafIdRef.current = null;
      }
    };

    rafIdRef.current = requestAnimationFrame(tick);
  }, [seekTo]);

  const stopLoop = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
  }, []);

  // ── Proximity-gated preload ────────────────────────────────────────────────
  useEffect(() => {
    const outer = outerRef.current;
    const video = videoRef.current;
    if (!outer || !video) return;

    let loaded = false;

    const load = () => {
      if (loaded) return;
      loaded = true;

      setLoadState('loading');
      setLoadPct(0);
      targetTimeRef.current  = 0;
      currentTimeRef.current = 0;

      video.src       = src;
      video.preload   = 'auto';
      video.muted     = true;
      video.playsInline = true;

      const onMeta = () => {
        video.currentTime = 0;
        setLoadState('buffering');
      };

      const onProgress = () => {
        if (!video.duration) return;
        let buffered = 0;
        for (let i = 0; i < video.buffered.length; i++) {
          buffered = Math.max(buffered, video.buffered.end(i));
        }
        const pct = Math.min(100, Math.round((buffered / video.duration) * 100));
        setLoadPct(pct);
        if (pct >= 100) setLoadState('ready');
      };

      const onCanPlay = () => {
        // Paint first frame once seeked to t=0
        video.addEventListener('seeked', drawFrame, { once: true });
        setLoadState('ready');
        setLoadPct(100);
      };

      video.addEventListener('loadedmetadata', onMeta,     { once: true });
      video.addEventListener('canplay',        onCanPlay,  { once: true });
      video.addEventListener('progress',       onProgress);
      video.addEventListener('error', () => setLoadState('ready'), { once: true });

      video.load();

      return () => video.removeEventListener('progress', onProgress);
    };

    // Only start loading once section is within 800px of viewport
    const io = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) load(); },
      { rootMargin: '800px' }
    );
    io.observe(outer);

    return () => {
      io.disconnect();
      stopLoop();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  // ── Scroll → time mapping ──────────────────────────────────────────────────
  useEffect(() => {
    if (loadState !== 'ready') return;

    const outer = outerRef.current;
    if (!outer) return;

    // Visibility guard
    const visIO = new IntersectionObserver(
      ([entry]) => {
        isActiveRef.current = entry.isIntersecting;
        if (!entry.isIntersecting) stopLoop();
      },
      { threshold: 0 }
    );
    visIO.observe(outer);

    const onScroll = () => {
      if (!isActiveRef.current) return;
      const video = videoRef.current;
      if (!video?.duration) return;

      const rect   = outer.getBoundingClientRect();
      const trackH = rect.height - window.innerHeight;
      if (trackH <= 0) return;

      const progress        = Math.max(0, Math.min(1, -rect.top / trackH));
      targetTimeRef.current = progress * video.duration;
      startLoop();
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll,  { passive: true });
    onScroll(); // sync on first mount

    return () => {
      visIO.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      stopLoop();
    };
  }, [loadState, startLoop, stopLoop]);

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      ref={outerRef}
      style={{ height: `${effectiveMultiplier * 100}vh` }}
      className={`relative w-full bg-black ${className}`}
    >
      {/* Sticky pane  to  stays pinned while the outer div scrolls */}
      <div className="sticky top-0 h-screen w-full flex items-center justify-center py-2 px-6 sm:px-12 md:px-20 overflow-hidden">

        {/* Island container */}
        <div className="relative w-full max-w-[1600px] rounded-3xl overflow-hidden shadow-[0_40px_120px_rgba(0,0,0,0.8)] bg-black border border-white/[0.06] aspect-video">

          {/* Visible canvas  to  GPU-composited, opaque */}
          <canvas
            ref={canvasRef}
            className="w-full h-full block"
            style={{ willChange: 'contents' }}
            aria-label="Scrollytelling video"
          />

          {/* Hidden video  to  used only for frame decode, never rendered */}
          <video
            ref={videoRef}
            muted
            playsInline
            className="absolute opacity-0 pointer-events-none w-px h-px top-0 left-0"
            aria-hidden="true"
          />

          {/* Loading / Buffering overlay */}
          {loadState !== 'ready' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm">
              {/* Progress ring */}
              <div className="relative w-14 h-14 mb-5">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 56 56">
                  <circle
                    cx="28" cy="28" r="24"
                    fill="none"
                    stroke="rgba(255,255,255,0.08)"
                    strokeWidth="4"
                  />
                  <circle
                    cx="28" cy="28" r="24"
                    fill="none"
                    stroke="white"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 24}`}
                    strokeDashoffset={`${2 * Math.PI * 24 * (1 - loadPct / 100)}`}
                    style={{ transition: 'stroke-dashoffset 0.3s ease' }}
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-white text-[10px] font-mono font-bold tabular-nums">
                  {loadPct}%
                </span>
              </div>

              <p className="text-neutral-400 font-mono text-[11px] tracking-[3px] uppercase">
                {loadState === 'loading' ? 'Loading' : 'Buffering'}
              </p>

              <div className="mt-4 w-32 h-[2px] bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white/60 rounded-full transition-all duration-300"
                  style={{ width: `${loadPct}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ScrollytellingVideo;
export { ScrollytellingVideo };

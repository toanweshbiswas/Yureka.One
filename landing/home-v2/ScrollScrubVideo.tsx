import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion, useScroll } from 'framer-motion';
import GlassLayer from './GlassLayer';
import { useVideoScrub } from './useVideoScrub';

/**
 * Mobile/touch counterpart to desktop pin-scrub videos.
 * Scroll drives `currentTime` 1:1 (paused + seek). more reliable on iOS
 * than muted autoplay, which is often blocked in Low Power Mode.
 */

let mediaUnlocked = false;

function unlockInlineVideo(video: HTMLVideoElement | null) {
  if (!video) return;
  video.muted = true;
  video.playsInline = true;
  video.setAttribute('playsinline', '');
  video.setAttribute('webkit-playsinline', '');
  if (mediaUnlocked) {
    try {
      video.pause();
    } catch {
      /* ignore */
    }
    return;
  }
  const p = video.play();
  if (p) {
    p.then(() => {
      video.pause();
      mediaUnlocked = true;
    }).catch(() => {});
  }
}

export default function ScrollScrubVideo({
  src,
  poster,
  fit = 'cover',
  className = '',
  trackVh = 140,
  startTime = 0,
  eager = false,
  showScrollCue = false,
}: {
  src: string;
  poster?: string;
  fit?: 'cover' | 'contain';
  className?: string;
  /** Scroll distance while the card stays pinned. */
  trackVh?: number;
  startTime?: number;
  eager?: boolean;
  showScrollCue?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const trackRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const activeRef = useRef(true);
  const [near, setNear] = useState(eager);
  const [hasFrame, setHasFrame] = useState(false);

  const { scrollYProgress } = useScroll({
    target: trackRef,
    offset: ['start start', 'end end'],
  });

  const mapTime = useCallback(
    (progress: number, duration: number) => {
      const t0 = Math.min(startTime, Math.max(0, duration - 0.05));
      const span = Math.max(0.05, duration - t0);
      return t0 + Math.max(0, Math.min(1, progress)) * span;
    },
    [startTime],
  );

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        activeRef.current = entry.isIntersecting;
        if (entry.isIntersecting) setNear(true);
      },
      { rootMargin: '320px 0px', threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = true;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    try {
      video.pause();
    } catch {
      /* ignore */
    }
  }, [near, src]);

  useEffect(() => {
    if (!near) return;
    const video = videoRef.current;
    if (!video) return;

    const mark = () => setHasFrame(true);
    const seed = () => {
      try {
        if (video.duration && Math.abs(video.currentTime - startTime) > 0.12) {
          video.currentTime = Math.min(startTime, Math.max(0, video.duration - 0.05));
        }
      } catch {
        /* ignore */
      }
      mark();
    };

    video.addEventListener('loadeddata', seed);
    video.addEventListener('loadedmetadata', seed);
    video.addEventListener('seeked', mark);
    video.addEventListener('canplay', mark);

    const unlock = () => unlockInlineVideo(video);
    unlock();
    window.addEventListener('touchstart', unlock, { passive: true, once: true });
    window.addEventListener('pointerdown', unlock, { passive: true, once: true });

    const failSafe = window.setTimeout(mark, 1600);

    return () => {
      video.removeEventListener('loadeddata', seed);
      video.removeEventListener('loadedmetadata', seed);
      video.removeEventListener('seeked', mark);
      video.removeEventListener('canplay', mark);
      window.removeEventListener('touchstart', unlock);
      window.removeEventListener('pointerdown', unlock);
      window.clearTimeout(failSafe);
    };
  }, [near, src, startTime]);

  useVideoScrub({
    videoRef,
    scrollProgress: scrollYProgress,
    mapTime: reduceMotion ? () => startTime : mapTime,
    activeRef,
    enabled: near && !reduceMotion,
  });

  const card = (
    <div
      className={`relative w-full overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0a] ${className}`}
      style={{ aspectRatio: '16 / 10', maxHeight: 'min(58dvh, 420px)' }}
    >
      {!hasFrame && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div
            className="h-[55%] w-[55%] rounded-full opacity-30"
            style={{
              background: 'radial-gradient(circle, #5fae52 0%, transparent 70%)',
              filter: 'blur(28px)',
            }}
          />
        </div>
      )}
      {near && (
        <video
          ref={videoRef}
          src={src}
          poster={poster}
          muted
          playsInline
          preload="auto"
          disablePictureInPicture
          className={`absolute inset-0 h-full w-full ${
            fit === 'cover' ? 'object-cover' : 'object-contain'
          } ${hasFrame ? 'opacity-100' : 'opacity-80'}`}
          onLoadedData={() => setHasFrame(true)}
        />
      )}
      <GlassLayer />
    </div>
  );

  if (reduceMotion) {
    return <div className="px-0">{card}</div>;
  }

  return (
    <div ref={trackRef} className="relative w-full" style={{ height: `${trackVh}vh` }}>
      <div
        className="sticky flex w-full items-center justify-center px-0"
        style={{
          top: 'calc(4.75rem + env(safe-area-inset-top, 0px))',
          height: 'calc(100dvh - 5.5rem - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))',
        }}
      >
        <motion.div
          className="w-full"
          initial={false}
          animate={{ opacity: 1 }}
          transition={{ type: 'spring', bounce: 0, duration: 0.35 }}
        >
          {card}
        </motion.div>

        {showScrollCue && (
          <div
            className="pointer-events-none absolute left-1/2 flex -translate-x-1/2 flex-col items-center gap-2 motion-reduce:hidden"
            style={{ bottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))' }}
          >
            <motion.div
              className="h-10 w-px origin-top bg-white/30"
              initial={{ scaleY: 0, opacity: 0 }}
              animate={{ scaleY: [0, 1, 1, 0], opacity: [0, 1, 1, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: 0.6 }}
            />
            <span className="text-[10px] uppercase tracking-[0.3em] text-white/35">Keep Scrolling</span>
          </div>
        )}
      </div>
    </div>
  );
}

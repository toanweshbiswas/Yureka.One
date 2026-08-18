import { useEffect, type RefObject } from 'react';
import type { MotionValue } from 'framer-motion';

/**
 * Scroll-linked video scrubbing.
 *
 * Direct manipulation (1:1 with scroll). Seeks are capped (~24fps) so ProMotion
 * displays don't spam decoder seeks. A seek-timeout prevents the loop from
 * freezing forever if `seeked` never fires.
 */
export function useVideoScrub(opts: {
  videoRef: RefObject<HTMLVideoElement | null>;
  scrollProgress: MotionValue<number>;
  mapTime: (progress: number, duration: number) => number | null;
  activeRef: RefObject<boolean>;
  /** Min media-time delta between seeks. Default ~1 frame at 24fps. */
  minDeltaSec?: number;
}) {
  const { videoRef, scrollProgress, mapTime, activeRef, minDeltaSec = 1 / 24 } = opts;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let raf = 0;
    let seeking = false;
    let seekStartedAt = 0;
    let lastApplied = -1;
    let lastTick = 0;
    const SEEK_TIMEOUT_MS = 180;
    const TICK_MS = 1000 / 24;

    const onSeeking = () => {
      seeking = true;
      seekStartedAt = performance.now();
    };
    const onSeeked = () => {
      seeking = false;
    };

    video.addEventListener('seeking', onSeeking);
    video.addEventListener('seeked', onSeeked);

    // Ensure metadata is available for duration-based scrubbing.
    if (video.readyState < 1) {
      try {
        video.load();
      } catch {
        /* ignore */
      }
    }

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);

      if (document.hidden || !activeRef.current) return;
      if (seeking && now - seekStartedAt > SEEK_TIMEOUT_MS) {
        seeking = false; // unblock a stuck seek
      }
      if (seeking || !video.duration) return;
      if (now - lastTick < TICK_MS) return;
      lastTick = now;

      const target = mapTime(scrollProgress.get(), video.duration);
      if (target == null || Number.isNaN(target)) return;

      const clamped = Math.max(0, Math.min(video.duration - 0.05, target));
      if (Math.abs(lastApplied - clamped) < minDeltaSec) return;

      try {
        video.currentTime = clamped;
        lastApplied = clamped;
      } catch {
        /* ignore seek-before-ready */
      }
    };

    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      video.removeEventListener('seeking', onSeeking);
      video.removeEventListener('seeked', onSeeked);
    };
  }, [videoRef, scrollProgress, mapTime, activeRef, minDeltaSec]);
}

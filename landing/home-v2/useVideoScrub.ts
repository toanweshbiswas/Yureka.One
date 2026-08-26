import { useEffect, type RefObject } from 'react';
import type { MotionValue } from 'framer-motion';

/**
 * Scroll-linked video scrubbing (direct manipulation).
 *
 * Apple fluid interfaces: track 1:1 with scroll, never spring media time,
 * always animate from the live presentation value. Seeks are capped (~24fps)
 * so ProMotion displays don't spam the decoder. A pending-target queue means
 * a stuck `seeked` never freezes the scrub permanently.
 */
export function useVideoScrub(opts: {
  videoRef: RefObject<HTMLVideoElement | null>;
  scrollProgress: MotionValue<number>;
  mapTime: (progress: number, duration: number) => number | null;
  activeRef: RefObject<boolean>;
  /** Min media-time delta between seeks. Default ~1 frame at 24fps. */
  minDeltaSec?: number;
  /** Re-bind when the media element appears (lazy src). */
  enabled?: boolean;
}) {
  const { videoRef, scrollProgress, mapTime, activeRef, minDeltaSec = 1 / 24, enabled = true } = opts;

  useEffect(() => {
    if (!enabled) return;
    const video = videoRef.current;
    if (!video) return;

    let raf = 0;
    let seeking = false;
    let seekStartedAt = 0;
    let lastApplied = -1;
    let lastTick = 0;
    let pending: number | null = null;
    const SEEK_TIMEOUT_MS = 220;
    const TICK_MS = 1000 / 30;

    const applySeek = (time: number) => {
      const clamped = Math.max(0, Math.min(video.duration - 0.04, time));
      if (Math.abs(lastApplied - clamped) < minDeltaSec) {
        pending = null;
        return;
      }
      try {
        if (!video.paused) video.pause();
        seeking = true;
        seekStartedAt = performance.now();
        video.currentTime = clamped;
        lastApplied = clamped;
        pending = null;
      } catch {
        seeking = false;
      }
    };

    const onSeeking = () => {
      seeking = true;
      seekStartedAt = performance.now();
    };
    const onSeeked = () => {
      seeking = false;
      if (pending != null) {
        const next = pending;
        pending = null;
        applySeek(next);
      }
    };

    video.addEventListener('seeking', onSeeking);
    video.addEventListener('seeked', onSeeked);

    // Keep scrubbed videos paused. play()+seek fights iOS/Safari.
    try {
      video.pause();
      video.muted = true;
      video.playsInline = true;
    } catch {
      /* ignore */
    }

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
        seeking = false;
        if (pending != null) {
          const next = pending;
          pending = null;
          applySeek(next);
          return;
        }
      }
      if (!video.duration || !Number.isFinite(video.duration)) return;
      if (now - lastTick < TICK_MS) return;
      lastTick = now;

      const target = mapTime(scrollProgress.get(), video.duration);
      if (target == null || Number.isNaN(target)) return;

      if (seeking) {
        pending = target;
        return;
      }
      applySeek(target);
    };

    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      video.removeEventListener('seeking', onSeeking);
      video.removeEventListener('seeked', onSeeked);
    };
  }, [videoRef, scrollProgress, mapTime, activeRef, minDeltaSec, enabled]);
}

import { useEffect, useRef, useState } from 'react';
import GlassLayer from './GlassLayer';

/** Meet Yureka left card — bank portal loop (Assured by Y). */
const BUBBLE_VIDEO_URL = '/assets/bankrewards.mp4';
/** Gatekeeping panel — rewards / vault loop. */
const VAULT_VIDEO_URL = '/rewards.mp4';

/**
 * Plays muted while visibly on screen; pauses when scrolled/slid away.
 * Works inside the horizontal pin-scrub row (transform + sticky).
 */
function InViewVideo({
  src,
  fit = 'cover',
  className = '',
  withGlass = true,
}: {
  src: string;
  fit?: 'cover' | 'contain';
  className?: string;
  withGlass?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [near, setNear] = useState(false);
  const [hasFrame, setHasFrame] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        const on = entry.isIntersecting && entry.intersectionRatio >= 0.2;
        setNear(on);
        const video = videoRef.current;
        if (!video) return;
        if (on) {
          video.muted = true;
          const p = video.play();
          if (p) p.catch(() => {});
        } else {
          video.pause();
        }
      },
      { threshold: [0, 0.2, 0.45, 0.7], rootMargin: '40px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Retry play after the first gesture if the browser blocked muted autoplay.
  useEffect(() => {
    if (!near) return;
    const resume = () => {
      const video = videoRef.current;
      if (!video || !video.paused) return;
      const p = video.play();
      if (p) p.catch(() => {});
    };
    window.addEventListener('pointerdown', resume, { once: true, passive: true });
    window.addEventListener('touchstart', resume, { once: true, passive: true });
    window.addEventListener('scroll', resume, { once: true, passive: true });
    return () => {
      window.removeEventListener('pointerdown', resume);
      window.removeEventListener('touchstart', resume);
      window.removeEventListener('scroll', resume);
    };
  }, [near]);

  return (
    <div ref={containerRef} className={`relative overflow-hidden ${className}`}>
      {!hasFrame && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div
            className="h-[55%] w-[55%] rounded-full opacity-25"
            style={{
              background: 'radial-gradient(circle, #5fae52 0%, transparent 70%)',
              filter: 'blur(28px)',
            }}
          />
        </div>
      )}
      <video
        ref={videoRef}
        src={src}
        muted
        loop
        playsInline
        preload={near ? 'auto' : 'metadata'}
        disablePictureInPicture
        onLoadedData={() => setHasFrame(true)}
        onPlaying={() => setHasFrame(true)}
        onError={() => setHasFrame(true)}
        className={`absolute inset-0 h-full w-full ${
          fit === 'cover' ? 'object-cover' : 'object-contain'
        } ${hasFrame ? 'opacity-100' : 'opacity-80'}`}
      />
      {withGlass && <GlassLayer />}
    </div>
  );
}

export function PhoneBubbleMockup() {
  return (
    <div className="relative flex h-full min-h-[260px] items-center justify-center overflow-hidden rounded-2xl border border-white/20 bg-[#0a0a0a] shadow-2xl shadow-black/40 backdrop-blur-xl">
      <InViewVideo src={BUBBLE_VIDEO_URL} className="absolute inset-0 h-full w-full" />
    </div>
  );
}

export function PhoneVaultMockup() {
  return (
    <div className="relative flex h-full min-h-[260px] items-center justify-center overflow-hidden">
      <InViewVideo
        src={VAULT_VIDEO_URL}
        fit="contain"
        withGlass={false}
        className="absolute inset-0 h-full w-full"
      />
    </div>
  );
}

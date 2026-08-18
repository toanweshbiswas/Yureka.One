import React, { useEffect, useRef, useState } from 'react'

type Props = {
  src: string
  className?: string
  /** Applied to the <video> element */
  videoClassName?: string
  poster?: string
  /** Start loading sooner (above-fold) */
  eager?: boolean
  fit?: 'cover' | 'contain'
  /** How far before the viewport to start loading */
  rootMargin?: string
}

/**
 * Scroll-driven video: mounts near viewport, plays only while intersecting,
 * pauses when scrolled away. Never uses the autoplay attribute.
 * Always keeps a visible frame (poster / gradient / forced fade-in) so mobile
 * never shows a permanent black hole when loadeddata is flaky.
 */
const ScrollVideo: React.FC<Props> = ({
  src,
  className = '',
  videoClassName = '',
  poster,
  eager = false,
  fit = 'cover',
  rootMargin = '280px 0px',
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [shouldLoad, setShouldLoad] = useState(eager)
  const [inView, setInView] = useState(eager)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const io = new IntersectionObserver(
      ([entry]) => {
        const visible = entry.isIntersecting
        setInView(visible)
        if (visible) setShouldLoad(true)
      },
      { rootMargin, threshold: 0.12 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [rootMargin])

  useEffect(() => {
    const video = videoRef.current
    if (!shouldLoad || !video) return

    const markReady = () => setReady(true)
    video.addEventListener('loadeddata', markReady)
    video.addEventListener('playing', markReady)
    // Fail-safe: never leave opacity-0 forever on iOS flaky decode
    const failSafe = window.setTimeout(markReady, 1600)

    return () => {
      video.removeEventListener('loadeddata', markReady)
      video.removeEventListener('playing', markReady)
      window.clearTimeout(failSafe)
    }
  }, [shouldLoad, src])

  useEffect(() => {
    const video = videoRef.current
    if (!shouldLoad || !video) return

    if (inView) {
      const tryPlay = () => {
        const p = video.play()
        if (p) p.catch(() => {})
      }
      if (video.readyState >= 2) tryPlay()
      else video.addEventListener('canplay', tryPlay, { once: true })
      return () => video.removeEventListener('canplay', tryPlay)
    }

    video.pause()
  }, [shouldLoad, inView, src])

  // Resume after first user gesture if muted play was blocked earlier
  useEffect(() => {
    if (!shouldLoad) return
    const resume = () => {
      const video = videoRef.current
      if (!video || !inView || !video.paused) return
      const p = video.play()
      if (p) p.catch(() => {})
    }
    window.addEventListener('touchstart', resume, { once: true, passive: true })
    window.addEventListener('scroll', resume, { once: true, passive: true })
    return () => {
      window.removeEventListener('touchstart', resume)
      window.removeEventListener('scroll', resume)
    }
  }, [shouldLoad, inView])

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden ${className}`}
      style={{
        background: ready
          ? '#0a0a0a'
          : 'linear-gradient(135deg, #0d1a0f 0%, #0a0a0a 50%, #0d1209 100%)',
      }}
    >
      {!ready && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.22]">
          <div
            className="h-[60%] w-[60%] rounded-full"
            style={{
              background: 'radial-gradient(circle, #5fae52 0%, transparent 70%)',
              filter: 'blur(32px)',
            }}
          />
        </div>
      )}
      {shouldLoad && (
        <video
          ref={videoRef}
          src={src}
          poster={poster}
          muted
          loop
          playsInline
          preload={eager ? 'auto' : 'metadata'}
          // Intentionally no autoPlay — playback is scroll/intersection driven
          onLoadedData={() => setReady(true)}
          onError={() => setReady(true)}
          className={`absolute inset-0 h-full w-full transition-opacity duration-500 motion-reduce:transition-none ${
            fit === 'cover' ? 'object-cover' : 'object-contain'
          } ${ready ? 'opacity-100' : 'opacity-70'} ${videoClassName}`}
        />
      )}
    </div>
  )
}

export default ScrollVideo
